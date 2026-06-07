import {
  computed,
  getCurrentScope,
  hasInjectionContext,
  inject,
  isReactive,
  isReadonly,
  isRef,
  nextTick,
  onScopeDispose,
  reactive,
  watch,
} from 'vue'
import { activePinia, getActivePinia, piniaSymbol, setActivePinia } from './rootStore'
import type { Pinia } from './rootStore'
import { MutationType, isComputedLike as _isComputedLike, isPlainObject } from './types'
import type {
  _ActionsTree,
  _ExtractActionsFromSetupStore,
  _ExtractGettersFromSetupStore,
  _ExtractStateFromSetupStore,
  _GettersTree,
  DefineStoreOptions,
  DefineSetupStoreOptions,
  SetupStoreHelpers,
  SubscriptionCallback,
  StateTree,
  Store,
  StoreDefinition,
  StoreGeneric,
  StoreOnActionListener,
} from './types'
import { addSubscription, triggerSubscriptions } from './subscriptions'

// setup store 的工厂函数类型。
// 用户写 `defineStore('id', () => ({ count, inc }))` 时，第二个参数就是这个函数。
type SetupStoreFactory<SS> = (helpers: SetupStoreHelpers) => SS
// 标记某个对象在 hydration 时应该跳过。
// 真实 Pinia 用它处理 router、第三方实例等不该被 SSR state 覆盖的对象。
const skipHydrateSymbol = Symbol('pinia-source:skipHydration')

// 注册组件作用域自动清理。
// `$subscribe()` 和 `$onAction()` 默认跟随当前组件 scope 销毁；
// detached=true 时表示订阅独立存在，需要用户手动取消。
function registerScopeDispose(unsubscribe: () => void, detached?: boolean) {
  // detached=true 或当前没有 effect scope，就只返回 unsubscribe，不做自动清理。
  if (detached || !getCurrentScope()) {
    return unsubscribe
  }

  // 当前在 setup() 等 effect scope 中，组件卸载时自动取消订阅。
  onScopeDispose(unsubscribe)
  // 仍然把 unsubscribe 返回给用户，允许提前取消。
  return unsubscribe
}

// 解析 useStore() 应使用的 Pinia 实例。
// 优先级：显式参数 -> inject -> activePinia -> getActivePinia()。
function resolvePinia(pinia?: Pinia | null): Pinia {
  const resolved =
    // 用户显式传入 pinia 时优先使用，常见于测试或组件外调用。
    pinia ||
    // 组件内调用 useStore() 时，从 Vue provide/inject 读取。
    (hasInjectionContext() && inject(piniaSymbol, null)) ||
    // 组件外或 action 内部兜底使用 activePinia。
    activePinia ||
    // 最后走 rootStore 的统一获取逻辑，dev 下会输出提示。
    getActivePinia()

  // 没有任何 pinia 时，说明用户还没 app.use(pinia) 或没手动传 pinia。
  if (!resolved) {
    throw new Error('[pinia-source]: no active Pinia instance.')
  }

  // 把解析出的 pinia 设置为 active，方便后续嵌套调用复用。
  setActivePinia(resolved)
  return resolved
}

// 深合并 patch object。
// `$patch({ nested: { a: 1 } })` 不应该整体替换 nested，而是递归写入。
function mergeState(target: StateTree, patch: Partial<StateTree>) {
  // 遍历 patch 的每个 key。
  for (const key in patch) {
    // patch 即将写入的新值。
    const nextValue = patch[key]
    // 当前 state 上已有的旧值。
    const targetValue = target[key]

    // 两边都是普通对象时递归合并，保留原对象引用。
    if (isPlainObject(targetValue) && isPlainObject(nextValue)) {
      mergeState(targetValue, nextValue)
    } else {
      // 非普通对象直接替换，包括数组、ref、Date、null 等。
      target[key] = nextValue
    }
  }
}

// 判断 setup store 返回值是否应该被 hydration 覆盖。
function shouldHydrateStateValue(value: unknown): boolean {
  return (
    // 基础类型一定可以 hydrate。
    !value ||
    typeof value !== 'object' ||
    // 对象上没有 skipHydrateSymbol 时才允许 hydrate。
    !Object.prototype.hasOwnProperty.call(value, skipHydrateSymbol)
  )
}

