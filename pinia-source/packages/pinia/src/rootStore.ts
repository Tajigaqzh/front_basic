import type {
  App,
  EffectScope,
  InjectionKey,
  Ref,
} from 'vue'
import { hasInjectionContext, inject } from 'vue'
import { IS_CLIENT } from './env'
import type {
  DefineStoreOptionsInPlugin,
  StateTree,
  StoreGeneric,
} from './types'

// 当前进程/模块级别的 active pinia。
// Pinia 官方也保留了这个全局引用，用来支持两类场景：
// 1. 组件外调用 useStore()，没有 inject 上下文时从这里兜底。
// 2. action 执行期间临时恢复当前 pinia，保证嵌套 useStore() 能找到同一个根实例。
export let activePinia: Pinia | undefined

// setActivePinia 的重载签名。
// 这里故意把 `Pinia` 和 `undefined` 分开，阅读类型时可以看到：
// 传入 pinia 返回 pinia，传入 undefined 返回 undefined。
interface _SetActivePinia {
  (pinia: Pinia): Pinia
  (pinia: undefined): undefined
  (pinia: Pinia | undefined): Pinia | undefined
}

// 设置模块级 activePinia。
// 真实 Pinia 在 SSR、测试和组件外调用中都会依赖这个入口。
// @ts-expect-error overload narrowing matches Pinia upstream shape
export const setActivePinia: _SetActivePinia = (pinia) => (activePinia = pinia)

// 获取当前可用 Pinia。
// 优先级：
// 1. 如果当前处于 Vue injection context，优先 inject(piniaSymbol)。
// 2. 如果组件外没有 inject 上下文，就退回 activePinia。
// dev 分支额外输出错误提示，生产分支保留最小逻辑。
export const getActivePinia = __DEV__
  ? (): Pinia | undefined => {
      // `hasInjectionContext()` 避免在组件外直接 inject 触发 Vue warning。
      const pinia = hasInjectionContext() && inject(piniaSymbol)

      // 服务端没有 active pinia 时最容易造成跨请求状态错乱，所以这里显式提示。
      if (!pinia && !IS_CLIENT) {
        console.error(
          '[pinia-source]: Pinia instance not found in current injection context.'
        )
      }

      // inject 成功优先使用组件树上的实例，否则使用模块级 activePinia。
      return pinia || activePinia
    }
  : (): Pinia | undefined =>
      (hasInjectionContext() && inject(piniaSymbol)) || activePinia

// Pinia 根实例结构。
// 对阅读主线来说，最关键的是：
// - `state`: 所有 store 的根状态树。
// - `_p`: 插件队列。
// - `_s`: 已创建 store 的缓存 Map。
// - `_e`: effect scope，用于统一释放响应式副作用。
export interface Pinia {
  // Vue 插件安装入口，对应 `app.use(pinia)`。
  install: (app: App) => void
  // 根状态树：pinia.state.value[storeId] = store state。
  state: Ref<Record<string, StateTree>>
  // 注册插件，插件在 store 创建后执行。
  use(plugin: PiniaPlugin): Pinia
  // 插件数组，`createPinia().use()` 会 push 到这里。
  _p: PiniaPlugin[]
  // 安装 Pinia 的 Vue app，插件上下文会用到。
  _a: App | null
  // Pinia 根 effect scope。
  _e: EffectScope
  // store 缓存，避免同一个 id 重复创建。
  _s: Map<string, StoreGeneric>
  // 测试模式标记，阅读版保留字段以对齐官方结构。
  _testing?: boolean
}

// provide/inject 使用的 key。
// dev 下给 Symbol 命名，调试时更容易识别；prod 下保持无名 Symbol。
export const piniaSymbol = (
  __DEV__ ? Symbol('pinia') : Symbol()
) as InjectionKey<Pinia>

// Pinia 插件执行时收到的上下文。
// 插件可以读取 pinia/app/store/options，并返回扩展对象混入 store。
export interface PiniaPluginContext {
  // 当前根 Pinia。
  pinia: Pinia
  // 当前 Vue app。
  app: App
  // 刚创建完成、准备被扩展的 store。
  store: StoreGeneric
  // defineStore 传入的原始选项，供插件判断 state/actions/getters。
  options: DefineStoreOptionsInPlugin<
    string,
    StateTree,
    Record<string, any>,
    Record<string, any>
  >
}

// 插件函数签名。
// 返回对象时会被 Object.assign 到 store 上，返回 void 表示只做副作用。
export interface PiniaPlugin {
  (context: PiniaPluginContext): Record<string, any> | void
}
