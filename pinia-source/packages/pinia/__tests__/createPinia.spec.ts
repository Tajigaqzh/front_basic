import { describe, expect, it } from 'vitest'
import { createPinia, disposePinia } from '../src/createPinia'

describe('createPinia', () => {
  it('creates a pinia instance with empty root state', () => {
    const pinia = createPinia()

    expect(pinia.state.value).toEqual({})
    expect(pinia._s.size).toBe(0)
    expect(Array.isArray(pinia._p)).toBe(true)
  })

  it('disposes state, plugins, and store registry', () => {
    const pinia = createPinia()

    pinia.state.value.demo = { count: 1 }
    pinia._s.set('demo', {
      $id: 'demo',
      $state: {},
      $patch() {},
      $reset() {},
      $dispose() {},
      $onAction() {
        return () => {}
      },
      $subscribe() {
        return () => {}
      },
    })
    pinia._p.push(() => {})

    disposePinia(pinia)

    expect(pinia.state.value).toEqual({})
    expect(pinia._s.size).toBe(0)
    expect(pinia._p).toHaveLength(0)
    expect(pinia._a).toBeNull()
  })
})
