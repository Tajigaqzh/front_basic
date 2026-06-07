import type { RawSourceMap } from '@vue-source/compiler-core'
import { genCssVarsFromList, parseCssVars } from './style/cssVars'
import { trimStyleCode } from './style/pluginTrim'
import { applyScopedStyle } from './style/pluginScoped'
import {
  type PreprocessLang,
  type StylePreprocessor,
  type StylePreprocessorResults,
  processors,
} from './style/preprocessors'

export interface SFCStyleCompileOptions {
  source: string
  filename: string
  id: string
  scoped?: boolean
  trim?: boolean
  isProd?: boolean
  inMap?: RawSourceMap
  preprocessLang?: PreprocessLang
  preprocessOptions?: any
  preprocessCustomRequire?: (id: string) => unknown
  postcssOptions?: any
  postcssPlugins?: any[]
  /**
   * @deprecated use `inMap` instead.
   */
  map?: RawSourceMap
}

export interface CSSModulesOptions {
  scopeBehaviour?: 'global' | 'local'
  generateScopedName?:
    | string
    | ((name: string, filename: string, css: string) => string)
  hashPrefix?: string
  localsConvention?: 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly'
  exportGlobals?: boolean
  globalModulePaths?: RegExp[]
}

export interface SFCAsyncStyleCompileOptions extends SFCStyleCompileOptions {
  isAsync?: boolean
  modules?: boolean
  modulesOptions?: CSSModulesOptions
}

export interface SFCStyleCompileResults {
  code: string
  map: RawSourceMap | undefined
  errors: Error[]
  rawResult?: undefined
  dependencies: Set<string>
  modules?: Record<string, string>
}

export function compileStyle(
  options: SFCStyleCompileOptions,
): SFCStyleCompileResults {
  // 同步版本只是对内部统一实现做一层薄包装。
  return doCompileStyle({
    ...options,
    isAsync: false,
  }) as SFCStyleCompileResults
}

export function compileStyleAsync(
  options: SFCAsyncStyleCompileOptions,
): Promise<SFCStyleCompileResults> {
  // 异步版本保留和官方 compiler-sfc 接近的 API 形状，
  // 便于未来接入真正异步的样式处理链。
  return Promise.resolve(
    doCompileStyle({
      ...options,
      isAsync: true,
    }) as SFCStyleCompileResults,
  )
}

function doCompileStyle(
  options: SFCAsyncStyleCompileOptions,
): SFCStyleCompileResults | Promise<SFCStyleCompileResults> {
  const {
    filename,
    id,
    scoped = false,
    trim = true,
    isProd = false,
    modules = false,
    preprocessLang,
  } = options

  if (modules) {
    // Keep the public API aligned with the official compiler-sfc surface.
    // Actual CSS modules codegen can be layered in later once this teaching
    // repo grows a real PostCSS pipeline.
  }

  // 先走预处理器，例如 sass/less/stylus 这一层；
  // 如果没配置 preprocessLang，就直接使用原始 style 内容。
  const preprocessor = preprocessLang ? processors[preprocessLang] : null
  const preProcessedSource = preprocessor
    ? preprocess(options, preprocessor)
    : null
  const map = preProcessedSource
    ? preProcessedSource.map
    : options.inMap || options.map
  let code = preProcessedSource ? preProcessedSource.code : options.source

  const dependencies = new Set<string>(
    preProcessedSource ? preProcessedSource.dependencies : [],
  )
  dependencies.delete(filename)

  const errors: Error[] = []
  if (preProcessedSource?.errors.length) {
    errors.push(...preProcessedSource.errors)
  }

  if (trim) {
    // trim 负责清理多余空白，让后续 scoped 改写和 css vars 扫描更稳定。
    code = trimStyleCode(code)
  }
  if (scoped) {
    // scoped 样式真正的选择器改写发生在这里。
    code = applyScopedStyle(code, id)
  }

  const cssVars = parseCssVars(code)
  if (cssVars.length) {
    // 把 style 里出现的 `v-bind(...)` 变量额外记录下来，
    // 方便外层知道该组件依赖哪些响应式 CSS 变量。
    const shortId = id.replace(/^data-v-/, '')
    dependencies.add(`css-vars:${shortId}`)
    code += `\n/* css-vars ${genCssVarsFromList(cssVars, shortId, isProd)} */`
  }

  const result: SFCStyleCompileResults = {
    code,
    map,
    errors,
    rawResult: undefined,
    dependencies,
    modules: undefined,
  }

  return options.isAsync ? Promise.resolve(result) : result
}

function preprocess(
  options: SFCStyleCompileOptions,
  preprocessor: StylePreprocessor,
): StylePreprocessorResults {
  // 这里把统一选项形状转换成具体预处理器期望的调用参数。
  return preprocessor(
    options.source,
    options.inMap || options.map,
    {
      filename: options.filename,
      ...options.preprocessOptions,
    },
    options.preprocessCustomRequire,
  )
}
