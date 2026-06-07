import {
  type BlockStatement,
  type IfBranchNode,
  type IfNode,
  type NodeTransform,
  NodeTypes,
  createBlockStatement,
  createCallExpression,
  createIfStatement,
  createStructuralDirectiveTransform,
  processIf,
} from '@vue-source/compiler-dom'
import { processChildrenAsStatement } from '../ssrTransformContext'
import type { SSRTransformContext as SSRTransformContextType } from '../ssrTransformTypes'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformIf: NodeTransform = createStructuralDirectiveTransform(
  /^(?:if|else|else-if)$/,
  processIf,
)

// This is called during the 2nd transform pass to construct the SSR-specific
// codegen nodes.
export function ssrProcessIf(
  node: IfNode,
  context: SSRTransformContextType,
  disableNestedFragments = false,
  disableComment = false,
): void {
  // SSR 第二阶段里，v-if 最终会变成真正的 JS if/else 语句，
  // 而不是客户端那种条件 VNode 表达式。
  const [rootBranch] = node.branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context, disableNestedFragments),
  )
  context.pushStatement(ifStatement)

  let currentIf = ifStatement
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i]
    const branchBlockStatement = processIfBranch(
      branch,
      context,
      disableNestedFragments,
    )
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(
        branch.condition,
        branchBlockStatement,
      )
    } else {
      // else
      currentIf.alternate = branchBlockStatement
    }
  }

  if (!currentIf.alternate && !disableComment) {
    // SSR 分支为空时要输出注释占位，保证 hydrate 时节点对齐。
    currentIf.alternate = createBlockStatement([
      createCallExpression(`_push`, ['`<!---->`']),
    ])
  }
}

function processIfBranch(
  branch: IfBranchNode,
  context: SSRTransformContextType,
  disableNestedFragments = false,
): BlockStatement {
  const { children } = branch
  const needFragmentWrapper =
    !disableNestedFragments &&
    (children.length !== 1 || children[0].type !== NodeTypes.ELEMENT) &&
    // optimize away nested fragments when the only child is a ForNode
    !(children.length === 1 && children[0].type === NodeTypes.FOR)
  // 分支里如果不是单个普通元素，SSR 也需要显式 fragment 边界来维持结构稳定。
  return processChildrenAsStatement(branch, context, needFragmentWrapper)
}
