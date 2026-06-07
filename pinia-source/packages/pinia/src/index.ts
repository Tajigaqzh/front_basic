// Pinia 阅读版统一出口。
// 建议阅读顺序：
// 1. createPinia.ts：创建根实例。
// 2. rootStore.ts：activePinia、provide/inject、插件上下文。
// 3. store.ts：defineStore/useStore/store 创建主流程。
// 4. mapHelpers.ts/storeToRefs.ts：辅助 API。
// 5. types.ts：类型推导。

// 根实例创建与销毁。
export { createPinia, disposePinia } from './createPinia'
// 当前 active pinia、inject key 和切换 active pinia 的工具。
export { activePinia, getActivePinia, piniaSymbol, setActivePinia } from './rootStore'
// defineStore 主入口，以及 SSR hydration 相关工具。
export { defineStore, shouldHydrate, skipHydrate } from './store'
// Options API 辅助函数。
export {
  mapActions,
  mapGetters,
  mapState,
  mapStores,
  mapStoreSuffix,
  mapWritableState,
  setMapStoreSuffix,
} from './mapHelpers'
// 把 store 的 state/getter 解构成 refs。
export { storeToRefs } from './storeToRefs'

// 根实例与插件相关类型。
export type { Pinia, PiniaPlugin, PiniaPluginContext } from './rootStore'
// store 定义、state/getter/action、订阅等核心类型。
export type {
  _ActionsTree,
  _GettersTree,
  DefineSetupStoreOptions,
  DefineStoreOptionsBase,
  DefineStoreOptionsInPlugin,
  DefineStoreOptions,
  PiniaCustomProperties,
  PiniaCustomStateProperties,
  StateTree,
  Store,
  StoreDefinition,
  StoreGeneric,
} from './types'
