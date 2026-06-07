import type {
  CallExpression,
  Identifier,
  ImportDeclaration,
  Node,
  Statement,
  VariableDeclarator,
} from '@babel/types'
import {
  BindingTypes,
  extractIdentifiers,
  type BindingMetadata,
} from '@vue-source/compiler-core'
import type { SFCDescriptor, SFCScriptBlock } from './parse'
import type { SFCTemplateCompileOptions } from './compileTemplate'
import { compileTemplate } from './compileTemplate'
import { analyzeScriptBindings } from './script/analyzeScriptBindings'
import { ScriptCompileContext, type ImportBinding } from './script/context'
import { genRuntimeProps, processDefineProps } from './script/defineProps'
import { genRuntimeEmits, processDefineEmits } from './script/defineEmits'
import { genRuntimeModelProps, processDefineModel } from './script/defineModel'
import { processDefineExpose } from './script/defineExpose'
import { processDefineSlots } from './script/defineSlots'
import { processDefineOptions } from './script/defineOptions'
import { processNormalScript } from './script/normalScript'
import { processAwait } from './script/topLevelAwait'
import { transformDestructuredProps } from './script/definePropsDestructure'
import { rewriteDefault } from './rewriteDefault'
import { warnOnce } from './warn'
import {
  isImportUsed,
  resolveTemplateUsedIdentifiers,
  resolveTemplateVModelIdentifiers,
} from './script/importUsageCheck'
import { DEFAULT_FILENAME } from './parse'

export interface ScriptBinding {
  local: string
  kind: 'props' | 'emits' | 'model'
  runtimeDecl: string | null
}

export interface ModelDecl {
  name: string
  local: string | null
  options: string | null
}

const MACRO_IMPORTS = new Set([
  'defineProps',
  'defineEmits',
  'defineExpose',
  'defineOptions',
  'defineSlots',
  'defineModel',
  'withDefaults',
])

export interface SFCScriptCompileOptions {
  id?: string
  isProd?: boolean
  inlineTemplate?: boolean
  genDefaultAs?: string
  templateOptions?: Partial<SFCTemplateCompileOptions>
}

export interface ScriptCompileResult {
  filename: string
  content: string
  bindings: Record<string, ScriptBinding['kind']>
  bindingMetadata: BindingMetadata
  script: SFCScriptBlock | null
  propsDecl: string | null
  emitsDecl: string | null
  modelsDecl: ModelDecl[]
  runtimeProps: string | null
  runtimeEmits: string | null
  runtimeModelProps: string | null
  runtimeOptions: string[]
  helperImports: string[]
  generatedOptionsCode: string
  optionsDecl: string | null
  exposeDecl: string | null
  slotsDecl: string | null
  imports: Record<string, ImportBinding>
  templateUsage: {
    usedImports: string[]
    usedIdentifiers: string[]
    vModelIdentifiers: string[]
  }
  setup: {
    hasDefinePropsCall: boolean
    hasDefineEmitsCall: boolean
    hasDefineModelCall: boolean
  }
}

interface InlineTemplateResult {
  code: string
  preamble: string
  ssrInlineRender: boolean
}

