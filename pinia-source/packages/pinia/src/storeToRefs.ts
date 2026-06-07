import { computed, toRef } from 'vue'
import type { StoreToRefs as StoreToRefsType } from './types'

type StoreWithExtractableRefs = {
  _stateKeys?: string[]
  _gettersKeys?: string[]
  [key: string]: any
}

export function storeToRefs<SS extends StoreWithExtractableRefs>(store: SS): StoreToRefsType<SS> {
  const refs: Record<string, unknown> = {}
  const writableStore = store as Record<string, any>

  for (const key of store._stateKeys || []) {
    refs[key] = toRef(store, key)
  }

  for (const key of store._gettersKeys || []) {
    refs[key] = computed({
      get: () => store[key],
      set: (value) => {
        writableStore[key] = value
      },
    })
  }

  return refs as StoreToRefsType<SS>
}
