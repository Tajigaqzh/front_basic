import {
  type BindingMetadata,
  type CodegenSourceMapGenerator,
  type CompilerError,
  type ElementNode,
  NodeTypes,
  type ParserOptions,
  type RawSourceMap,
  type RootNode,
  type SourceLocation,
  createRoot,
} from '@vue-source/compiler-core'
import * as CompilerDOM from '@vue-source/compiler-dom'
import { SourceMapGenerator } from 'source-map-js'
import { genCacheKey } from '@vue-source/shared'
import { createCache } from './cache'
import type { TemplateCompiler } from './compileTemplate'
import type { ImportBinding } from './script/context'
import { isImportUsed } from './script/importUsageCheck'
import { parseCssVars } from './style/cssVars'

export const DEFAULT_FILENAME = 'anonymous.vue'

export interface SFCParseOptions {
  filename?: string
  sourceMap?: boolean
  sourceRoot?: string
  pad?: boolean | 'line' | 'space'
  ignoreEmpty?: boolean
  compiler?: TemplateCompiler
  compilerOptions?: ParserOptions
  templateParseOptions?: ParserOptions
}

export interface SFCBlock {
  type: string
  content: string
  attrs: Record<string, string | true>
  loc: SourceLocation
  map?: RawSourceMap
  lang?: string
  src?: string
}

export interface SFCTemplateBlock extends SFCBlock {
  type: 'template'
  ast?: RootNode
}

export interface SFCScriptBlock extends SFCBlock {
  type: 'script'
  setup?: string | boolean
  bindings?: BindingMetadata
  imports?: Record<string, ImportBinding>
  scriptAst?: import('@babel/types').Statement[]
  scriptSetupAst?: import('@babel/types').Statement[]
  warnings?: string[]
  deps?: string[]
}

export interface SFCStyleBlock extends SFCBlock {
  type: 'style'
  scoped?: boolean
  module?: string | boolean
}

export interface SFCDescriptor {
  filename: string
  source: string
  template: SFCTemplateBlock | null
  script: SFCScriptBlock | null
  scriptSetup: SFCScriptBlock | null
  styles: SFCStyleBlock[]
  customBlocks: SFCBlock[]
  cssVars: string[]
  slotted: boolean
  shouldForceReload: (prevImports: Record<string, ImportBinding>) => boolean
}

export interface SFCParseResult {
  descriptor: SFCDescriptor
  errors: (CompilerError | SyntaxError)[]
}

export const parseCache = createCache<SFCParseResult>()

