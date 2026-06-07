import {
  type ComponentNode,
  type ExpressionNode,
  NodeTypes,
  createCallExpression,
  createFunctionExpression,
  createSimpleExpression,
  findProp,
} from '@vue-source/compiler-dom'
import {
  processChildrenAsStatement,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'
import { SSRErrorCodes, createSSRCompilerError } from '../errors'
import { SSR_RENDER_TELEPORT } from '../runtimeHelpers'

// Note: this is a 2nd-pass codegen transform.
export function ssrProcessTeleport(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // Teleport 的核心不是“渲染自己”，而是把子内容输出到目标容器，
  // 所以 SSR 下直接走专门的 ssrRenderTeleport helper。
  const targetProp = findProp(node, 'to')
  if (!targetProp) {
    context.onError(
      createSSRCompilerError(SSRErrorCodes.X_SSR_NO_TELEPORT_TARGET, node.loc),
    )
    return
  }

  let target: ExpressionNode | undefined
  if (targetProp.type === NodeTypes.ATTRIBUTE) {
    target =
      targetProp.value && createSimpleExpression(targetProp.value.content, true)
  } else {
    target = targetProp.exp
  }
  if (!target) {
    context.onError(
      createSSRCompilerError(
        SSRErrorCodes.X_SSR_NO_TELEPORT_TARGET,
        targetProp.loc,
      ),
    )
    return
  }

  const disabledProp = findProp(node, 'disabled', false, true /* allow empty */)
  const disabled = disabledProp
    ? disabledProp.type === NodeTypes.ATTRIBUTE
      ? `true`
      : disabledProp.exp || `false`
    : `false`

  const contentRenderFn = createFunctionExpression(
    [`_push`],
    undefined, // Body is added later
    true, // newline
    false, // isSlot
    node.loc,
  )
  // 子内容被包装成独立 render 函数，交给 runtime 根据 target/disabled 决定
  // 是输出到 teleport buffer 还是原地输出。
  contentRenderFn.body = processChildrenAsStatement(node, context)
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_TELEPORT), [
      `_push`,
      contentRenderFn,
      target,
      disabled,
      `_parent`,
    ]),
  )
}
