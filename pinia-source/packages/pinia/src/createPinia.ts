import { effectScope, markRaw, ref } from 'vue'
import type { App, Ref } from 'vue'
import { setActivePinia, piniaSymbol } from './rootStore'
import type { Pinia, PiniaPlugin } from './rootStore'
import type { StateTree, StoreGeneric } from './types'

/**
 * 创建 Pinia 根实例。
 *
 * 数据流：
 * 1. 先创建一个独立的 effect scope，后续所有根级响应式状态都挂在这里。
 * 2. 再创建 `state`，它是整个 Pinia 的根状态树，key 是 store id，value 是对应 store 的 state。
 * 3. 最后返回一个被 `markRaw()` 包裹的普通对象，避免 Pinia 实例本身再次被 Vue 代理。
 *
 * 入参：无。
 * 出参：Pinia 根实例。
 */
export function createPinia(): Pinia {
  // 根 scope 负责托管 Pinia 自身的响应式资源，便于后续统一 stop。
  const scope = effectScope(true)

  // `state` 是 Pinia 的单一真相源：
  // `pinia.state.value[storeId]` 永远指向该 store 当前的原始 state。
  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({})
  )!

  // 所有通过 `pinia.use()` 注册的插件都会暂存在这里，
  // 具体执行时机是在 store 首次创建之后。
  const plugins: Pinia['_p'] = []

  // `markRaw()` 避免 Pinia 实例被再次代理，减少不必要的依赖追踪。
  const pinia: Pinia = markRaw({
    /**
     * Vue `app.use(pinia)` 时会调用这里。
     *
     * 入参：
     * - `app`: 当前 Vue 应用实例。
     *
     * 出参：无。
     */
    install(app: App) {
      // 安装时把当前 pinia 设为 active，后续 `useStore()` 就能在组件外兜底取到它。
      setActivePinia(pinia)
      // 记录 app，插件上下文和全局属性都要用。
      pinia._a = app
      // 通过 provide/inject 把 pinia 注入组件树。
      app.provide(piniaSymbol, pinia)
      // 兼容 Options API 场景，允许 `this.$pinia` 访问。
      app.config.globalProperties.$pinia = pinia
    },

    /**
     * 注册 Pinia 插件。
     *
     * 入参：
     * - `plugin`: 插件函数，后续会在每个 store 创建完成后执行。
     *
     * 出参：
     * - 当前 pinia 实例，便于链式调用。
     */
    use(plugin: PiniaPlugin) {
      plugins.push(plugin)
      return this
    },

    // 插件列表。
    _p: plugins,
    // 关联的 Vue app。
    _a: null,
    // Pinia 自己的 effect scope。
    _e: scope,
    // 已实例化的 store 缓存。
    _s: new Map<string, StoreGeneric>(),
    // 根状态树。
    state,
  })

  return pinia
}

/**
 * 销毁 Pinia 根实例。
 *
 * 入参：
 * - `pinia`: 需要销毁的 Pinia 实例。
 *
 * 出参：无。
 */
export function disposePinia(pinia: Pinia) {
  // 先停止根 scope，释放根级响应式副作用。
  pinia._e.stop()
  // 再清空 store 缓存。
  pinia._s.clear()
  // 移除所有插件。
  pinia._p.splice(0)
  // 重置根状态树。
  pinia.state.value = {}
  // 断开与 Vue app 的关联。
  pinia._a = null
}
