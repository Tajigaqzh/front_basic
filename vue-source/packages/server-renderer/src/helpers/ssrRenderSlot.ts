import {
  type ComponentInternalInstance,
  type Slots,
  ssrUtils,
} from '@vue-source/runtime-dom'
import { isArray } from '@vue-source/shared'
import {
  type Props,
  type PushFn,
  type SSRBufferItem,
} from '../buffer'
import {
  renderVNodeChildren,
} from '../render'

const { ensureValidVNode } = ssrUtils

export type SSRSlots = Record<string, SSRSlot>
export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null,
  scopeId: string | null,
) => void

// 模板编译后的 slot 在 SSR 下始终按 fragment 协议输出，
// 这样客户端 hydration 才能稳定识别 slot 边界。
export function ssrRenderSlot(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  push(`<!--[-->`)
  ssrRenderSlotInner(
    slots,
    slotName,
    slotProps,
    fallbackRenderFn,
    push,
    parentComponent,
    slotScopeId,
  )
  push(`<!--]-->`)
}

export function ssrRenderSlotInner(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
  transition?: boolean,
): void {
  const slotFn = slots[slotName]
  if (slotFn) {
    const slotBuffer: SSRBufferItem[] = []
    const bufferedPush = (item: SSRBufferItem) => {
      slotBuffer.push(item)
    }
    const ret = slotFn(
      slotProps,
      bufferedPush,
      parentComponent,
      slotScopeId ? ' ' + slotScopeId : '',
    )

    // 普通运行时 slot 返回 VNode 数组；SSR 编译 slot 则直接往 buffer 推内容。
    if (isArray(ret)) {
      const validSlotContent = ensureValidVNode(ret)
      if (validSlotContent) {
        renderVNodeChildren(
          push,
          validSlotContent,
          parentComponent,
          slotScopeId,
        )
      } else if (fallbackRenderFn) {
        fallbackRenderFn()
      } else if (transition) {
        push(`<!---->`)
      }
    } else {
      // SSR slot 可能只产出注释节点，这种情况语义上等同“空 slot”，应回退到 fallback。
      let isEmptySlot = true
      if (transition) {
        isEmptySlot = false
      } else {
        for (let i = 0; i < slotBuffer.length; i++) {
          if (!isComment(slotBuffer[i])) {
            isEmptySlot = false
            break
          }
        }
      }

      if (isEmptySlot) {
        if (fallbackRenderFn) {
          fallbackRenderFn()
        }
      } else {
        // Transition/TransitionGroup 在 transform 阶段可能已经处理过 fragment，
        // 这里要避免重复包一层 fragment 注释边界。
        let start = 0
        let end = slotBuffer.length
        if (
          transition &&
          slotBuffer[0] === '<!--[-->' &&
          slotBuffer[end - 1] === '<!--]-->'
        ) {
          start++
          end--
        }

        if (start < end) {
          for (let i = start; i < end; i++) {
            push(slotBuffer[i])
          }
        } else if (transition) {
          push(`<!---->`)
        }
      }
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  } else if (transition) {
    push(`<!---->`)
  }
}

const commentTestRE = /^<!--[\s\S]*-->$/
const commentRE = /<!--[^]*?-->/gm

// 这里不是简单判断“是不是注释字符串”，
// 而是判断一段 slot 输出在去掉注释后是否还剩下真实内容。
function isComment(item: SSRBufferItem) {
  if (typeof item !== 'string' || !commentTestRE.test(item)) return false
  if (item.length <= 8) return true
  return !item.replace(commentRE, '').trim()
}