export function compileScript(
  descriptor: SFCDescriptor,
  options: SFCScriptCompileOptions = {},
): ScriptCompileResult {
  // compileScript 负责把 `<script>` / `<script setup>` 统一整理成最终组件脚本内容，
  // 并产出 bindingMetadata，供 template 编译阶段识别变量来源。
  validateScriptBlocks(descriptor)
  const ctx = new ScriptCompileContext(descriptor, options)
  const block = ctx.block
  const content = ctx.content
  const canProcessScriptSetup = isProcessableScriptLang(descriptor.scriptSetup?.lang)
  const canProcessNormalScript = isProcessableScriptLang(descriptor.script?.lang)

  if (!descriptor.scriptSetup) {
    // 没有 `<script setup>` 时，走普通 script 分析路径。
    if (descriptor.script?.lang && !canProcessNormalScript) {
      return emptyResult(descriptor.filename, descriptor.script)
    }
    analyzeScriptBindings(ctx)
    return processNormalScript(ctx)
  }

  if (descriptor.scriptSetup.lang && !canProcessScriptSetup) {
    return emptyResult(descriptor.filename, descriptor.scriptSetup)
  }

  if (!content.trim()) {
    return emptyResult(descriptor.filename, block)
  }

  // 先把脚本里出现的顶层绑定全部登记出来，生成模板编译要依赖的
  // bindingMetadata 基础信息。
  analyzeScriptBindings(ctx)
  // 把普通 `<script>` 与 `<script setup>` 的 import 统一归档到 ctx.imports，
  // 后续宏校验、模板使用分析、inline template 都基于这份归一化结果工作。
  normalizeScriptImports(ctx, options.inlineTemplate === true)
  normalizeSetupImports(ctx, options.inlineTemplate === true)

  // 逐条扫描 setup 顶层语句，识别 defineProps / defineEmits / defineModel
  // 等编译期宏，把声明信息存进上下文。
  for (const stmt of ctx.program!.body) {
    analyzeSetupMacros(stmt, content, ctx)
  }

  if (ctx.propsDestructureDecl) {
    // defineProps 解构需要先重写，再重新 parse 一次脚本 AST。
    transformDestructuredProps(ctx)
    ctx.reparse()
  }

  for (const stmt of ctx.program!.body || []) {
    // 这里先只做顶层 await 探测，真正的源码改写统一放到下一步处理。
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AwaitExpression') {
      ctx.hasTopLevelAwait = true
      continue
    }
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.init?.type === 'AwaitExpression') {
          ctx.hasTopLevelAwait = true
        }
      }
    }
  }

  if (ctx.hasTopLevelAwait) {
    // 顶层 await 会被改写成带上下文恢复能力的形式，然后重新 parse。
    ctx.content = transformTopLevelAwait(ctx)
    ctx.reparse()
  }

  ctx.runtimeModelProps = genRuntimeModelProps(ctx.modelsDecl)
  // 这里把 props / emits / model 等编译期宏统一落成运行时 options 字符串。
  ctx.runtimeProps = mergeRuntimeProps(
    genRuntimeProps(ctx),
    ctx.runtimeModelProps,
  )
  ctx.runtimeEmits = genRuntimeEmits(
    ctx.emitsDecl,
    ctx.modelsDecl.map(model => model.name),
  )
  ctx.runtimeOptions = [
    ctx.runtimeProps ? `props: ${ctx.runtimeProps}` : '',
    ctx.runtimeEmits ? `emits: ${ctx.runtimeEmits}` : '',
    ctx.optionsDecl ? `...${ctx.optionsDecl}` : '',
  ].filter(Boolean)
  // helper 只在实际需要时才注入，保持最终生成结果尽量精简。
  ctx.helperImports = [
    ctx.propsDecl && ctx.runtimeModelProps ? 'mergeModels' : '',
    ctx.propsDestructureDecl ? 'mergeDefaults' : '',
    ctx.emitsDecl && ctx.modelsDecl.length > 0 ? 'mergeModels' : '',
    ctx.hasTopLevelAwait ? 'withAsyncContext' : '',
    ...ctx.helperImports,
  ].filter(Boolean)
  ctx.generatedOptionsCode = ctx.runtimeOptions.length
    ? `{\n  ${ctx.runtimeOptions.join(',\n  ')}\n}`
    : `{}`
  const usedIdentifiers = resolveTemplateUsedIdentifiers(descriptor)
  const vModelIdentifiers = resolveTemplateVModelIdentifiers(descriptor)
  // 同时分析 template 对 import / 标识符 / v-model 变量的使用情况，
  // 这样 script 产物就能更精准地决定哪些绑定要暴露给模板。
  for (const local in ctx.imports) {
    ctx.imports[local].isUsedInTemplate = options.inlineTemplate
      ? false
      : isImportUsed(local, descriptor)
  }
  ctx.templateUsage = {
    usedImports: options.inlineTemplate
      ? []
      : Object.keys(ctx.imports).filter(local => !!ctx.imports[local].isUsedInTemplate),
    usedIdentifiers: [...usedIdentifiers],
    vModelIdentifiers: [...vModelIdentifiers],
  }
  ctx.bindingMetadata.__isScriptSetup = true

  const inlineTemplate = resolveInlineTemplate(ctx)
  ctx.content = buildCompiledScriptContent(ctx, inlineTemplate)

  return ctx.toResult()
}

