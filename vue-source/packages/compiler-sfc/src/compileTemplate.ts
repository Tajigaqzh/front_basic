import {
  type CodegenResult,
  type CompilerError,
  type CompilerOptions,
  type ElementNode,
  type NodeTransform,
  NodeTypes,
  type ParserOptions,
  type RawSourceMap,
  type RootNode,
  createRoot,
  generateCodeFrame,
} from '@vue-source/compiler-core'
import * as CompilerDOM from '@vue-source/compiler-dom'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'
import {
  type AssetURLOptions,
  type AssetURLTagConfig,
  collectAssetUrlTransforms,
  normalizeOptions,
} from './template/transformAssetUrl'
import { collectSrcsetTransforms } from './template/transformSrcset'
import { genCssVarsFromList } from './style/cssVars'
import { warnOnce } from './warn'

export interface TemplateCompiler {
  compile(source: string | RootNode, options: CompilerOptions): CodegenResult
  parse(template: string, options: ParserOptions): RootNode
}

export interface SFCTemplateCompileOptions {
  source: string
  ast?: RootNode
  filename: string
  id: string
  scoped?: boolean
  slotted?: boolean
  isProd?: boolean
  ssr?: boolean
  ssrCssVars?: string[]
  inMap?: RawSourceMap
  compiler?: TemplateCompiler
  compilerOptions?: CompilerOptions
  preprocessLang?: string
  preprocessOptions?: Record<string, unknown>
  preprocessCustomRequire?: (id: string) => unknown
  transformAssetUrls?: AssetURLOptions | AssetURLTagConfig | boolean
}

export interface SFCTemplateCompileResult {
  code: string
  ast?: RootNode
  preamble?: string
  source: string
  errors: (string | CompilerError | Error)[]
  tips: string[]
  map?: RawSourceMap
}

interface TemplatePreprocessor {
  render(
    source: string,
    options: Record<string, unknown>,
    cb: (err: Error | null, res: string) => void,
  ): void
}

export function compileTemplate(
  options: SFCTemplateCompileOptions,
): SFCTemplateCompileResult {
  // compileTemplate 负责把 `<template>` block 编译成 render 函数字符串。
  // 它本质上是 compiler-dom 的一层 SFC 包装：
  // - 处理预处理器
  // - 注入 scopedId / slotted / SSR CSS vars
  // - 处理 asset url transform 扩展位
  const { preprocessLang, preprocessCustomRequire } = options

  if (preprocessLang) {
    const preprocessor = preprocessCustomRequire
      ? (preprocessCustomRequire(preprocessLang) as TemplatePreprocessor | undefined)
      : undefined

    if (!preprocessor) {
      return {
        code: `export default function render() {}`,
        source: options.source,
        tips: [
          `Component ${options.filename} uses lang ${preprocessLang} for template. Please provide preprocessCustomRequire.`,
        ],
        errors: [
          `Component ${options.filename} uses lang ${preprocessLang} for template, however no preprocessor is available.`,
        ],
      }
    }

    try {
      return doCompileTemplate({
        ...options,
        source: preprocess(options, preprocessor),
        ast: undefined,
      })
    } catch (error) {
      return {
        code: `export default function render() {}`,
        source: options.source,
        tips: [],
        errors: [error as Error],
      }
    }
  }

  return doCompileTemplate(options)
}

function preprocess(
  options: SFCTemplateCompileOptions,
  preprocessor: TemplatePreprocessor,
): string {
  let result = ''
  let error: Error | null = null

  preprocessor.render(
    options.source,
    {
      filename: options.filename,
      ...(options.preprocessOptions || {}),
    },
    (err, res) => {
      error = err
      result = res
    },
  )

  if (error) {
    throw error
  }

  return result
}

function doCompileTemplate(
  options: SFCTemplateCompileOptions,
): SFCTemplateCompileResult {
  const {
    filename,
    scoped,
    slotted,
    inMap,
    source,
    ssr = false,
    ssrCssVars,
    isProd = false,
    compilerOptions = {},
    transformAssetUrls,
  } = options
  let { id, ast: inAST, compiler } = options

  const errors: CompilerError[] = []
  const warnings: CompilerError[] = []

  if (ssr && !ssrCssVars) {
    warnOnce(
      `compileTemplate is called with \`ssr: true\` but no corresponding \`ssrCssVars\` option.`,
    )
  }
  if (!id) {
    warnOnce(`compileTemplate now requires the \`id\` option.`)
    id = ''
  }

  const shortId = id.replace(/^data-v-/, '')
  const longId = `data-v-${shortId}`
  const defaultCompiler = CompilerDOM
  compiler = compiler || defaultCompiler

  if (compiler !== defaultCompiler) {
    inAST = undefined
  }

  if ((inAST as RootNode & { transformed?: boolean } | undefined)?.transformed) {
    // 如果传进来的 AST 已经经历过 transform，这里会重新 parse 成干净模板 AST，
    // 避免重复 transform 后结构不再适合 template 编译。
    const newAST = defaultCompiler.parse(inAST!.source, {
      prefixIdentifiers: true,
      ...(compilerOptions as ParserOptions),
      parseMode: 'sfc',
      onError: error => errors.push(error),
    })
    const template = newAST.children.find(
      node => node.type === NodeTypes.ELEMENT && node.tag === 'template',
    ) as ElementNode | undefined
    inAST = template ? createRoot(template.children, inAST!.source) : undefined
  }

  const nodeTransforms = resolveNodeTransforms(
    compilerOptions.nodeTransforms || [],
    transformAssetUrls,
  )
  const tips = collectTemplateTips(source, transformAssetUrls)

  let result = compiler.compile(inAST || source, {
    // 这里真正进入 compiler-dom -> compiler-core 主编译链。
    mode: 'module',
    prefixIdentifiers: true,
    hoistStatic: true,
    cacheHandlers: true,
    sourceMap: true,
    scopeId: scoped ? longId : undefined,
    slotted,
    ssrCssVars:
      ssr && ssrCssVars && ssrCssVars.length
        ? genCssVarsFromList(ssrCssVars, shortId, isProd, true)
        : '',
    ...(compilerOptions as CompilerOptions),
    hmr: !isProd,
    filename,
    nodeTransforms,
    onError: error => errors.push(error),
    onWarn: warning => warnings.push(warning),
  })

  let map = result.map
  if (inMap && !inAST) {
    if (map) {
      // 预处理器或外部传入的 inMap 会先把 template 映射到“中间源码”，
      // 这里再和 compile 生成的 map 合并，恢复到原始源文件。
      map = mapLines(inMap, map)
    }
    if (errors.length) {
      // 编译报错的位置也要同步回补到原始源码坐标，
      // 否则用户看到的行号只会落在预处理后的中间文本里。
      patchErrors(errors, source, inMap)
    }
  }

  const warningTips = warnings.map(warning => {
    let message = warning.message
    if (warning.loc) {
      message += `\n${generateCodeFrame(
        inAST?.source || source,
        warning.loc.start.offset,
        warning.loc.end.offset,
      )}`
    }
    return message
  })

  return {
    code: result.code,
    ast: result.ast,
    preamble: 'preamble' in result ? result.preamble : undefined,
    source,
    errors: [...errors],
    tips: [...tips, ...warningTips],
    map,
  }
}

