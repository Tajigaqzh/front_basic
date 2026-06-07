import {
  type ForNode,
  type NodeTransform,
  NodeTypes,
  createCallExpression,
  createForLoopParams,
  createFunctionExpression,
  createStructuralDirectiveTransform,
  processFor,
} from '@vue-source/compiler-dom'
import { processChildrenAsStatement } from '../ssrTransformContext'
import type { SSRTransformContext as SSRTransformContextType } from '../ssrTransformTypes'
import { SSR_RENDER_LIST } from '../runtimeHelpers'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformFor: NodeTransform =
  createStructuralDirectiveTransform('for', processFor)

// This is called during the 2nd transform pass to construct the SSR-specific
// codegen nodes.
export function ssrProcessFor(
  node: ForNode,
  context: SSRTransformContextType,
  disableNestedFragments = false,
): void {
  // SSR 的 v-for 不是生成 renderList vnode 调用结果，而是生成
  // `_ssrRenderList(source, (item, i) => { ..._push(...) })` 这种结构。
  const needFragmentWrapper =
    !disableNestedFragments &&
    (node.children.length !== 1 || node.children[0].type !== NodeTypes.ELEMENT)
  const renderLoop = createFunctionExpression(
    createForLoopParams(node.parseResult),
  )
  renderLoop.body = processChildrenAsStatement(
    node,
    context,
    needFragmentWrapper,
  )
  // v-for always renders a fragment unless explicitly disabled
  if (!disableNestedFragments) {
    // SSR fragment 边界同样靠注释占位，供 hydrate 精确对齐。
    context.pushStringPart(`<!--[-->`)
  }
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [
      node.source,
      renderLoop,
    ]),
  )
  if (!disableNestedFragments) {
    context.pushStringPart(`<!--]-->`)
  }
}