function normalizeScriptImports(
  ctx: ScriptCompileContext,
  inlineTemplate: boolean,
) {
  if (!ctx.scriptAst) {
    return
  }

  for (const stmt of ctx.scriptAst.body) {
    if (stmt.type !== 'ImportDeclaration') {
      continue
    }
    registerImportStatement(ctx, stmt, false, inlineTemplate)
  }
}

function normalizeSetupImports(
  ctx: ScriptCompileContext,
  inlineTemplate: boolean,
) {
  if (!ctx.program) {
    return
  }

  for (const stmt of ctx.program.body) {
    if (stmt.type !== 'ImportDeclaration') {
      continue
    }
    registerImportStatement(ctx, stmt, true, inlineTemplate)
  }
}

function registerImportStatement(
  ctx: ScriptCompileContext,
  stmt: ImportDeclaration,
  isFromSetup: boolean,
  inlineTemplate: boolean,
) {
  // Babel 的不同 import 形式会在这里被拍平成统一的 ImportBinding 结构。
  const source = stmt.source.value
  for (const specifier of stmt.specifiers) {
    const imported =
      specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.type === 'ImportNamespaceSpecifier'
          ? '*'
          : specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
    const local = specifier.local.name

    if (isFromSetup && source === 'vue' && MACRO_IMPORTS.has(imported)) {
      // `<script setup>` 里的这些名字是编译期宏，不应该作为真实运行时 import 保留。
      if (local === imported) {
        warnOnce(
          `\`${imported}\` is a compiler macro and no longer needs to be imported.`,
        )
      } else {
        throw new Error(
          `[@vue-source/compiler-sfc] \`${imported}\` is a compiler macro and cannot be aliased to a different name.`,
        )
      }
      delete ctx.imports[local]
      continue
    }

    registerImport(
      ctx,
      {
        imported,
        local,
        source,
        isType:
          stmt.importKind === 'type' ||
          (specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type'),
        isFromSetup,
      },
      inlineTemplate,
    )
  }
}

function registerImport(
  ctx: ScriptCompileContext,
  binding: Omit<ImportBinding, 'isUsedInTemplate'>,
  inlineTemplate: boolean,
) {
  const existing = ctx.imports[binding.local]
  if (existing) {
    if (
      existing.source === binding.source &&
      existing.imported === binding.imported
    ) {
      if (binding.isFromSetup) {
        existing.isFromSetup = true
      }
      return
    }
    throw new Error(
      `[@vue-source/compiler-sfc] different imports aliased to same local name.`,
    )
  }

  ctx.imports[binding.local] = {
    ...binding,
    // 非 inline template 场景下，这里直接结合 template AST 判断该 import
    // 是否被模板真实使用。
    isUsedInTemplate: inlineTemplate
      ? false
      : isImportUsed(binding.local, ctx.descriptor),
  }
}

function validateScriptBlocks(descriptor: SFCDescriptor) {
  const scriptLang = descriptor.script?.lang
  const scriptSetupLang = descriptor.scriptSetup?.lang
  if (
    descriptor.script &&
    descriptor.scriptSetup &&
    scriptLang !== scriptSetupLang
  ) {
    throw new Error(
      `[@vue-source/compiler-sfc] <script> and <script setup> must have the same language type.`,
    )
  }
}

function emptyResult(
  filename: string,
  block: SFCScriptBlock | null,
): ScriptCompileResult {
  return {
    filename,
    content: block?.content ?? '',
    bindings: {},
    bindingMetadata: {},
    script: block ?? null,
    propsDecl: null,
    emitsDecl: null,
    modelsDecl: [],
    runtimeProps: null,
    runtimeEmits: null,
    runtimeModelProps: null,
    runtimeOptions: [],
    helperImports: [],
    generatedOptionsCode: '',
    optionsDecl: null,
    exposeDecl: null,
    slotsDecl: null,
    imports: {},
    templateUsage: {
      usedImports: [],
      usedIdentifiers: [],
      vModelIdentifiers: [],
    },
    setup: {
      hasDefinePropsCall: false,
      hasDefineEmitsCall: false,
      hasDefineModelCall: false,
    },
  }
}

function analyzeDeclarator(
  decl: VariableDeclarator,
  source: string,
  ctx: ScriptCompileContext,
) {
  // 这里集中识别 `<script setup>` 宏调用：
  // defineProps / defineEmits / defineModel / defineExpose / defineSlots ...
  if (!decl.init || decl.init.type !== 'CallExpression') {
    return
  }

  const callee = decl.init.callee
  if (callee.type !== 'Identifier') {
    return
  }

  if (processDefineProps(decl, source, ctx)) {
    markBinding(getLocalName(decl.id), 'props', ctx)
    return
  }
  if (processDefineEmits(decl, source, ctx)) {
    markBinding(getLocalName(decl.id), 'emits', ctx)
    return
  }
  if (processDefineModel(decl, source, ctx)) {
    markBinding(getLocalName(decl.id), 'model', ctx)
    return
  }
  if (processDefineExpose(decl, ctx)) {
    return
  }
  if (processDefineSlots(decl, ctx)) {
    return
  }
  if (processDefineOptions(decl, ctx)) {
    return
  }
}

function analyzeSetupMacros(
  stmt: Statement,
  source: string,
  ctx: ScriptCompileContext,
) {
  if (stmt.type === 'VariableDeclaration') {
    for (const decl of stmt.declarations) {
      analyzeDeclarator(decl, source, ctx)
      validateMacroAssignment(decl, ctx)
    }
    return
  }

  if (
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'CallExpression'
  ) {
    analyzeCallMacro(stmt.expression, source, ctx)
  }
}

function analyzeCallMacro(
  call: CallExpression,
  source: string,
  ctx: ScriptCompileContext,
) {
  const macroDecl = createSyntheticMacroDecl(call)
  if (processDefineProps(macroDecl, source, ctx)) {
    return
  }
  if (processDefineEmits(macroDecl, source, ctx)) {
    return
  }
  if (processDefineModel(macroDecl, source, ctx)) {
    return
  }
  if (processDefineExpose(macroDecl, ctx)) {
    return
  }
  if (processDefineSlots(macroDecl, ctx)) {
    return
  }
  processDefineOptions(macroDecl, ctx)
}

function validateMacroAssignment(
  decl: VariableDeclarator,
  ctx: ScriptCompileContext,
) {
  if (!decl.init || decl.init.type !== 'CallExpression') {
    return
  }
  if (processDefineOptions(decl, ctx)) {
    throw new Error(
      `[@vue-source/compiler-sfc] defineOptions() has no returning value, it cannot be assigned.`,
    )
  }
  if (processDefineExpose(decl, ctx)) {
    throw new Error(
      `[@vue-source/compiler-sfc] defineExpose() has no returning value, it cannot be assigned.`,
    )
  }
}

function createSyntheticMacroDecl(call: CallExpression): VariableDeclarator {
  return {
    type: 'VariableDeclarator',
    id: {
      type: 'Identifier',
      name: '__macro__',
    } as Identifier,
    init: call,
  }
}

function mergeRuntimeProps(
  propsDecl: string | null,
  runtimeModelProps: string | null,
): string | null {
  if (propsDecl && runtimeModelProps) {
    return `mergeModels(${propsDecl}, ${runtimeModelProps})`
  }
  return propsDecl || runtimeModelProps
}

function markBinding(
  local: string | null,
  kind: ScriptBinding['kind'],
  ctx: ScriptCompileContext,
) {
  if (local) {
    ctx.bindings[local] = kind
    ctx.markBinding(
      local,
      kind === 'props'
        ? BindingTypes.PROPS
        : kind === 'emits'
          ? BindingTypes.SETUP_CONST
          : BindingTypes.PROPS,
    )
  }
}

function getLocalName(id: Node): string | null {
  if (id.type === 'Identifier') return id.name
  if (id.type === 'ArrayPattern') {
    const first = id.elements[0]
    return first && first.type === 'Identifier' ? first.name : null
  }
  return null
}

function transformTopLevelAwait(ctx: ScriptCompileContext): string {
  const content = ctx.content
  const replacements: Array<{ start: number; end: number; value: string }> = []

  for (const stmt of ctx.program!.body) {
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AwaitExpression') {
      replacements.push({
        start: stmt.start ?? 0,
        end: stmt.end ?? 0,
        value: processAwait(ctx, stmt.expression, false, true),
      })
    }

    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (!decl.init || decl.init.type !== 'AwaitExpression') {
          continue
        }
        const awaitReplacement = processAwait(ctx, decl.init, false, false)
        const initStart = decl.init.start ?? 0
        const initEnd = decl.init.end ?? 0
        replacements.push({
          start: initStart,
          end: initEnd,
          value: awaitReplacement,
        })
      }
    }
  }

  if (!replacements.length) {
    return content
  }

  replacements.sort((a, b) => b.start - a.start)
  let next = content
  for (const replacement of replacements) {
    next =
      next.slice(0, replacement.start) +
      replacement.value +
      next.slice(replacement.end)
  }
  return next
}