// 创建所有 store 共享的基础外壳。
// option store 和 setup store 都会先经过这里，得到 $id/$state/$patch/$subscribe 等公共 API。
function createBaseStore<Id extends string, S extends StateTree>(
  // store id，也是 pinia.state.value 的 key。
  id: Id,
  // 当前根 pinia。
  pinia: Pinia,
  // 初始 state。
  initialState: S,
  // 不同语法的 $reset 实现不同，所以由调用方传入。
  reset: () => void
) {
  // action 订阅：$onAction 注册到这里。
  const actionSubscriptions = new Set<StoreOnActionListener>()
  // flush sync 的 state 订阅。
  const syncSubscriptions = new Set<SubscriptionCallback<S>>()
  // flush pre 的 state 订阅。
  const preSubscriptions = new Set<SubscriptionCallback<S>>()
  // flush post 的 state 订阅。
  const postSubscriptions = new Set<SubscriptionCallback<S>>()
  // 是否允许根 watch 把直接修改派发给订阅者。
  // $patch 内部会临时关掉，避免重复派发。
  let isListening = true
  // 异步订阅是否已经排队。
  // 多次同步修改只需要在 nextTick 后通知一次 pre/post。
  let queuedAsyncSubscriptions = false

  // 如果根状态树还没有这个 id，就写入初始 state。
  if (!(id in pinia.state.value)) {
    pinia.state.value[id] = initialState
  }

  // 监听当前 store 的根 state。
  // 直接执行 `store.count++` 时，最终会触发这里的 direct mutation。
  const stopWatcher = watch(
    // watch source：始终读取 pinia 根状态树里的当前 store state。
    () => pinia.state.value[id] as S,
    // state 变化后的回调。
    (state) => {
      // $patch 正在批量修改时不走 direct 派发。
      if (!isListening) {
        return
      }

      // 直接修改统一标记为 MutationType.direct。
      const mutation = {
        storeId: id,
        type: MutationType.direct,
      } as const

      // sync 订阅立刻触发，和 Vue watch flush: sync 对齐。
      triggerSubscriptions(syncSubscriptions, mutation, state)

      // pre/post 已经排队时，不再重复安排 nextTick。
      if (queuedAsyncSubscriptions) {
        return
      }

      // 标记已有异步通知队列。
      queuedAsyncSubscriptions = true
      // pre/post 订阅延迟到 nextTick，模拟 Vue watcher 不同 flush 时机。
      nextTick(() => {
        // 进入队列后先复位，下一轮 mutation 可以重新排队。
        queuedAsyncSubscriptions = false
        // nextTick 后重新读取最新 state，避免拿到过期引用。
        const latestState = pinia.state.value[id] as S
        // 触发 pre 订阅。
        triggerSubscriptions(preSubscriptions, mutation, latestState)
        // 触发 post 订阅。
        triggerSubscriptions(postSubscriptions, mutation, latestState)
      })
    },
    {
      // 深度监听 state 内部字段变化。
      deep: true,
      // 同步 flush，这样可以立即识别 direct mutation。
      flush: 'sync',
    }
  )

  // store 本体是 reactive 对象。
  // 公共 API 先放进去，后续 option/setup store 再把 state/getters/actions 追加上来。
  const store = reactive({
    // store id，对外可读。
    $id: id,
    // 批量修改 state。
    $patch(partialState: Partial<S> | ((state: S) => void)) {
      // 始终从 pinia 根状态树读取当前 state。
      const state = pinia.state.value[id] as S
      // 关闭 direct watch 派发，避免 $patch 内每一次字段写入都触发 direct。
      isListening = false
      // 函数写法：用户直接拿 state 修改。
      if (typeof partialState === 'function') {
        // 执行用户传入的 patch 函数。
        partialState(state)
        // 本次 mutation 类型为 patch function。
        const mutation = {
          storeId: id,
          type: MutationType.patchFunction,
        } as const
        // $patch 自己负责通知所有 flush 队列。
        triggerSubscriptions(syncSubscriptions, mutation, state)
        triggerSubscriptions(preSubscriptions, mutation, state)
        triggerSubscriptions(postSubscriptions, mutation, state)
      } else {
        // 对象写法：把 partial state 深合并到当前 state。
        mergeState(state, partialState)
        // 本次 mutation 带 payload，方便 devtools 或订阅者读取。
        const mutation = {
          storeId: id,
          type: MutationType.patchObject,
          payload: partialState,
        } as const
        // 同样由 $patch 统一派发。
        triggerSubscriptions(syncSubscriptions, mutation, state)
        triggerSubscriptions(preSubscriptions, mutation, state)
        triggerSubscriptions(postSubscriptions, mutation, state)
      }
      // 恢复 direct 监听。
      isListening = true
    },
    // 重置 state，具体逻辑由 option/setup store 决定。
    $reset() {
      reset()
    },
    // 销毁当前 store。
    $dispose() {
      // 停止 state watch。
      stopWatcher()
      // 清空所有 state 订阅。
      syncSubscriptions.clear()
      preSubscriptions.clear()
      postSubscriptions.clear()
      // 清空所有 action 订阅。
      actionSubscriptions.clear()
      // 从 pinia 缓存中移除，下次 useStore() 会重新创建。
      pinia._s.delete(id)
    },
    // 注册 action 监听器。
    $onAction(listener: StoreOnActionListener, detached?: boolean) {
      // addSubscription 返回 unsubscribe，再按当前 scope 决定是否自动清理。
      return registerScopeDispose(
        addSubscription(actionSubscriptions, listener),
        detached
      )
    },
    // 注册 state 订阅器。
    $subscribe(
      listener: SubscriptionCallback<S>,
      options?: { detached?: boolean; flush?: 'pre' | 'post' | 'sync' }
    ) {
      // 默认 post，和真实 Pinia 常用行为对齐。
      const flush = options?.flush ?? 'post'
      // 根据 flush 参数选择订阅集合。
      const target =
        flush === 'sync'
          ? syncSubscriptions
          : flush === 'pre'
            ? preSubscriptions
            : postSubscriptions

      // 注册订阅，并按组件 scope 自动清理。
      return registerScopeDispose(
        addSubscription(target, listener),
        options?.detached
      )
    },
    // 记录 state key，storeToRefs 会依赖这个列表。
    _stateKeys: [] as string[],
    // 记录 getter key，storeToRefs 会依赖这个列表。
    _gettersKeys: [] as string[],
    // 暴露 action 订阅集合给 wrapAction 使用。
    _actionSubscriptions: actionSubscriptions,
  }) as any

  // $state 是一个访问器属性，而不是普通字段。
  // 这样可以让 `store.$state = next` 直接替换 pinia 根状态树里的对应 state。
  Object.defineProperty(store, '$state', {
    // 读取当前根状态。
    get: () => pinia.state.value[id] as S,
    // 替换当前根状态。
    set: (state: S) => {
      pinia.state.value[id] = state
    },
  })

  // 先写入缓存，处理循环依赖或插件中再次 useStore 的情况。
  pinia._s.set(id, store as StoreGeneric)
  // 返回公共 store 外壳。
  return store as Store<Id, S>
}

