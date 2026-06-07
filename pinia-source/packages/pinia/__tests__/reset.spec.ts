import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'

describe('$reset', () => {
  it('resets an options store back to its initial state', () => {
    const pinia = createPinia()
    const useCounter = defineStore('resettable', {
      state: () => ({
        count: 1,
        name: 'demo',
      }),
    })

    const store = useCounter(pinia) as any
    store.count = 10
    store.name = 'changed'

    store.$reset()

    expect(store.count).toBe(1)
    expect(store.name).toBe('demo')
  })

  it('throws for setup stores', () => {
    const pinia = createPinia()
    const useCounter = defineStore('setupReset', () => {
      const count = ref(0)
      return { count }
    })

    const store = useCounter(pinia) as any

    expect(() => store.$reset()).toThrow(/does not implement \$reset/)
  })
})
