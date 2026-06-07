import type { NodeTransform } from '../transform'
import { findDir } from '../utils'
import { type ElementNode, type ForNode, type IfNode, NodeTypes } from '../ast'
import { SET_BLOCK_TRACKING } from '../runtimeHelpers'

const seen = new WeakSet()

export const transformOnce: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) {
    if (seen.has(node) || context.inVOnce || context.inSSR) {
      return
    }
    seen.add(node)
    // v-once 的核心语义：首次渲染后直接复用整棵子树，不再参与后续更新。
    context.inVOnce = true
    context.helper(SET_BLOCK_TRACKING)
    return () => {
      context.inVOnce = false
      const cur = context.currentNode as ElementNode | IfNode | ForNode
      if (cur.codegenNode) {
        // 退出阶段包 cache，确保子树完整 codegen 完成后再整体缓存。
        cur.codegenNode = context.cache(
          cur.codegenNode,
          true /* isVNode */,
          true /* inVOnce */,
        )
      }
    }
  }
}
