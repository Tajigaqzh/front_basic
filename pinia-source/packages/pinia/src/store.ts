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

type SetupStoreFactory<SS> = (helpers: SetupStoreHelpers) => SS
const skipHydrateSymbol = Symbol('pinia-source:skipHydration')

function registerScopeDispose(unsubscribe: () => void, detached?: boolean) {
  if (detached || !getCurrentScope()) {
    return unsubscribe
  }

  onScopeDispose(unsubscribe)
  return unsubscribe
}

function resolvePinia(pinia?: Pinia | null): Pinia {
  const resolved =
    pinia ||
    (hasInjectionContext() && inject(piniaSymbol, null)) ||
    activePinia ||
    getActivePinia()

  if (!resolved) {
    throw new Error('[pinia-source]: no active Pinia instance.')
  }

  setActivePinia(resolved)
  return resolved
}

function mergeState(target: StateTree, patch: Partial<StateTree>) {
  for (const key in patch) {
    const nextValue = patch[key]
    const targetValue = target[key]

    if (isPlainObject(targetValue) && isPlainObject(nextValue)) {
      mergeState(targetValue, nextValue)
    } else {
      target[key] = nextValue
    }
  }
}

function shouldHydrateStateValue(value: unknown): boolean {
  return (
    !value ||
    typeof value !== 'object' ||
    !Object.prototype.hasOwnProperty.call(value, skipHydrateSymbol)
  )
}

function createBaseStore<Id extends string, S extends StateTree>(
  id: Id,
  pinia: Pinia,
  initialState: S,
  reset: () => void
) {
  const actionSubscriptions = new Set<StoreOnActionListener>()
  const syncSubscriptions = new Set<SubscriptionCallback<S>>()
  const preSubscriptions = new Set<SubscriptionCallback<S>>()
  const postSubscriptions = new Set<SubscriptionCallback<S>>()
  let isListening = true
  let queuedAsyncSubscriptions = false

  if (!(id in pinia.state.value)) {
    pinia.state.value[id] = initialState
  }

  const stopWatcher = watch(
    () => pinia.state.value[id] as S,
    (state) => {
      if (!isListening) {
        return
      }

      const mutation = {
        storeId: id,
        type: MutationType.direct,
      } as const

      triggerSubscriptions(syncSubscriptions, mutation, state)

      if (queuedAsyncSubscriptions) {
        return
      }

      queuedAsyncSubscriptions = true
      nextTick(() => {
        queuedAsyncSubscriptions = false
        const latestState = pinia.state.value[id] as S
        triggerSubscriptions(preSubscriptions, mutation, latestState)
        triggerSubscriptions(postSubscriptions, mutation, latestState)
      })
    },
    {
      deep: true,
      flush: 'sync',
    }
  )

  const store = reactive({
    $id: id,
    $patch(partialState: Partial<S> | ((state: S) => void)) {
      const state = pinia.state.value[id] as S
      isListening = false
      if (typeof partialState === 'function') {
        partialState(state)
        const mutation = {
          storeId: id,
          type: MutationType.patchFunction,
        } as const
        triggerSubscriptions(syncSubscriptions, mutation, state)
        triggerSubscriptions(preSubscriptions, mutation, state)
        triggerSubscriptions(postSubscriptions, mutation, state)
      } else {
        mergeState(state, partialState)
        const mutation = {
          storeId: id,
          type: MutationType.patchObject,
          payload: partialState,
        } as const
        triggerSubscriptions(syncSubscriptions, mutation, state)
        triggerSubscriptions(preSubscriptions, mutation, state)
        triggerSubscriptions(postSubscriptions, mutation, state)
      }
      isListening = true
    },
    $reset() {
      reset()
    },
    $dispose() {
      stopWatcher()
      syncSubscriptions.clear()
      preSubscriptions.clear()
      postSubscriptions.clear()
      actionSubscriptions.clear()
      pinia._s.delete(id)
    },
    $onAction(listener: StoreOnActionListener, detached?: boolean) {
      return registerScopeDispose(
        addSubscription(actionSubscriptions, listener),
        detached
      )
    },
    $subscribe(
      listener: SubscriptionCallback<S>,
      options?: { detached?: boolean; flush?: 'pre' | 'post' | 'sync' }
    ) {
      const flush = options?.flush ?? 'post'
      const target =
        flush === 'sync'
          ? syncSubscriptions
          : flush === 'pre'
            ? preSubscriptions
            : postSubscriptions

      return registerScopeDispose(
        addSubscription(target, listener),
        options?.detached
      )
    },
    _stateKeys: [] as string[],
    _gettersKeys: [] as string[],
    _actionSubscriptions: actionSubscriptions,
  }) as any

  Object.defineProperty(store, '$state', {
    get: () => pinia.state.value[id] as S,
    set: (state: S) => {
      pinia.state.value[id] = state
    },
  })

  pinia._s.set(id, store as StoreGeneric)
  return store as Store<Id, S>
}

