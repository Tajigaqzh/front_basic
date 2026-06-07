import { computed, toRef } from 'vue'
import type { StoreToRefs as StoreToRefsType } from './types'

// storeToRefs 只需要知道 store 暴露了哪些 state/getter key。
// 真实 store 还有 actions、$patch 等字段，但这些不会被提取为 ref。
type StoreWithExtractableRefs = {
  // createBaseStore/createOptionsStore/createSetupStore 会记录 state key。
  _stateKeys?: string[]
  // option getter 和 setup computed 会记录 getter key。
  _gettersKeys?: string[]
  // 允许用字符串 key 读取具体字段。
  [key: string]: any
}

/**
 * 把 store 中的 state/getter 转成 refs。
 *
 * 关键点：
 * - state 使用 `toRef(store, key)`，保持可写。
 * - getter 使用 `computed({ get, set })`，可写 getter 会走 set，不可写 getter 的 set 在运行时无实际效果。
 * - actions 不会进入结果对象。
 */
export function storeToRefs<SS extends StoreWithExtractableRefs>(store: SS): StoreToRefsType<SS> {
  // 最终返回的 refs 容器。
  const refs: Record<string, unknown> = {}
  // 写 getter 时需要绕过只读类型约束，所以准备一个可写视角。
  const writableStore = store as Record<string, any>

  // 遍历 state key。
  for (const key of store._stateKeys || []) {
    // toRef 会把 store[key] 包装成响应式 ref，读写都代理回 store。
    refs[key] = toRef(store, key)
  }

  // 遍历 getter key。
  for (const key of store._gettersKeys || []) {
    // 用 computed 包装 getter，外部解构后仍保持响应式。
    refs[key] = computed({
      // 读取时回到 store getter。
      get: () => store[key],
      // 写入时回到 store 字段；如果底层是只读 getter，实际不会改变。
      set: (value) => {
        writableStore[key] = value
      },
    })
  }

  // 类型层面返回 StoreToRefs<SS>，运行时只包含 state/getter refs。
  return refs as StoreToRefsType<SS>
}
