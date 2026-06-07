import { describe, expect, it } from 'vitest'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'

describe('pinia plugins', () => {
  it('applies plugin extensions to options stores', () => {
    const pinia = createPinia()

    pinia.use(({ store }) => ({
      upperId: store.$id.toUpperCase(),
    }))

    const useCounter = defineStore('pluginCounter', {
      state: () => ({ count: 1 }),
    })

    const store = useCounter(pinia) as any

    expect(store.upperId).toBe('PLUGINCOUNTER')
  })

  it('applies plugin extensions to setup stores', () => {
    const pinia = createPinia()

    pinia.use(({ store }) => ({
      tagged: `store:${store.$id}`,
    }))

    const useCounter = defineStore('pluginSetup', () => ({
      count: 1,
    }))

    const store = useCounter(pinia) as any

    expect(store.tagged).toBe('store:pluginSetup')
  })

  it('passes setup store options to plugins', () => {
    const pinia = createPinia()
    let seenLabel = ''

    pinia.use(({ options }) => {
      seenLabel = String((options as { label?: string }).label || '')
    })

    const useCounter = defineStore(
      'pluginSetupOptions',
      () => ({
        count: 1,
      }),
      {
        label: 'setup-options',
      } as any
    )

    useCounter(pinia)

    expect(seenLabel).toBe('setup-options')
  })
})