export function parse(
  source: string,
  options: SFCParseOptions = {},
): SFCParseResult {
  // SFC parse 的职责是把整个 `.vue` 文件拆成 descriptor：
  // template / script / script setup / styles / custom blocks。
  const sourceKey = genCacheKey(source, {
    ...options,
    compiler: { parse: options.compiler?.parse },
  })
  const cached = parseCache.get(sourceKey)
  if (cached) {
    return cached
  }

  const {
    sourceMap = true,
    filename = DEFAULT_FILENAME,
    sourceRoot = '',
    pad = false,
    ignoreEmpty = true,
    compiler = CompilerDOM,
    templateParseOptions = options.compilerOptions || {},
  } = options

  const descriptor: SFCDescriptor = {
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
    cssVars: [],
    slotted: false,
    shouldForceReload: prevImports => hmrShouldReload(prevImports, descriptor),
  }

  const errors: (CompilerError | SyntaxError)[] = []
  const ast = compiler.parse(source, {
    // 这里复用 compiler-dom/compiler-core 的 parser，
    // 但切到 `parseMode: 'sfc'`，让 tokenizer/parser 按 SFC 根标签规则处理。
    parseMode: 'sfc',
    prefixIdentifiers: true,
    ...templateParseOptions,
    onError: error => {
      errors.push(error)
    },
  })

  ast.children.forEach(node => {
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }

    if (
      ignoreEmpty &&
      node.tag !== 'template' &&
      isEmpty(node) &&
      !hasSrc(node)
    ) {
      return
    }

    switch (node.tag) {
      case 'template': {
        // `<template>` 会额外保留其内部 children AST，供 compileTemplate 继续编译。
        if (!descriptor.template) {
          const templateBlock = (descriptor.template = createBlock(
            node,
            source,
            false,
          ) as SFCTemplateBlock)
          if (!templateBlock.attrs.src) {
            templateBlock.ast = createRoot(node.children, source)
          }
          if (templateBlock.attrs.functional) {
            const error = new SyntaxError(
              `<template functional> is no longer supported in Vue 3. Use a normal <template> instead.`,
            ) as CompilerError
            error.loc = node.props.find(
              prop =>
                prop.type === NodeTypes.ATTRIBUTE && prop.name === 'functional',
            )!.loc
            errors.push(error)
          }
        } else {
          errors.push(createDuplicateBlockError(node))
        }
        break
      }
      case 'script': {
        // `<script>` 和 `<script setup>` 都会进入 descriptor，后续交给 compileScript。
        const block = createBlock(node, source, pad) as SFCScriptBlock
        const isSetup = !!block.attrs.setup
        if (isSetup && !descriptor.scriptSetup) {
          descriptor.scriptSetup = block
          break
        }
        if (!isSetup && !descriptor.script) {
          descriptor.script = block
          break
        }
        errors.push(createDuplicateBlockError(node, isSetup))
        break
      }
      case 'style': {
        // 每个 `<style>` 单独收集，后续 compileStyle 会分别处理 scoped/module/preprocess。
        const block = createBlock(node, source, pad) as SFCStyleBlock
        if (block.attrs.vars) {
          errors.push(
            new SyntaxError(
              `<style vars> has been replaced by the v-bind() based CSS vars proposal.`,
            ),
          )
        }
        descriptor.styles.push(block)
        break
      }
      default:
        descriptor.customBlocks.push(createBlock(node, source, pad))
    }
  })

  if (!descriptor.template && !descriptor.script && !descriptor.scriptSetup) {
    errors.push(
      new SyntaxError(
        `At least one <template> or <script> is required in a single file component. ${descriptor.filename}`,
      ),
    )
  }

  if (descriptor.scriptSetup) {
    if (descriptor.scriptSetup.src) {
      errors.push(
        new SyntaxError(
          `<script setup> cannot use the "src" attribute because it must be processed inline with the SFC.`,
        ),
      )
      descriptor.scriptSetup = null
    }
    if (descriptor.script && descriptor.script.src) {
      errors.push(
        new SyntaxError(
          `<script> cannot use the "src" attribute when <script setup> is also present.`,
        ),
      )
      descriptor.script = null
    }
  }

  let templateColumnOffset = 0
  if (
    descriptor.template &&
    (descriptor.template.lang === 'pug' || descriptor.template.lang === 'jade')
  ) {
    // pug/jade 模板常带统一缩进，这里先去掉公共缩进，
    // 同时记录列偏移，后面生成 source map 时再补回去。
    ;[descriptor.template.content, templateColumnOffset] = dedent(
      descriptor.template.content,
    )
  }

  if (sourceMap) {
    const genMap = (block: SFCBlock | null, columnOffset = 0) => {
      if (block && !block.src) {
        // 每个 block 都独立生成一份 source map，
        // 这样 template / script / style 后续单独编译时仍能回到 `.vue` 原文件位置。
        block.map = generateSourceMap(
          filename,
          source,
          block.content,
          sourceRoot,
          !pad || block.type === 'template' ? block.loc.start.line - 1 : 0,
          columnOffset,
        )
      }
    }
    genMap(descriptor.template, templateColumnOffset)
    genMap(descriptor.script)
    genMap(descriptor.scriptSetup)
    descriptor.styles.forEach(style => genMap(style))
    descriptor.customBlocks.forEach(block => genMap(block))
  }

  // CSS vars 是 SFC 级元信息，不只给 style 用，SSR template 编译也会消费。
  descriptor.cssVars = parseCssVars(descriptor)
  const slottedRE = /(?:::v-|:)slotted\(/
  descriptor.slotted = descriptor.styles.some(
    // scoped style 里如果用到了 `:slotted(...)`，后续 template 编译也要知道。
    style => style.scoped && slottedRE.test(style.content),
  )

  const result = { descriptor, errors }
  parseCache.set(sourceKey, result)
  return result
}

function createDuplicateBlockError(
  node: ElementNode,
  isScriptSetup = false,
): CompilerError {
  const error = new SyntaxError(
    `Single file component can contain only one <${node.tag}${
      isScriptSetup ? ' setup' : ''
    }> element`,
  ) as CompilerError
  error.loc = node.loc
  return error
}