function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A,
>(id: Id, options: DefineStoreOptions<Id, S, G, A>, pinia: Pinia) {
  // options.state 是工厂函数，每次 reset 都要重新执行，避免复用旧对象。
  const createState = () => (options.state ? options.state() : ({} as S))
  // 首次创建 store 时得到初始 state。
  const state = createState()
  // 创建公共 store 外壳，并提供 option store 专属 $reset。
  const store = createBaseStore(id, pinia, state, () => {
    // reset 时重新执行 state()，得到全新的默认状态。
    const nextState = createState()
    // 用 $patch 函数写法统一派发 patchFunction mutation。
    store.$patch(($state: S) => {
      // 删除当前 state 中存在、但新 state 中不存在的 key。
      for (const key in $state) {
        if (!(key in nextState)) {
          delete ($state as Record<string, unknown>)[key]
        }
      }
      // 写入新的默认 state。
      Object.assign($state, nextState)
    })
  })

  // 取根状态树中该 store 的 state。
  // 如果 SSR 或外部提前写入了 pinia.state.value[id]，这里会使用已有 state。
  const stateTarget = pinia.state.value[id] as S
  // 把 state 每个字段代理到 store 上。
  for (const key in stateTarget) {
    // 记录 state key，storeToRefs 需要靠它排除 actions。
    store._stateKeys!.push(key)
    // 定义 store.count <-> pinia.state.value[id].count 的读写代理。
    Object.defineProperty(store, key, {
      enumerable: true,
      configurable: true,
      // 读取 store[key] 时读根状态。
      get: () => stateTarget[key],
      // 写 store[key] 时写根状态，从而触发 watcher 和订阅。
      set: (value) => {
        stateTarget[key] = value
      },
    })
  }

  // 取 actions 对象；没有 actions 时使用空对象。
  const actions = (options.actions || {}) as Record<string, (...args: unknown[]) => unknown>
  // 把每个 action 包装后挂到 store 上。
  for (const key in actions) {
    // 用户原始 action 函数。
    const action = actions[key]
    // 包装后的 action 会处理 activePinia、$onAction、after/onError。
    ;(store as Record<string, unknown>)[key] = function (this: unknown, ...args: unknown[]) {
      return wrapAction(key, action as (...actionArgs: unknown[]) => unknown, store)(...args)
    }
  }

  // 取 getters 对象；没有 getters 时使用空对象。
  const getters = options.getters || ({} as G)
  // 把每个 getter 转成 computed，并代理到 store。
  for (const key in getters) {
    // 用户 getter 函数。
    const getter = getters[key]
    // 记录 getter key，storeToRefs 会把它转成 computed ref。
    store._gettersKeys!.push(key)
    // getterValue 是 Vue computed，负责缓存和依赖追踪。
    const getterValue = computed(() =>
      // this 指向 store，同时把 store 作为第一个参数传入，兼容两种 getter 写法。
      getter.call(store, store as S & Record<string, any> & Record<keyof typeof store, any>)
    )
    // 在 store 上定义只读 getter 属性。
    Object.defineProperty(store, key, {
      enumerable: true,
      configurable: true,
      // 读取 store.double 时实际读取 computed.value。
      get: () => getterValue.value,
    })
  }

  // 返回完整 option store。
  return store as Store<Id, S, G, A>
}