function resolveNodeTransforms(
  compilerNodeTransforms: NodeTransform[],
  transformAssetUrls: AssetURLOptions | AssetURLTagConfig | boolean | undefined,
): NodeTransform[] {
  // 正式版 Vue 会在这里插入 asset url 相关 transform；
  // 这个教学仓库先保留扩展位，维持整体编译管线形状。
  // This teaching repo does not yet implement real asset URL AST transforms.
  // Keep the official pipeline shape by reserving the extension point and
  // appending user transforms afterward.
  if (transformAssetUrls === false) {
    return [...compilerNodeTransforms]
  }
  return [...compilerNodeTransforms]
}

function collectTemplateTips(
  source: string,
  transformAssetUrls: AssetURLOptions | AssetURLTagConfig | boolean | undefined,
): string[] {
  if (transformAssetUrls === false) {
    return []
  }

  const normalized = normalizeOptions(
    transformAssetUrls && typeof transformAssetUrls === 'object'
      ? transformAssetUrls
      : {},
  )

  return [
    ...collectAssetUrlTransforms(source, normalized),
    ...collectSrcsetTransforms(source, normalized),
  ]
}

function mapLines(oldMap: RawSourceMap, newMap: RawSourceMap): RawSourceMap {
  // 这里做的是 source map“串接”：
  // newMap: 编译结果 -> 预处理后模板
  // oldMap: 预处理后模板 -> 原始源文件
  // 合并后得到：编译结果 -> 原始源文件
  const oldMapConsumer = new SourceMapConsumer(oldMap)
  const newMapConsumer = new SourceMapConsumer(newMap)
  const mergedMapGenerator = new SourceMapGenerator()

  newMapConsumer.eachMapping(mapping => {
    if (mapping.originalLine == null || mapping.originalColumn == null) {
      return
    }

    const original = oldMapConsumer.originalPositionFor({
      line: mapping.originalLine,
      column: mapping.originalColumn,
    })

    if (original.source == null || original.line == null) {
      return
    }

    mergedMapGenerator.addMapping({
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
      original: {
        line: original.line,
        column: mapping.originalColumn,
      },
      source: original.source,
      name: original.name,
    })
  })

  const generator = mergedMapGenerator as SourceMapGenerator & {
    _sources?: { add: (source: string) => void }
    _sourceRoot?: string
    _file?: string
  }
  ;(oldMapConsumer as SourceMapConsumer & { sources: string[] }).sources.forEach(
    sourceFile => {
      // 同时把原 map 里的 sourcesContent 也搬过来，
      // 这样最终 map 仍能直接展示原始源码内容。
      generator._sources?.add(sourceFile)
      const sourceContent = oldMapConsumer.sourceContentFor(sourceFile, true)
      if (sourceContent != null) {
        mergedMapGenerator.setSourceContent(sourceFile, sourceContent)
      }
    },
  )

  generator._sourceRoot = oldMap.sourceRoot
  generator._file = oldMap.file
  return mergedMapGenerator.toJSON()
}

function patchErrors(
  errors: CompilerError[],
  source: string,
  inMap: RawSourceMap,
) {
  // 某些预处理器只提供了整段 sourcesContent，这里退而求其次：
  // 通过在原文中查找当前 source 片段，把错误坐标整体平移回原文件。
  const originalSource = inMap.sourcesContent?.[0]
  if (!originalSource) {
    return
  }

  const offset = originalSource.indexOf(source)
  if (offset < 0) {
    return
  }

  const lineOffset = originalSource.slice(0, offset).split(/\r?\n/).length - 1
  errors.forEach(error => {
    if (!error.loc) {
      return
    }
    error.loc.start.line += lineOffset
    error.loc.start.offset += offset
    if (error.loc.end !== error.loc.start) {
      error.loc.end.line += lineOffset
      error.loc.end.offset += offset
    }
  })
}
