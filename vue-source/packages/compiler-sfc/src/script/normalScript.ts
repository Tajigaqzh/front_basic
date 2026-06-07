import type { ScriptCompileResult } from '../compileScript'
import type { ScriptCompileContext } from './context'
import { rewriteDefault } from '../rewriteDefault'
import { analyzeNormalScriptBindings } from './analyzeScriptBindings'
import { isImportUsed, resolveTemplateUsedIdentifiers, resolveTemplateVModelIdentifiers } from './importUsageCheck'

export const normalScriptDefaultVar = `__default__`

export function processNormalScript(
  ctx: ScriptCompileContext,
): ScriptCompileResult {
  const script = ctx.descriptor.script
  const content = script?.content ?? ''

  if (!script || !content.trim()) {
    // 普通 `<script>` 缺失或为空时，直接返回一份空结果结构，
    // 保持 compileScript 的返回形状稳定。
    return {
      filename: ctx.descriptor.filename,
      content,
      bindings: {},
      bindingMetadata: {},
      script: script ?? null,
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

  if (ctx.scriptAst) {
    // 普通 `<script>` 需要额外分析 Options API 里的 props/data/methods/setup，
    // 这样模板编译阶段也能拿到完整 bindingMetadata。
    analyzeNormalScriptBindings(ctx, ctx.scriptAst.body)
  }

  for (const local in ctx.imports) {
    // 即便不是 `<script setup>`，模板仍然可能直接消费某些 import，
    // 例如组件引用或自定义指令。
    ctx.imports[local].isUsedInTemplate = isImportUsed(local, ctx.descriptor)
  }

  const usedIdentifiers = resolveTemplateUsedIdentifiers(ctx.descriptor)
  const vModelIdentifiers = resolveTemplateVModelIdentifiers(ctx.descriptor)
  ctx.templateUsage = {
    usedImports: Object.keys(ctx.imports).filter(
      local => !!ctx.imports[local].isUsedInTemplate,
    ),
    usedIdentifiers: [...usedIdentifiers],
    vModelIdentifiers: [...vModelIdentifiers],
  }

  if (/export\s+default|export\s*\{[^}]*default[^}]*\}/.test(content)) {
    // 把默认导出改写成可继续拼接/分析的局部变量形式，
    // 避免后续处理时直接和 `export default` 语法打架。
    ctx.content = rewriteDefault(content, normalScriptDefaultVar)
    ctx.scriptAst = null
  }

  // 把改写后的结果回写给 script block，保持 descriptor 与最终产物一致。
  script.content = ctx.content

  return ctx.toResult()
}