// 包装 action，注入 Pinia action 订阅能力。
function wrapAction(
  // action 名称。
  name: string,
  // 用户原始 action。
  action: (...args: unknown[]) => unknown,
  // 当前 store。
  store: StoreGeneric
) {
  // 返回真正挂到 store 上的函数。
  return function wrappedAction(...args: unknown[]) {
    // action 执行期间恢复 activePinia，方便 action 内部调用其他 useStore()。
    setActivePinia(store._p || activePinia)

    // after 回调集合：action 成功后触发。
    const afterCallbacks = new Set<(resolvedReturn: unknown) => void>()
    // onError 回调集合：action 抛错或 Promise reject 后触发。
    const onErrorCallbacks = new Set<(error: unknown) => void>()

    // 先触发 $onAction 订阅者。
    // 订阅者可以通过 context.after/context.onError 注册后续回调。
    triggerSubscriptions(store._actionSubscriptions || new Set<StoreOnActionListener>(), {
      name,
      store,
      args,
      // 注册成功回调。
      after(callback: (resolvedReturn: unknown) => void) {
        afterCallbacks.add(callback)
      },
      // 注册错误回调。
      onError(callback: (error: unknown) => void) {
        onErrorCallbacks.add(callback)
      },
    })

    // 保存 action 返回值。
    let result: unknown
    try {
      // this 固定为 store，保证 action 内部可以使用 this.count / this.$patch。
      result = action.apply(store, args)
    } catch (error) {
      // 同步异常：先通知 onError，再继续抛出。
      triggerSubscriptions(onErrorCallbacks, error)
      throw error
    }

    // 异步 action：等待 Promise 结果后再触发 after/onError。
    if (result instanceof Promise) {
      return result
        .then((resolved) => {
          // Promise fulfilled，触发 after。
          triggerSubscriptions(afterCallbacks, resolved)
          return resolved
        })
        .catch((error) => {
          // Promise rejected，触发 onError，并保持 reject 语义。
          triggerSubscriptions(onErrorCallbacks, error)
          return Promise.reject(error)
        })
    }

    // 同步成功：立刻触发 after。
    triggerSubscriptions(afterCallbacks, result)
    // 返回原始 action 结果。
    return result
  }
}

