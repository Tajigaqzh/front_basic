import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'
import { MutationType } from '../src/types'
import type { SubscriptionCallbackMutation, StateTree } from '../src/types'

describe('$subscribe', () => {
  it('tracks direct mutations with the default async subscription timing', async () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribeDirect', {
      state: () => ({ count: 0 }),
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    store.$subscribe((mutation: SubscriptionCallbackMutation<StateTree>, state: StateTree) => {
      seen(mutation, { ...state })
    })

    store.count = 2
    expect(seen).not.toHaveBeenCalled()
    await nextTick()

    expect(seen).toHaveBeenCalledWith(
      {
        storeId: 'subscribeDirect',
        type: MutationType.direct,
      },
      { count: 2 }
    )
  })

  it('tracks patch object and patch function mutations', () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribePatch', {
      state: () => ({ count: 0 }),
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    store.$subscribe((mutation: SubscriptionCallbackMutation<StateTree>, state: StateTree) => {
      seen(mutation, { ...state })
    })

    store.$patch({ count: 3 })
    store.$patch((state: { count: number }) => {
      state.count = 5
    })

    expect(seen).toHaveBeenNthCalledWith(
      1,
      {
        storeId: 'subscribePatch',
        type: MutationType.patchObject,
        payload: { count: 3 },
      },
      { count: 3 }
    )
    expect(seen).toHaveBeenNthCalledWith(
      2,
      {
        storeId: 'subscribePatch',
        type: MutationType.patchFunction,
      },
      { count: 5 }
    )
  })

  it('respects sync and async flush timing for direct mutations', async () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribeFlush', {
      state: () => ({ count: 0 }),
    })

    const store = useCounter(pinia) as any
    const syncSeen = vi.fn()
    const preSeen = vi.fn()
    const postSeen = vi.fn()

    store.$subscribe(syncSeen, { flush: 'sync' })
    store.$subscribe(preSeen, { flush: 'pre' })
    store.$subscribe(postSeen, { flush: 'post' })

    store.count = 1

    expect(syncSeen).toHaveBeenCalledTimes(1)
    expect(preSeen).toHaveBeenCalledTimes(0)
    expect(postSeen).toHaveBeenCalledTimes(0)

    await nextTick()

    expect(preSeen).toHaveBeenCalledTimes(1)
    expect(postSeen).toHaveBeenCalledTimes(1)
  })

  it('stops subscriptions and removes the store from cache after $dispose()', () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribeDispose', {
      state: () => ({ count: 0 }),
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    store.$subscribe(seen, { flush: 'sync', detached: true })
    store.count = 1
    store.$dispose()
    store.count = 2

    const nextStore = useCounter(pinia) as any

    expect(seen).toHaveBeenCalledTimes(1)
    expect(nextStore).not.toBe(store)
    expect(nextStore.count).toBe(2)
  })

  it('auto-removes subscriptions when the current effect scope is disposed', async () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribeScope', {
      state: () => ({ count: 0 }),
    })
    const store = useCounter(pinia) as any
    const seen = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      store.$subscribe(seen, { flush: 'sync' })
    })

    store.count = 1
    expect(seen).toHaveBeenCalledTimes(1)

    scope.stop()
    await nextTick()

    store.count = 2
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('keeps detached subscriptions after the current effect scope is disposed', async () => {
    const pinia = createPinia()
    const useCounter = defineStore('subscribeDetachedScope', {
      state: () => ({ count: 0 }),
    })
    const store = useCounter(pinia) as any
    const seen = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      store.$subscribe(seen, { flush: 'sync', detached: true })
    })

    store.count = 1
    expect(seen).toHaveBeenCalledTimes(1)

    scope.stop()
    await nextTick()

    store.count = 2
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