function createBlock(
  node: ElementNode,
  source: string,
  pad: SFCParseOptions['pad'],
): SFCBlock {
  const type = node.tag
  const loc = node.innerLoc!
  const attrs: Record<string, string | true> = {}
  const block: SFCBlock = {
    type,
    // block.content 是把标签内部原始内容直接切出来，
    // 后续 script/template/style 编译都基于这段源文本继续工作。
    content: source.slice(loc.start.offset, loc.end.offset),
    loc,
    attrs,
  }

  if (pad) {
    // pad 的目的不是改业务内容，而是让后续独立编译 block 时，
    // 行号尽量仍和原 `.vue` 文件保持可对齐。
    block.content = padContent(source, block, pad) + block.content
  }

  node.props.forEach(prop => {
    if (prop.type !== NodeTypes.ATTRIBUTE) {
      return
    }
    const name = prop.name
    attrs[name] = prop.value ? prop.value.content || true : true
    if (name === 'lang') {
      block.lang = prop.value?.content
    } else if (name === 'src') {
      block.src = prop.value?.content
    } else if (type === 'style') {
      if (name === 'scoped') {
        ;(block as SFCStyleBlock).scoped = true
      } else if (name === 'module') {
        ;(block as SFCStyleBlock).module = attrs[name]
      }
    } else if (type === 'script' && name === 'setup') {
      ;(block as SFCScriptBlock).setup = attrs.setup
    }
  })

  return block
}

const splitRE = /\r?\n/g
const emptyRE = /^(?:\/\/)?\s*$/
const replaceRE = /./g

function generateSourceMap(
  filename: string,
  source: string,
  generated: string,
  sourceRoot: string,
  lineOffset: number,
  columnOffset: number,
): RawSourceMap {
  // 这里生成的是“block 内代码 -> 原始 `.vue` 文件”之间的映射，
  // 不是最终 render/style 产物的 source map。
  const map = new SourceMapGenerator({
    file: filename.replace(/\\/g, '/'),
    sourceRoot: sourceRoot.replace(/\\/g, '/'),
  }) as unknown as CodegenSourceMapGenerator

  map.setSourceContent(filename, source)
  map._sources.add(filename)

  generated.split(splitRE).forEach((line, index) => {
    if (emptyRE.test(line)) {
      return
    }
    const originalLine = index + 1 + lineOffset
    const generatedLine = index + 1
    for (let i = 0; i < line.length; i++) {
      if (!/\s/.test(line[i])) {
        // 这份简化实现按非空白字符逐个建映射点，足够支撑教学和基础定位。
        map._mappings.add({
          originalLine,
          originalColumn: i + columnOffset,
          generatedLine,
          generatedColumn: i,
          source: filename,
          name: null,
        })
      }
    }
  })

  return map.toJSON()
}

function padContent(
  content: string,
  block: SFCBlock,
  pad: SFCParseOptions['pad'],
): string {
  content = content.slice(0, block.loc.start.offset)
  if (pad === 'space') {
    // `space` 模式把前面内容全部替换成空格，最大化保留列对齐信息。
    return content.replace(replaceRE, ' ')
  }
  const offset = content.split(splitRE).length
  // 非 `space` 模式主要保留行号；普通 script 还会用 `//\n`
  // 作为占位，避免破坏 JS 注释语义。
  const padChar = block.type === 'script' && !block.lang ? '//\n' : '\n'
  return Array(offset).join(padChar)
}

function hasSrc(node: ElementNode): boolean {
  return node.props.some(prop => {
    return prop.type === NodeTypes.ATTRIBUTE && prop.name === 'src'
  })
}

function isEmpty(node: ElementNode): boolean {
  for (const child of node.children) {
    if (child.type !== NodeTypes.TEXT || child.content.trim() !== '') {
      return false
    }
  }
  return true
}

export function hmrShouldReload(
  prevImports: Record<string, ImportBinding>,
  next: SFCDescriptor,
): boolean {
  // 这里关注的是 TS/TSX 的 `<script setup>` 场景：
  // 某个之前“未被模板使用”的 import，如果现在突然被模板用到了，
  // HMR 不能只热替换 render，往往需要整组件强制 reload。
  if (
    !next.scriptSetup ||
    (next.scriptSetup.lang !== 'ts' && next.scriptSetup.lang !== 'tsx')
  ) {
    return false
  }

  for (const key in prevImports) {
    if (!prevImports[key].isUsedInTemplate && isImportUsed(key, next)) {
      return true
    }
  }

  return false
}

function dedent(source: string): [string, number] {
  const lines = source.split('\n')
  const minIndent = lines.reduce((current, line) => {
    if (line.trim() === '') {
      return current
    }
    const indent = line.match(/^\s*/)?.[0]?.length || 0
    return Math.min(indent, current)
  }, Infinity)

  if (minIndent === 0 || minIndent === Infinity) {
    return [source, minIndent === Infinity ? 0 : minIndent]
  }

  return [lines.map(line => line.slice(minIndent)).join('\n'), minIndent]
}