// 创建 setup store。
// setup store 的 state/getter/action 都来自 setup() 返回对象，需要逐项分类。
function createSetupStore<Id extends string, SS extends Record<string, any>>(
  // store id。
  id: Id,
  // 用户 setup 函数。
  setup: SetupStoreFactory<SS>,
  // 当前根 pinia。
  pinia: Pinia,
  // setup store 额外选项，主要给插件读取。
  options: Record<string, any> = {}
) {
  // 读取可能已存在的初始 state，常见于 SSR hydration。
  const initialState = pinia.state.value[id] as Record<string, unknown> | undefined
  // 确保根状态树里有该 store 的 state 容器。
  const state = (pinia.state.value[id] ||= {})
  // 创建公共 store 外壳。
  // setup store 默认无法自动 reset，因为它不知道如何重新执行用户闭包并替换所有 ref。
  const store = createBaseStore(id, pinia, state, () => {
    throw new Error(
      `[pinia-source]: Store "${id}" is built using the setup syntax and does not implement $reset().`
    )
  })
  // 执行用户 setup，得到暴露对象。
  const setupStore = setup({})

  // 遍历 setup 返回的每个字段，按 function/ref/reactive/plain/other 分类。
  for (const key in setupStore) {
    // 当前字段值。
    const value = setupStore[key]

    // 函数被视为 action。
    if (typeof value === 'function') {
      // action 需要 wrapAction 才能支持 $onAction。
      ;(store as Record<string, unknown>)[key] = wrapAction(
        key,
        value as (...args: unknown[]) => unknown,
        store as StoreGeneric
      )
      continue
    }

    // ref/computed 都会进入这个分支。
    if (isRef(value)) {
      // hydration：已有 initialState 且没有 skipHydrate 标记时，把服务端状态写回 ref。
      if (
        initialState &&
        key in initialState &&
        shouldHydrateStateValue(value) &&
        (!isReadonly(value) || !_isComputedLike(value))
      ) {
        value.value = initialState[key]
      }

      // computed-like 记为 getter，否则普通 ref 记为 state。
      if (_isComputedLike(value)) {
        store._gettersKeys!.push(key)
      } else {
        store._stateKeys!.push(key)
      }

      // 普通可写 ref 需要同步到 pinia.state.value[id]。
      // computed 或 readonly ref 不写入 state。
      if (!isReadonly(value) && !_isComputedLike(value)) {
        Object.defineProperty(state, key, {
          enumerable: true,
          configurable: true,
          // 根 state 读取时读 ref.value。
          get: () => value.value,
          // 根 state 写入时写 ref.value。
          set: (nextValue) => {
            value.value = nextValue
          },
        })
      }

      // 在 store 上代理 ref/computed。
      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        // store[key] 读取 ref.value。
        get: () => value.value,
        // store[key] 写入 ref.value；readonly ref 不写。
        set: (nextValue) => {
          if (!isReadonly(value)) {
            value.value = nextValue
          }
        },
      })
      continue
    }

    // reactive 对象或普通对象被视为 state。
    if (isReactive(value) || isPlainObject(value)) {
      // 记录 state key。
      store._stateKeys!.push(key)
      // 如果有 hydration state，优先把它合并/写入。
      if (initialState && key in initialState && shouldHydrateStateValue(value)) {
        // 取待 hydration 的值。
        const hydratedValue = initialState[key]
        // 两边都是普通对象时深合并，保留 setup 返回对象的引用。
        if (isPlainObject(value) && isPlainObject(hydratedValue)) {
          mergeState(value, hydratedValue)
          state[key] = value
        } else {
          // 其他对象直接用 hydration 值。
          state[key] = hydratedValue
        }
      } else {
        // 没有 hydration 时，直接把 setup 返回值放入根 state。
        state[key] = value
      }
      // 在 store 上代理到根 state。
      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        // 读取 store[key] 时读根 state。
        get: () => state[key],
        // 写入 store[key] 时写根 state。
        set: (nextValue) => {
          state[key] = nextValue
        },
      })
      continue
    }

    // 其他值，例如常量字符串、数字、非响应式实例，直接挂到 store。
    ;(store as Record<string, unknown>)[key] = value
  }

  // setup store 创建完后立即执行插件。
  applyPlugins(store as StoreGeneric, pinia, options)

  // 返回完整 setup store。
  return store as Store<Id, typeof state, Record<string, any>, _ActionsTree>
}

