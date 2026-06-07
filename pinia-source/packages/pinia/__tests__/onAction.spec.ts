import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'
import type { StoreOnActionListenerContext } from '../src/types'

describe('$onAction', () => {
  it('tracks sync actions and after callbacks', () => {
    const pinia = createPinia()
    const useCounter = defineStore('actionCounter', {
      state: () => ({ count: 0 }),
      actions: {
        increment(this: any, step = 1) {
          this.count += step
          return this.count
        },
      },
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    store.$onAction(({ name, args, after }: StoreOnActionListenerContext) => {
      after((result: unknown) => {
        seen({ name, args, result })
      })
    })

    const result = store.increment(2)

    expect(result).toBe(2)
    expect(seen).toHaveBeenCalledWith({
      name: 'increment',
      args: [2],
      result: 2,
    })
  })

  it('tracks async action errors through onError callbacks', async () => {
    const pinia = createPinia()
    const useCounter = defineStore('asyncActionCounter', {
      actions: {
        async fail() {
          throw new Error('boom')
        },
      },
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    store.$onAction(({ onError }: StoreOnActionListenerContext) => {
      onError((error: unknown) => {
        seen((error as Error).message)
      })
    })

    await expect(store.fail()).rejects.toThrow('boom')
    expect(seen).toHaveBeenCalledWith('boom')
  })

  it('auto-removes action subscriptions when the current effect scope is disposed', () => {
    const pinia = createPinia()
    const useCounter = defineStore('scopedActionCounter', {
      state: () => ({ count: 0 }),
      actions: {
        increment(this: any, step = 1) {
          this.count += step
          return this.count
        },
      },
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      store.$onAction(({ name }: StoreOnActionListenerContext) => {
        seen(name)
      })
    })

    store.increment()
    expect(seen).toHaveBeenCalledTimes(1)

    scope.stop()
    store.increment()
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('keeps detached action subscriptions after the current effect scope is disposed', () => {
    const pinia = createPinia()
    const useCounter = defineStore('detachedScopedActionCounter', {
      state: () => ({ count: 0 }),
      actions: {
        increment(this: any, step = 1) {
          this.count += step
          return this.count
        },
      },
    })

    const store = useCounter(pinia) as any
    const seen = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      store.$onAction(({ name }: StoreOnActionListenerContext) => {
        seen(name)
      }, true)
    })

    store.increment()
    expect(seen).toHaveBeenCalledTimes(1)

    scope.stop()
    store.increment()
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
