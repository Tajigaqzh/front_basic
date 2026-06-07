export { defineColadaLoader } from '../defineColadaLoader'
// pinia-colada 入口暴露基于 useQuery/defineQuery 的 loader 变体。
export type {
  DataLoaderColadaEntry,
  DataColadaLoaderContext,
  _DefineDataColadaLoaderOptions_Common,
  DefineDataColadaLoaderOptions_LaxData,
  DefineDataColadaLoaderOptions_DefinedData,
  UseDataLoaderColadaResult,
  UseDataLoaderColada_LaxData,
  UseDataLoaderColada_DefinedData,
  // deprecated
  DefineDataColadaLoaderOptions,
} from '../defineColadaLoader'

// export type {
//   UseDataLoader,
//   UseDataLoaderInternals,
//   UseDataLoaderResult,
//   DataLoaderContextBase,
//   DataLoaderEntryBase,
//   DefineDataLoaderOptionsBase,
//   DefineLoaderFn,
//   _DataMaybeLazy,
//   DefineDataLoader,
//   DefineDataLoaderCommit,
// } from '../createDataLoader'
