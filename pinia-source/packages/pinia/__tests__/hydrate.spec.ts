import { computed, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createPinia } from '../src/createPinia'
import { defineStore, shouldHydrate, skipHydrate } from '../src/store'

describe('hydrate helpers', () => {
  it('hydrates setup store refs from existing pinia state', () => {
    const pinia = createPinia()
    pinia.state.value.main = {
      count: 2,
      name: 'hydrated',
      upper: 'next',
    }

    const useMain = defineStore('main', () => {
      const count = ref(0)
      const name = ref('local')
      const upper = computed({
        get: () => name.value.toUpperCase(),
        set: (value: string) => {
          name.value = value
        },
      })

      return {
        count,
        name,
        upper,
      }
    })

    const store = useMain(pinia)

    expect(store.count).toBe(2)
    expect(store.name).toBe('next')
    expect(store.upper).toBe('NEXT')
  })

  it('skips hydration for marked reactive values in setup stores', () => {
    const pinia = createPinia()
    pinia.state.value.main = {
      items: [1, 2, 3],
    }

    const useMain = defineStore('main', () => ({
      items: skipHydrate(reactive([] as number[])),
    }))

    const store = useMain(pinia)

    expect(store.items).toEqual([])
    store.items.push(4)
    expect(store.items).toEqual([4])
  })

  it('shouldHydrate reflects skipHydrate markers', () => {
    expect(shouldHydrate({})).toBe(true)
    expect(shouldHydrate(skipHydrate({ a: 1 }))).toBe(false)
    expect(shouldHydrate(skipHydrate(new Map()))).toBe(false)
    expect(shouldHydrate(null)).toBe(true)
    expect(shouldHydrate(1)).toBe(true)
  })
})
