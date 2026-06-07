import {
  type ComponentNode,
  type FunctionExpression,
  type SlotsExpression,
  type TemplateChildNode,
  type TransformContext,
  buildSlots,
  createCallExpression,
  createFunctionExpression,
} from '@vue-source/compiler-dom'
import {
  processChildrenAsStatement,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'
import { SSR_RENDER_SUSPENSE } from '../runtimeHelpers'

const wipMap = new WeakMap<ComponentNode, WIPEntry>()

interface WIPEntry {
  slotsExp: SlotsExpression
  wipSlots: Array<{
    fn: FunctionExpression
    children: TemplateChildNode[]
  }>
}

// phase 1
export function ssrTransformSuspense(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    if (node.children.length) {
      // 和组件 slots 一样，Suspense 的 slot 结构必须先在第一阶段借助
      // core 的 buildSlots 完成作用域分析，第二阶段再补 SSR 函数体。
      const wipEntry: WIPEntry = {
        slotsExp: null!, // to be immediately set
        wipSlots: [],
      }
      wipMap.set(node, wipEntry)
      wipEntry.slotsExp = buildSlots(
        node,
        context,
        (_props, _vForExp, children, loc) => {
          const fn = createFunctionExpression(
            [],
            undefined, // no return, assign body later
            true, // newline
            false, // suspense slots are not treated as normal slots
            loc,
          )
          wipEntry.wipSlots.push({
            fn,
            children,
          })
          return fn
        },
      ).slots
    }
  }
}

// phase 2
export function ssrProcessSuspense(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // complete wip slots with ssr code
  const wipEntry = wipMap.get(node)
  if (!wipEntry) {
    return
  }
  const { slotsExp, wipSlots } = wipEntry
  for (let i = 0; i < wipSlots.length; i++) {
    const slot = wipSlots[i]
    // 第二阶段才把每个 slot 的 body 真正填成 `_push(...)` 语句块。
    slot.fn.body = processChildrenAsStatement(slot, context)
  }
  // _push(ssrRenderSuspense(slots))
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_SUSPENSE), [
      `_push`,
      slotsExp,
    ]),
  )
}
