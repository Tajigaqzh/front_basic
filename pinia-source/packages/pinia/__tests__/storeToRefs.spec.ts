import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'
import { storeToRefs } from '../src/storeToRefs'

describe('storeToRefs', () => {
  it('extracts state refs and getter refs from an options store', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterRefs', {
      state: () => ({ count: 2 }),
      getters: {
        double(store) {
          return store.count * 2
        },
      },
    })

    const store = useCounter(pinia) as any
    const { count, double } = storeToRefs(store) as any

    expect(count.value).toBe(2)
    expect(double.value).toBe(4)

    count.value = 3

    expect(store.count).toBe(3)
    expect(double.value).toBe(6)
  })

  it('extracts state refs and computed refs from a setup store', () => {
    const pinia = createPinia()
    const useCounter = defineStore('setupRefs', () => {
      const count = ref(1)
      const double = computed(() => count.value * 2)
      return {
        count,
        double,
      }
    })

    const store = useCounter(pinia) as any
    const { count, double } = storeToRefs(store) as any

    expect(count.value).toBe(1)
    expect(double.value).toBe(2)

    count.value = 5

    expect(store.count).toBe(5)
    expect(double.value).toBe(10)
  })
})
