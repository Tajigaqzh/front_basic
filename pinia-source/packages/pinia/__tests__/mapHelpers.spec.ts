import { describe, expect, it } from 'vitest'
import { createPinia } from '../src/createPinia'
import {
  mapActions,
  mapState,
  mapStores,
  mapWritableState,
  setMapStoreSuffix,
} from '../src/mapHelpers'
import { defineStore } from '../src/store'
import { computed, ref } from 'vue'

describe('mapHelpers', () => {
  it('maps state and getters from an options store', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterMap', {
      state: () => ({ count: 2 }),
      getters: {
        double(store) {
          return store.count * 2
        },
      },
    })

    const mapped = mapState(useCounter, ['count', 'double'])
    const ctx = { $pinia: pinia }

    expect(mapped.count.call(ctx)).toBe(2)
    expect(mapped.double.call(ctx)).toBe(4)
  })

  it('maps custom state entries with mapper functions', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterCustomMap', {
      state: () => ({ count: 3 }),
    })

    const mapped = mapState(useCounter, {
      n: 'count',
      triple: (store) => store.count * 3,
    })
    const ctx = { $pinia: pinia }

    expect(mapped.n.call(ctx)).toBe(3)
    expect(mapped.triple.call(ctx)).toBe(9)
  })

  it('maps actions from a store', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterActions', {
      state: () => ({ count: 0 }),
      actions: {
        increment(this: any, step = 1) {
          this.count += step
          return this.count
        },
      },
    })

    const mapped = mapActions(useCounter, ['increment'])
    const ctx = { $pinia: pinia }

    expect(mapped.increment.call(ctx, 2)).toBe(2)
    expect(useCounter(pinia).count).toBe(2)
  })

  it('maps writable state from an options store', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterWritable', {
      state: () => ({ count: 1, label: 'a' }),
    })

    const mapped = mapWritableState(useCounter, ['count', 'label'])
    const ctx = { $pinia: pinia }

    expect(mapped.count.get.call(ctx)).toBe(1)
    mapped.count.set.call(ctx, 4)
    mapped.label.set.call(ctx, 'next')

    expect(useCounter(pinia).count).toBe(4)
    expect(useCounter(pinia).label).toBe('next')
  })

  it('maps writable state from a setup store including writable computed refs', () => {
    const pinia = createPinia()
    const useSetupStore = defineStore('setupWritable', () => {
      const text = ref('initial')
      const upper = computed({
        get: () => text.value.toUpperCase(),
        set: (value: string) => {
          text.value = value
        },
      })

      return {
        text,
        upper,
      }
    })

    const mapped = mapWritableState(useSetupStore, ['text', 'upper'])
    const mappedObject = mapWritableState(useSetupStore, { upperText: 'upper' })
    const ctx = { $pinia: pinia }

    expect(mapped.text.get.call(ctx)).toBe('initial')
    expect(mapped.upper.get.call(ctx)).toBe('INITIAL')
    mapped.text.set.call(ctx, 'changed')
    mapped.upper.set.call(ctx, 'next')
    mappedObject.upperText.set.call(ctx, 'final')

    expect(useSetupStore(pinia).text).toBe('final')
    expect(useSetupStore(pinia).upper).toBe('FINAL')
  })

  it('maps store instances with configurable suffix', () => {
    const pinia = createPinia()
    const useCounter = defineStore('counterStoreMap', {
      state: () => ({ count: 1 }),
    })

    const mappedDefault = mapStores(useCounter)
    expect(mappedDefault.counterStoreMapStore.call({ $pinia: pinia }).count).toBe(1)

    setMapStoreSuffix('')
    const mappedCustom = mapStores(useCounter)
    expect(mappedCustom.counterStoreMap.call({ $pinia: pinia }).count).toBe(1)
    setMapStoreSuffix('Store')
  })
})
