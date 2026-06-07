import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type SlotOutletNode,
  TRANSITION,
  TRANSITION_GROUP,
  createCallExpression,
  createFunctionExpression,
  isSlotOutlet,
  processSlotOutlet,
  resolveComponentType,
} from '@vue-source/compiler-dom'
import { SSR_RENDER_SLOT, SSR_RENDER_SLOT_INNER } from '../runtimeHelpers'
import {
  processChildrenAsStatement,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'

export const ssrTransformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { slotName, slotProps } = processSlotOutlet(node, context)

    const args = [
      `_ctx.$slots`,
      slotName,
      slotProps || `{}`,
      // fallback content placeholder. will be replaced in the process phase
      `null`,
      `_push`,
      `_parent`,
    ]

    // inject slot scope id if current template uses :slotted
    if (context.scopeId && context.slotted !== false) {
      args.push(`"${context.scopeId}-s"`)
    }

    let method = SSR_RENDER_SLOT

    // #3989, #9933
    // check if this is a single slot inside a transition wrapper - since
    // transition/transition-group will unwrap the slot fragment into vnode(s)
    // at runtime, we need to avoid rendering the slot as a fragment.
    let parent = context.parent!
    if (parent) {
      const children = parent.children
      // #10743 <slot v-if> in <Transition>
      if (parent.type === NodeTypes.IF_BRANCH) {
        parent = context.grandParent!
      }
      let componentType
      if (
        parent.type === NodeTypes.ELEMENT &&
        parent.tagType === ElementTypes.COMPONENT &&
        ((componentType = resolveComponentType(parent, context, true)) ===
          TRANSITION ||
          componentType === TRANSITION_GROUP) &&
        children.filter(c => c.type === NodeTypes.ELEMENT).length === 1
      ) {
        method = SSR_RENDER_SLOT_INNER
        // Transition/TransitionGroup 内部的单个 slot 不能额外包 fragment，
        // 否则运行时解包后的 vnode 结构会和期望不一致。
        if (!(context.scopeId && context.slotted !== false)) {
          args.push('null')
        }
        args.push('true')
      }
    }

    node.ssrCodegenNode = createCallExpression(context.helper(method), args)
  }
}

export function ssrProcessSlotOutlet(
  node: SlotOutletNode,
  context: SSRTransformContext,
): void {
  const renderCall = node.ssrCodegenNode!

  // has fallback content
  if (node.children.length) {
    // fallback slot 内容要延迟包装成函数，只有真正缺 slot 时才会执行。
    const fallbackRenderFn = createFunctionExpression([])
    fallbackRenderFn.body = processChildrenAsStatement(node, context)
    // _renderSlot(slots, name, props, fallback, ...)
    renderCall.arguments[3] = fallbackRenderFn
  }

  // Forwarded <slot/>. Merge slot scope ids
  if (context.withSlotScopeId) {
    // 转发 `<slot/>` 时，要把当前 slot scopeId 和上层的 `_scopeId` 继续拼起来传下去。
    const slotScopeId = renderCall.arguments[6]
    renderCall.arguments[6] = slotScopeId
      ? `${slotScopeId as string} + _scopeId`
      : `_scopeId`
  }

  context.pushStatement(node.ssrCodegenNode!)
}
