export type {
  UseDataLoader,
  UseDataLoaderInternals,
  UseDataLoaderResult,
  DataLoaderContextBase,
  DataLoaderEntryBase,
  DefineDataLoaderOptionsBase_LaxData,
  DefineDataLoaderOptionsBase_DefinedData,
  DefineLoaderFn,
  // deprecated
  DefineDataLoaderOptionsBase,
} from '../createDataLoader'
export { toLazyValue } from '../createDataLoader'
// 这个文件是 data loaders 的“公共入口桶”：
// 把基础 loader 类型、导航守卫导出、上下文工具、symbols 重新聚合。

// new data fetching
export {
  DataLoaderPlugin,
  NavigationResult,
  NavigationResult as _NavigationResult,
  reroute,
  useIsDataLoading,
} from '../navigation-guard'
export type {
  DataLoaderPluginOptions,
  SetupLoaderGuardOptions,
  _DataLoaderRedirectResult,
} from '../navigation-guard'

export {
  getCurrentContext,
  setCurrentContext,
  type _PromiseMerged,
  assign,
  isSubsetOf,
  trackRoute,
  withLoaderContext,
  currentContext,
} from '../utils'

// expose all symbols that could be used by loaders
export * from '../meta-extensions'

export type { ErrorDefault } from '../types-config'