function resolveInlineTemplate(
  ctx: ScriptCompileContext,
): InlineTemplateResult | null {
  if (!ctx.options.inlineTemplate) {
    return null
  }

  const template = ctx.descriptor.template
  if (!template || template.src) {
    return {
      code: `() => {}`,
      preamble: '',
      ssrInlineRender: false,
    }
  }

  const result = compileTemplate({
    filename: ctx.descriptor.filename,
    source: template.content,
    ast: template.ast,
    inMap: template.map,
    id: ctx.options.id || '',
    scoped: ctx.descriptor.styles.some(style => style.scoped),
    slotted: ctx.descriptor.slotted,
    isProd: ctx.options.isProd,
    ssrCssVars: ctx.descriptor.cssVars,
    ...ctx.options.templateOptions,
    compilerOptions: {
      ...(ctx.options.templateOptions?.compilerOptions || {}),
      inline: true,
      isTS: isTSFile(ctx),
      bindingMetadata: ctx.bindingMetadata,
    },
  })

  const error = result.errors[0]
  if (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }

  return {
    code: result.code,
    preamble: result.preamble || '',
    ssrInlineRender: !!ctx.options.templateOptions?.ssr,
  }
}

function buildCompiledScriptContent(
  ctx: ScriptCompileContext,
  inlineTemplate: InlineTemplateResult | null,
): string {
  const normalScript = prepareNormalScriptModule(ctx)
  const setupCompiled = transformSetupRuntimeContent(ctx)
  const setupReturnCode = buildSetupReturnCode(ctx, inlineTemplate)
  const setupSignature = buildSetupSignature(ctx)
  const setupPreamble = buildSetupPreamble(ctx)
  const runtimeEntries = buildRuntimeOptionEntries(ctx, inlineTemplate)
  const setupBlock = `setup${ctx.hasTopLevelAwait ? ': async ' : ': '}${setupSignature} {\n${indentBlock(
    [setupPreamble, setupCompiled.body].filter(Boolean).join('\n'),
    2,
  )}${setupPreamble || setupCompiled.body ? '\n' : ''}${indentBlock(setupReturnCode, 2)}\n}`
  const optionEntries = [...runtimeEntries, setupBlock]
  const exportTarget = ctx.options.genDefaultAs || '__sfc__'
  const componentCode = buildComponentDefinition(
    ctx,
    optionEntries,
    normalScript.hasDefaultExport,
  )
  const helperImportCode = buildHelperImportCode(ctx.helperImports)

  return [
    inlineTemplate?.preamble || '',
    helperImportCode,
    normalScript.imports,
    setupCompiled.imports,
    normalScript.moduleCode,
    componentCode,
    ctx.options.genDefaultAs ? '' : `export default ${exportTarget}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildRuntimeOptionEntries(
  ctx: ScriptCompileContext,
  inlineTemplate: InlineTemplateResult | null,
): string[] {
  const entries: string[] = []
  const filename = ctx.descriptor.filename
  if (filename && filename !== DEFAULT_FILENAME) {
    const match = filename.match(/([^/\\]+)\.\w+$/)
    if (match) {
      entries.push(`__name: '${match[1]}'`)
    }
  }
  if (ctx.runtimeProps) {
    entries.push(`props: ${ctx.runtimeProps}`)
  }
  if (ctx.runtimeEmits) {
    entries.push(`emits: ${ctx.runtimeEmits}`)
  }
  if (inlineTemplate?.ssrInlineRender) {
    entries.push(`__ssrInlineRender: true`)
  }
  return entries
}

function buildComponentDefinition(
  ctx: ScriptCompileContext,
  optionEntries: string[],
  hasDefaultExport: boolean,
): string {
  const exportTarget = ctx.options.genDefaultAs || '__sfc__'
  const body = `{\n  ${optionEntries.join(',\n  ')}\n}`
  const hasBase = hasDefaultExport || !!ctx.optionsDecl
  const lang =
    ctx.descriptor.scriptSetup?.lang || ctx.descriptor.script?.lang || ''
  const isTS = lang === 'ts' || lang === 'tsx'

  if (isTS) {
    if (!ctx.helperImports.includes('defineComponent')) {
      ctx.helperImports.push('defineComponent')
    }
    const mergedEntries = [
      hasDefaultExport ? '...__default__' : '',
      ctx.optionsDecl ? `...${ctx.optionsDecl}` : '',
      body.slice(1, -1).trim(),
    ].filter(Boolean)
    return `const ${exportTarget} = /*@__PURE__*/defineComponent({\n  ${mergedEntries.join(',\n  ')}\n})`
  }

  if (hasBase) {
    const bases = [
      hasDefaultExport ? '__default__' : '',
      ctx.optionsDecl ? ctx.optionsDecl : '',
    ].filter(Boolean)
    return `const ${exportTarget} = /*@__PURE__*/Object.assign(${bases.join(', ')}, ${body})`
  }

  return `const ${exportTarget} = ${body}`
}

function prepareNormalScriptModule(ctx: ScriptCompileContext): {
  imports: string
  moduleCode: string
  hasDefaultExport: boolean
} {
  const script = ctx.descriptor.script
  if (!script?.content.trim()) {
    return {
      imports: '',
      moduleCode: 'const __default__ = {}',
      hasDefaultExport: false,
    }
  }

  const content = /export\s+default|export\s*\{[^}]*default[^}]*\}/.test(
    script.content,
  )
    ? rewriteDefault(script.content, '__default__')
    : `${script.content}\nconst __default__ = {}`

  const lines = content.split('\n')
  const imports: string[] = []
  const body: string[] = []
  for (const line of lines) {
    if (/^\s*import\s/.test(line)) {
      imports.push(line)
    } else {
      body.push(line)
    }
  }

  return {
    imports: imports.join('\n').trim(),
    moduleCode: body.join('\n').trim(),
    hasDefaultExport: true,
  }
}

function transformSetupRuntimeContent(ctx: ScriptCompileContext): {
  imports: string
  body: string
} {
  if (!ctx.program) {
    return { imports: '', body: '' }
  }

  const scriptImportLocals = new Set<string>()
  if (ctx.scriptAst) {
    for (const stmt of ctx.scriptAst.body) {
      if (stmt.type !== 'ImportDeclaration') continue
      for (const spec of stmt.specifiers) {
        scriptImportLocals.add(spec.local.name)
      }
    }
  }

  const setupImports: string[] = []
  const statements: string[] = []
  for (const stmt of ctx.program.body) {
    if (stmt.type === 'ImportDeclaration') {
      const rendered = renderSetupImport(stmt, ctx, scriptImportLocals)
      if (rendered) {
        setupImports.push(rendered)
      }
      continue
    }

    const transformed = transformSetupStatement(stmt, ctx)
    if (transformed != null && transformed.trim()) {
      statements.push(transformed.trimEnd())
    }
  }

  return {
    imports: [...new Set(setupImports)].join('\n'),
    body: statements.join('\n'),
  }
}

function renderSetupImport(
  stmt: ImportDeclaration,
  _ctx: ScriptCompileContext,
  scriptImportLocals: Set<string>,
): string {
  const source = stmt.source.value
  const kept = stmt.specifiers.filter(spec => {
    if (scriptImportLocals.has(spec.local.name)) {
      return false
    }
    if (spec.type !== 'ImportSpecifier') {
      return true
    }
    const imported =
      spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value
    return !(source === 'vue' && MACRO_IMPORTS.has(imported))
  })
  if (!kept.length) {
    return ''
  }

  const defaultSpecifier = kept.find(spec => spec.type === 'ImportDefaultSpecifier')
  const namespaceSpecifier = kept.find(
    spec => spec.type === 'ImportNamespaceSpecifier',
  )
  const namedSpecifiers = kept.filter(
    spec => spec.type === 'ImportSpecifier',
  )

  const parts: string[] = []
  if (defaultSpecifier?.type === 'ImportDefaultSpecifier') {
    parts.push(defaultSpecifier.local.name)
  }
  if (namespaceSpecifier?.type === 'ImportNamespaceSpecifier') {
    parts.push(`* as ${namespaceSpecifier.local.name}`)
  }
  if (namedSpecifiers.length) {
    parts.push(
      `{ ${namedSpecifiers
        .map(spec => {
          const imported =
            spec.imported.type === 'Identifier'
              ? spec.imported.name
              : spec.imported.value
          return imported === spec.local.name
            ? imported
            : `${imported} as ${spec.local.name}`
        })
        .join(', ')} }`,
    )
  }

  return `import ${parts.join(', ')} from '${source}'`
}

function transformSetupStatement(
  stmt: Statement,
  ctx: ScriptCompileContext,
): string | null {
  if (
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'CallExpression' &&
    stmt.expression.callee.type === 'Identifier'
  ) {
    const callee = stmt.expression.callee.name
    if (
      callee === 'defineProps' ||
      callee === 'withDefaults' ||
      callee === 'defineEmits' ||
      callee === 'defineOptions' ||
      callee === 'defineSlots' ||
      callee === 'defineModel'
    ) {
      return null
    }
    if (callee === 'defineExpose') {
      const arg = ctx.slice(stmt.expression.arguments[0])
      return arg ? `__expose(${arg})` : `__expose()`
    }
  }

  if (stmt.type === 'VariableDeclaration') {
    const declarations: string[] = []
    for (const decl of stmt.declarations) {
      const transformed = transformSetupDeclarator(decl, stmt.kind, ctx)
      if (transformed) {
        declarations.push(transformed)
      }
    }
    return declarations.length ? `${stmt.kind} ${declarations.join(', ')}` : null
  }

  return ctx.slice(stmt)
}

function transformSetupDeclarator(
  decl: VariableDeclarator,
  kind: string,
  ctx: ScriptCompileContext,
): string | null {
  if (
    !decl.init ||
    decl.init.type !== 'CallExpression' ||
    decl.init.callee.type !== 'Identifier'
  ) {
    return ctx.slice(decl)
  }

  const callee = resolveDeclaratorMacroName(decl)
  const local = getLocalName(decl.id)

  if (callee === 'defineProps') {
    if (!local) {
      if (ctx.propsDestructureRestId) {
        if (!ctx.helperImports.includes('createPropsRestProxy')) {
          ctx.helperImports.push('createPropsRestProxy')
        }
        return `${ctx.propsDestructureRestId} = createPropsRestProxy(__props, ${JSON.stringify(
          Object.keys(ctx.propsDestructuredBindings),
        )})`
      }
      return null
    }
    return `${local} = __props`
  }

  if (callee === 'defineEmits') {
    if (!local) {
      return null
    }
    return `${local} = __emit`
  }

  if (callee === 'defineSlots') {
    if (!local) {
      return null
    }
    if (!ctx.helperImports.includes('useSlots')) {
      ctx.helperImports.push('useSlots')
    }
    return `${local} = useSlots()`
  }

  if (callee === 'defineExpose' || callee === 'defineOptions') {
    return null
  }

  if (callee === 'defineModel') {
    const left = ctx.slice(decl.id)
    if (!left) {
      return null
    }
    const model = ctx.modelsDecl.find(item => item.local === local)
    const modelName = model?.name || 'modelValue'
    if (!ctx.helperImports.includes('useModel')) {
      ctx.helperImports.push('useModel')
    }
    const optionsArg = model?.options ? `, ${model.options}` : ''
    return `${left} = useModel(__props, ${JSON.stringify(modelName)}${optionsArg})`
  }

  return ctx.slice(decl)
}

function resolveDeclaratorMacroName(
  decl: VariableDeclarator,
): string | null {
  const init = decl.init
  if (!init || init.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
    return null
  }

  if (
    init.callee.name === 'withDefaults' &&
    init.arguments[0] &&
    init.arguments[0].type === 'CallExpression' &&
    init.arguments[0].callee.type === 'Identifier' &&
    init.arguments[0].callee.name === 'defineProps'
  ) {
    return 'defineProps'
  }

  return init.callee.name
}

function buildSetupReturnCode(
  ctx: ScriptCompileContext,
  inlineTemplate: InlineTemplateResult | null,
): string {
  if (inlineTemplate) {
    return `return ${inlineTemplate.code}`
  }
  const entries = collectSetupReturnEntries(ctx)
  const shouldMarkScriptSetup = !ctx.options.inlineTemplate
  if (!entries.length) {
    if (!shouldMarkScriptSetup) {
      return 'return {}'
    }
    return [
      `const __returned__ = {}`,
      `Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })`,
      `return __returned__`,
    ].join('\n')
  }
  if (!shouldMarkScriptSetup) {
    return `return { ${entries.join(', ')} }`
  }
  return [
    `const __returned__ = { ${entries.join(', ')} }`,
    `Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })`,
    `return __returned__`,
  ].join('\n')
}

function isTSFile(ctx: ScriptCompileContext): boolean {
  const lang = ctx.descriptor.scriptSetup?.lang || ctx.descriptor.script?.lang
  return lang === 'ts' || lang === 'tsx'
}

function isProcessableScriptLang(lang: string | undefined): boolean {
  if (!lang) {
    return true
  }
  return lang === 'js' || lang === 'jsx' || lang === 'ts' || lang === 'tsx'
}

function buildSetupSignature(ctx: ScriptCompileContext): string {
  const destructured: string[] = []
  if (ctx.setup.hasDefineExposeCall || !ctx.options.inlineTemplate) {
    destructured.push('expose: __expose')
  }
  if (ctx.setup.hasDefineEmitsCall || ctx.modelsDecl.length > 0) {
    destructured.push('emit: __emit')
  }
  return destructured.length
    ? `(__props, { ${destructured.join(', ')} })`
    : `(__props)`
}

function buildSetupPreamble(ctx: ScriptCompileContext): string {
  const lines: string[] = []
  if (ctx.hasTopLevelAwait) {
    lines.push('let __temp, __restore')
  }
  if (!ctx.setup.hasDefineExposeCall && !ctx.options.inlineTemplate) {
    lines.push('__expose();')
  }
  return lines.join('\n')
}

function collectSetupReturnEntries(ctx: ScriptCompileContext): string[] {
  if (!ctx.program) {
    return []
  }

  const names = new Set<string>()
  const entries: string[] = []

  for (const stmt of ctx.program.body) {
    if (stmt.type === 'ImportDeclaration') {
      for (const spec of stmt.specifiers) {
        const imported =
          spec.type === 'ImportSpecifier'
            ? spec.imported.type === 'Identifier'
              ? spec.imported.name
              : spec.imported.value
            : null
        if (stmt.source.value === 'vue' && imported && MACRO_IMPORTS.has(imported)) {
          continue
        }
        const local = spec.local.name
        if (names.has(local)) continue
        names.add(local)
        const binding = ctx.imports[local]
        if (
          binding &&
          binding.source !== 'vue' &&
          !binding.source.endsWith('.vue')
        ) {
          entries.push(`get ${local}() { return ${local} }`)
        } else {
          entries.push(local)
        }
      }
      continue
    }

    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        const macroName = resolveDeclaratorMacroName(decl)
        if (
          macroName === 'defineExpose' ||
          macroName === 'defineOptions'
        ) {
          continue
        }
        for (const id of extractIdentifiers(decl.id)) {
          if (!id.name.startsWith('__')) {
            if (names.has(id.name)) continue
            names.add(id.name)
            if (ctx.bindingMetadata[id.name] === BindingTypes.SETUP_LET) {
              const setArg = id.name === 'v' ? '_v' : 'v'
              entries.push(
                `get ${id.name}() { return ${id.name} }`,
                `set ${id.name}(${setArg}) { ${id.name} = ${setArg} }`,
              )
            } else {
              entries.push(id.name)
            }
          }
        }
      }
      continue
    }

    if (
      (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') &&
      stmt.id
    ) {
      if (!stmt.id.name.startsWith('__')) {
        if (names.has(stmt.id.name)) continue
        names.add(stmt.id.name)
        entries.push(stmt.id.name)
      }
    }
  }

  return entries
}

function buildHelperImportCode(helperImports: string[]): string {
  const names = [...new Set(helperImports)].filter(Boolean)
  if (!names.length) {
    return ''
  }

  const specifiers = names.map(name =>
    name === 'withAsyncContext' ? `${name} as _${name}` : name,
  )
  return `import { ${specifiers.join(', ')} } from 'vue'`
}

function indentBlock(source: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return source
    .split('\n')
    .map(line => (line ? `${pad}${line}` : line))
    .join('\n')
}
