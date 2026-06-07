/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 createSlots.ts 负责把编译器生成的动态插槽描述整理成最终 slots 对象。
 *
 * 它主要服务于带 `v-if` / `v-for` 的动态插槽场景，
 * 让运行时后续在 `renderSlot` 中可以像普通插槽一样统一调用。
 */

import { isArray } from '@vue-source/shared'
import type { VNode } from '../vnode'

// #6651 res can be undefined in SSR in string push mode
type SSRSlot = (...args: any[]) => VNode[] | undefined

interface CompiledSlotDescriptor {
  name: string
  fn: SSRSlot
  // `key` 用来区分不同条件分支对应的插槽内容，避免 patch 时被误判成同一批节点。
  key?: string
}

/**
 * 作用：把编译阶段生成的动态插槽描述合并成最终 slots 对象。
 *
 * 参数说明：
 * - `slots`：已有的静态 slots 对象。
 * - `dynamicSlots`：编译器额外生成的动态插槽描述数组。
 */
export function createSlots(
  slots: Record<string, SSRSlot>,
  dynamicSlots: (
    | CompiledSlotDescriptor
    | CompiledSlotDescriptor[]
    | undefined
  )[],
): Record<string, SSRSlot> {
  for (let i = 0; i < dynamicSlots.length; i++) {
    const slot = dynamicSlots[i]
    // `v-for` 生成的是一组同构动态插槽描述，需要逐个平铺进结果对象。
    if (isArray(slot)) {
      for (let j = 0; j < slot.length; j++) {
        slots[slot[j].name] = slot[j].fn
      }
    } else if (slot) {
      // `v-if` 生成的是单个条件插槽，必要时还要给返回结果打 branch key。
      slots[slot.name] = slot.key
        ? (...args: any[]) => {
            const res = slot.fn(...args)
            // branch key 能让不同条件分支在 patch 时被视为不同 fragment。
            if (res) (res as any).key = slot.key
            return res
          }
        : slot.fn
    }
  }
  return slots
}
