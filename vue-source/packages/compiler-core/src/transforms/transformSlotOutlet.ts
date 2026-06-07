import type { NodeTransform, TransformContext } from '../transform'
import {
  type CallExpression,
  type ExpressionNode,
  NodeTypes,
  type SlotOutletNode,
  createCallExpression,
  createFunctionExpression,
  createSimpleExpression,
} from '../ast'
import { isSlotOutlet, isStaticArgOf, isStaticExp } from '../utils'
import { type PropsExpression, buildProps } from './transformElement'
import { ErrorCodes, createCompilerError } from '../errors'
import { RENDER_SLOT } from '../runtimeHelpers'
import { camelize } from '@vue-source/shared'
import { processExpression } from './transformExpression'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { children, loc } = node
    // `<slot/>` 最终会编译成 renderSlot($slots, name, props, fallback, noSlotted)。
    const { slotName, slotProps } = processSlotOutlet(node, context)

    const slotArgs: CallExpression['arguments'] = [
      context.prefixIdentifiers ? `_ctx.$slots` : `$slots`,
      slotName,
      '{}',
      'undefined',
      'true',
    ]
    let expectedLen = 2

    if (slotProps) {
      slotArgs[2] = slotProps
      expectedLen = 3
    }

    if (children.length) {
      // `<slot>` 内部的 fallback 内容会被编译成一个函数，作为 renderSlot 的第 4 个参数。
      slotArgs[3] = createFunctionExpression([], children, false, false, loc)
      expectedLen = 4
    }

    if (context.scopeId && !context.slotted) {
      expectedLen = 5
    }
    slotArgs.splice(expectedLen) // remove unused arguments

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc,
    )
  }
}

interface SlotOutletProcessResult {
  slotName: string | ExpressionNode
  slotProps: PropsExpression | undefined
}

export function processSlotOutlet(
  node: SlotOutletNode,
  context: TransformContext,
): SlotOutletProcessResult {
  // 从 `<slot name="foo" :bar="x" />` 中拆出插槽名和传给父组件的 slot props。
  let slotName: string | ExpressionNode = `"default"`
  let slotProps: PropsExpression | undefined = undefined

  const nonNameProps = []
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.value) {
        if (p.name === 'name') {
          // 静态 `name="foo"` 直接变成字符串字面量。
          slotName = JSON.stringify(p.value.content)
        } else {
          p.name = camelize(p.name)
          nonNameProps.push(p)
        }
      }
    } else {
      if (p.name === 'bind' && isStaticArgOf(p.arg, 'name')) {
        if (p.exp) {
          // `:name="expr"` 走动态插槽名。
          slotName = p.exp
        } else if (p.arg && p.arg.type === NodeTypes.SIMPLE_EXPRESSION) {
          const name = camelize(p.arg.content)
          slotName = p.exp = createSimpleExpression(name, false, p.arg.loc)
          if (!__BROWSER__) {
            slotName = p.exp = processExpression(p.exp, context)
          }
        }
      } else {
        // 其余属性/指令都视为传给 slot 的 props。
        if (p.name === 'bind' && p.arg && isStaticExp(p.arg)) {
          p.arg.content = camelize(p.arg.content)
        }
        nonNameProps.push(p)
      }
    }
  }

  if (nonNameProps.length > 0) {
    // slot outlet 的 props 复用 buildProps 逻辑，但不允许出现额外 directive runtime。
    const { props, directives } = buildProps(
      node,
      context,
      nonNameProps,
      false,
      false,
    )
    slotProps = props

    if (directives.length) {
      // `<slot>` 上除了 name/bind 这类可转成 props 的东西，其他指令都不合法。
      context.onError(
        createCompilerError(
          ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
          directives[0].loc,
        ),
      )
    }
  }

  return {
    slotName,
    slotProps,
  }
}