function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A,
>(id: Id, options: DefineStoreOptions<Id, S, G, A>, pinia: Pinia) {
  const createState = () => (options.state ? options.state() : ({} as S))
  const state = createState()
  const store = createBaseStore(id, pinia, state, () => {
    const nextState = createState()
    store.$patch(($state: S) => {
      for (const key in $state) {
        if (!(key in nextState)) {
          delete ($state as Record<string, unknown>)[key]
        }
      }
      Object.assign($state, nextState)
    })
  })

  const stateTarget = pinia.state.value[id] as S
  for (const key in stateTarget) {
    store._stateKeys!.push(key)
    Object.defineProperty(store, key, {
      enumerable: true,
      configurable: true,
      get: () => stateTarget[key],
      set: (value) => {
        stateTarget[key] = value
      },
    })
  }

  const actions = (options.actions || {}) as Record<string, (...args: unknown[]) => unknown>
  for (const key in actions) {
    const action = actions[key]
    ;(store as Record<string, unknown>)[key] = function (this: unknown, ...args: unknown[]) {
      return wrapAction(key, action as (...actionArgs: unknown[]) => unknown, store)(...args)
    }
  }

  const getters = options.getters || ({} as G)
  for (const key in getters) {
    const getter = getters[key]
    store._gettersKeys!.push(key)
    const getterValue = computed(() =>
      getter.call(store, store as S & Record<string, any> & Record<keyof typeof store, any>)
    )
    Object.defineProperty(store, key, {
      enumerable: true,
      configurable: true,
      get: () => getterValue.value,
    })
  }

  return store as Store<Id, S, G, A>
}

function wrapAction(
  name: string,
  action: (...args: unknown[]) => unknown,
  store: StoreGeneric
) {
  return function wrappedAction(...args: unknown[]) {
    setActivePinia(store._p || activePinia)

    const afterCallbacks = new Set<(resolvedReturn: unknown) => void>()
    const onErrorCallbacks = new Set<(error: unknown) => void>()

    triggerSubscriptions(store._actionSubscriptions || new Set<StoreOnActionListener>(), {
      name,
      store,
      args,
      after(callback: (resolvedReturn: unknown) => void) {
        afterCallbacks.add(callback)
      },
      onError(callback: (error: unknown) => void) {
        onErrorCallbacks.add(callback)
      },
    })

    let result: unknown
    try {
      result = action.apply(store, args)
    } catch (error) {
      triggerSubscriptions(onErrorCallbacks, error)
      throw error
    }

    if (result instanceof Promise) {
      return result
        .then((resolved) => {
          triggerSubscriptions(afterCallbacks, resolved)
          return resolved
        })
        .catch((error) => {
          triggerSubscriptions(onErrorCallbacks, error)
          return Promise.reject(error)
        })
    }

    triggerSubscriptions(afterCallbacks, result)
    return result
  }
}