// 执行 Pinia 插件队列。
function applyPlugins(store: StoreGeneric, pinia: Pinia, options: Record<string, any> = {}) {
  // 插件按 pinia.use() 注册顺序执行。
  for (const plugin of pinia._p) {
    // 插件接收 pinia/app/store/options 上下文。
    const extension = plugin({
      app: pinia._a!,
      pinia,
      store,
      options: {
        ...options,
        actions: options.actions || {},
      },
    })

    // 插件返回对象时，把返回值合并到 store。
    if (extension && typeof extension === 'object') {
      Object.assign(store, extension)
    }
  }
}

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A = {},
>(
  id: Id,
  options: Omit<DefineStoreOptions<Id, S, G, A>, 'actions'> & {
    actions?: A & ThisType<Store<Id, S, G, A>>
  }
): StoreDefinition<Id, S, G, A>
export function defineStore<Id extends string, SS extends Record<string, any>>(
  id: Id,
  setup: SetupStoreFactory<SS>,
  setupOptions?: DefineSetupStoreOptions<
    Id,
    _ExtractStateFromSetupStore<SS>,
    _ExtractGettersFromSetupStore<SS>,
    _ExtractActionsFromSetupStore<SS>
  >
): StoreDefinition<
  Id,
  _ExtractStateFromSetupStore<SS>,
  _ExtractGettersFromSetupStore<SS>,
  _ExtractActionsFromSetupStore<SS>
>
export function defineStore(
  id: string,
  optionsOrSetup: DefineStoreOptions | SetupStoreFactory<Record<string, any>>,
  setupOptions?: Record<string, any>
) {
  // 第二个参数是函数时代表 setup store，否则代表 option store。
  const isSetupStore = typeof optionsOrSetup === 'function'

  // defineStore 不会立即创建 store，而是返回 useStore。
  // 真正创建发生在第一次调用 useStore()。
  function useStore(pinia?: Pinia | null) {
    // 先解析当前应该使用哪个 pinia 根实例。
    const targetPinia = resolvePinia(pinia)

    // 缓存中没有该 id 时才创建。
    if (!targetPinia._s.has(id)) {
      // 根据语法分派到 setup store 或 option store 创建逻辑。
      const store = isSetupStore
        ? createSetupStore(
            id,
            optionsOrSetup as SetupStoreFactory<Record<string, any>>,
            targetPinia,
            setupOptions
          )
        : createOptionsStore(id, optionsOrSetup as DefineStoreOptions, targetPinia)

      // option store 的插件在 option state/getter/action 全部挂载后执行。
      // setup store 已经在 createSetupStore 内执行过。
      if (!isSetupStore) {
        applyPlugins(
          store as StoreGeneric,
          targetPinia,
          optionsOrSetup as Record<string, any>
        )
      }

      // 再次写入缓存，确保最终 store 覆盖 createBaseStore 中的占位。
      targetPinia._s.set(id, store as StoreGeneric)
    }

    // 返回缓存中的 store。
    return targetPinia._s.get(id)!
  }

  // useStore 带上 $id，mapStores 和调试工具会用。
  useStore.$id = id
  // 返回 typed StoreDefinition。
  return useStore as StoreDefinition
}

// 给对象打上 skipHydrate 标记。
// 常用于 setup store 中不希望 SSR state 覆盖的对象。
export function skipHydrate<T>(obj: T): T {
  return Object.defineProperty(obj as object, skipHydrateSymbol, {}) as T
}

// 对外暴露 hydration 判断，方便测试和插件读取。
export function shouldHydrate(obj: unknown) {
  return shouldHydrateStateValue(obj)
}
