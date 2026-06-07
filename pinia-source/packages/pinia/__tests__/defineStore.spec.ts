import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'

describe('defineStore', () => {
  it('creates and caches an options store instance', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counter', {
      state: () => ({ count: 1 }),
      getters: {
        double(store) {
          return store.count * 2
        },
      },
      actions: {
        increment(this: any) {
          this.count++
        },
      },
    })

    const counterA = useCounter(pinia) as {
      count: number
      double: number
      increment(): void
    }
    const counterB = useCounter(pinia) as typeof counterA

    expect(counterA).toBe(counterB)
    expect(counterA.count).toBe(1)
    expect(counterA.double).toBe(2)

    counterA.increment()

    expect(counterA.count).toBe(2)
    expect(counterA.double).toBe(4)
    expect(pinia.state.value.counter).toEqual({ count: 2 })
  })

  it('creates a setup store and syncs writable refs to root state', () => {
    const pinia = createPinia()
    const useCounter = defineStore('setupCounter', () => {
      const count = ref(0)
      const name = ref('demo')
      const increment = () => {
        count.value++
      }

      return {
        count,
        name,
        increment,
      }
    })

    const store = useCounter(pinia) as {
      count: number
      name: string
      increment(): void
    }

    expect(store.count).toBe(0)
    expect(store.name).toBe('demo')

    store.increment()
    store.name = 'next'

    expect(store.count).toBe(1)
    expect(store.name).toBe('next')
    expect((pinia.state.value.setupCounter as Record<string, unknown>).count).toBe(1)
    expect((pinia.state.value.setupCounter as Record<string, unknown>).name).toBe('next')
  })
})