function createSetupStore<Id extends string, SS extends Record<string, any>>(
  id: Id,
  setup: SetupStoreFactory<SS>,
  pinia: Pinia,
  options: Record<string, any> = {}
) {
  const initialState = pinia.state.value[id] as Record<string, unknown> | undefined
  const state = (pinia.state.value[id] ||= {})
  const store = createBaseStore(id, pinia, state, () => {
    throw new Error(
      `[pinia-source]: Store "${id}" is built using the setup syntax and does not implement $reset().`
    )
  })
  const setupStore = setup({})

  for (const key in setupStore) {
    const value = setupStore[key]

    if (typeof value === 'function') {
      ;(store as Record<string, unknown>)[key] = wrapAction(
        key,
        value as (...args: unknown[]) => unknown,
        store as StoreGeneric
      )
      continue
    }

    if (isRef(value)) {
      if (
        initialState &&
        key in initialState &&
        shouldHydrateStateValue(value) &&
        (!isReadonly(value) || !_isComputedLike(value))
      ) {
        value.value = initialState[key]
      }

      if (_isComputedLike(value)) {
        store._gettersKeys!.push(key)
      } else {
        store._stateKeys!.push(key)
      }

      if (!isReadonly(value) && !_isComputedLike(value)) {
        Object.defineProperty(state, key, {
          enumerable: true,
          configurable: true,
          get: () => value.value,
          set: (nextValue) => {
            value.value = nextValue
          },
        })
      }

      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        get: () => value.value,
        set: (nextValue) => {
          if (!isReadonly(value)) {
            value.value = nextValue
          }
        },
      })
      continue
    }

    if (isReactive(value) || isPlainObject(value)) {
      store._stateKeys!.push(key)
      if (initialState && key in initialState && shouldHydrateStateValue(value)) {
        const hydratedValue = initialState[key]
        if (isPlainObject(value) && isPlainObject(hydratedValue)) {
          mergeState(value, hydratedValue)
          state[key] = value
        } else {
          state[key] = hydratedValue
        }
      } else {
        state[key] = value
      }
      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        get: () => state[key],
        set: (nextValue) => {
          state[key] = nextValue
        },
      })
      continue
    }

    ;(store as Record<string, unknown>)[key] = value
  }

  applyPlugins(store as StoreGeneric, pinia, options)

  return store as Store<Id, typeof state, Record<string, any>, _ActionsTree>
}

function applyPlugins(store: StoreGeneric, pinia: Pinia, options: Record<string, any> = {}) {
  for (const plugin of pinia._p) {
    const extension = plugin({
      app: pinia._a!,
      pinia,
      store,
      options: {
        ...options,
        actions: options.actions || {},
      },
    })

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
  const isSetupStore = typeof optionsOrSetup === 'function'

  function useStore(pinia?: Pinia | null) {
    const targetPinia = resolvePinia(pinia)

    if (!targetPinia._s.has(id)) {
      const store = isSetupStore
        ? createSetupStore(
            id,
            optionsOrSetup as SetupStoreFactory<Record<string, any>>,
            targetPinia,
            setupOptions
          )
        : createOptionsStore(id, optionsOrSetup as DefineStoreOptions, targetPinia)

      if (!isSetupStore) {
        applyPlugins(
          store as StoreGeneric,
          targetPinia,
          optionsOrSetup as Record<string, any>
        )
      }

      targetPinia._s.set(id, store as StoreGeneric)
    }

    return targetPinia._s.get(id)!
  }

  useStore.$id = id
  return useStore as StoreDefinition
}

export function skipHydrate<T>(obj: T): T {
  return Object.defineProperty(obj as object, skipHydrateSymbol, {}) as T
}

export function shouldHydrate(obj: unknown) {
  return shouldHydrateStateValue(obj)
}
