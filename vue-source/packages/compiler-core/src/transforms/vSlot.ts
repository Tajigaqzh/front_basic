import {
  // slots 相关 JS AST 类型与构建函数。
  type CallExpression,
  type ConditionalExpression,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type FunctionExpression,
  NodeTypes,
  type ObjectExpression,
  type Property,
  type SlotsExpression,
  type SourceLocation,
  type TemplateChildNode,
  createArrayExpression,
  createCallExpression,
  createConditionalExpression,
  createFunctionExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
// transform 相关类型。
import type { NodeTransform, TransformContext } from '../transform'
import { ErrorCodes, createCompilerError } from '../errors'
import {
  // slot 相关 AST / 作用域判断工具。
  assert,
  findDir,
  hasScopeRef,
  isCommentOrWhitespace,
  isStaticExp,
  isTemplateNode,
  isVSlot,
  isWhitespaceText,
} from '../utils'
// slots 运行时 helper。
import { CREATE_SLOTS, RENDER_LIST, WITH_CTX } from '../runtimeHelpers'
// v-for 相关复用逻辑。
import { createForLoopParams, finalizeForParseResult } from './vFor'
import { SlotFlags, slotFlagsText } from '@vue-source/shared'

// 动态插槽条件不命中时的兜底值。
const defaultFallback = createSimpleExpression(`undefined`, false)

// A NodeTransform that:
// 1. Tracks scope identifiers for scoped slots so that they don't get prefixed
//    by transformExpression. This is only applied in non-browser builds with
//    { prefixIdentifiers: true }.
// 2. Track v-slot depths so that we know a slot is inside another slot.
//    Note the exit callback is executed before buildSlots() on the same node,
//    so only nested slots see positive numbers.
export const trackSlotScopes: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.COMPONENT ||
      node.tagType === ElementTypes.TEMPLATE)
  ) {
    // We are only checking non-empty v-slot here
    // since we only care about slots that introduce scope variables.
    const vSlot = findDir(node, 'slot')
    if (vSlot) {
      const slotProps = vSlot.exp
      if (!__BROWSER__ && context.prefixIdentifiers) {
        // slot props 会引入新的局部变量，例如 `{ item }`，不能被误改写成 `_ctx.item`。
        slotProps && context.addIdentifiers(slotProps)
      }
      context.scopes.vSlot++
      return () => {
        if (!__BROWSER__ && context.prefixIdentifiers) {
          slotProps && context.removeIdentifiers(slotProps)
        }
        context.scopes.vSlot--
      }
    }
  }
}

// A NodeTransform that tracks scope identifiers for scoped slots with v-for.
// This transform is only applied in non-browser builds with { prefixIdentifiers: true }
export const trackVForSlotScopes: NodeTransform = (node, context) => {
  let vFor
  if (
    isTemplateNode(node) &&
    node.props.some(isVSlot) &&
    (vFor = findDir(node, 'for'))
  ) {
    const result = vFor.forParseResult
    if (result) {
      // `<template v-slot v-for="item in list">` 同时引入 slot 作用域和 v-for 作用域。
      finalizeForParseResult(result, context)
      const { value, key, index } = result
      const { addIdentifiers, removeIdentifiers } = context
      value && addIdentifiers(value)
      key && addIdentifiers(key)
      index && addIdentifiers(index)

      return () => {
        value && removeIdentifiers(value)
        key && removeIdentifiers(key)
        index && removeIdentifiers(index)
      }
    }
  }
}

export type SlotFnBuilder = (
  slotProps: ExpressionNode | undefined,
  vFor: DirectiveNode | undefined,
  slotChildren: TemplateChildNode[],
  loc: SourceLocation,
) => FunctionExpression

// 默认 slot 函数构建器：把 slot 内容包成函数表达式。
const buildClientSlotFn: SlotFnBuilder = (props, _vForExp, children, loc) =>
  createFunctionExpression(
    props,
    children,
    false /* newline */,
    true /* isSlot */,
    children.length ? children[0].loc : loc,
  )

// Instead of being a DirectiveTransform, v-slot processing is called during
// transformElement to build the slots object for a component.
export function buildSlots(
  node: ElementNode,
  context: TransformContext,
  buildSlotFn: SlotFnBuilder = buildClientSlotFn,
): {
  slots: SlotsExpression
  hasDynamicSlots: boolean
} {
  // buildSlots 负责把组件子节点整理成 slots 对象，
  // 最终形态大致是 `{ default: () => [...], foo: (props) => [...] }`。
  context.helper(WITH_CTX)

  const { children, loc } = node
  const slotsProperties: Property[] = []
  const dynamicSlots: (ConditionalExpression | CallExpression)[] = []

  // If the slot is inside a v-for or another v-slot, force it to be dynamic
  // since it likely uses a scope variable.
  let hasDynamicSlots = context.scopes.vSlot > 0 || context.scopes.vFor > 0
  // with `prefixIdentifiers: true`, this can be further optimized to make
  // it dynamic when
  // 1. the slot arg or exp uses the scope variables.
  // 2. the slot children use the scope variables.
  if (!__BROWSER__ && !context.ssr && context.prefixIdentifiers) {
    // prefixIdentifiers 模式下可以更精确分析 slot 是否引用了外层作用域。
    hasDynamicSlots =
      node.props.some(
        prop =>
          isVSlot(prop) &&
          (hasScopeRef(prop.arg, context.identifiers) ||
            hasScopeRef(prop.exp, context.identifiers)),
      ) || children.some(child => hasScopeRef(child, context.identifiers))
  }

  // 1. Check for slot with slotProps on component itself.
  //    <Comp v-slot="{ prop }"/>
  const onComponentSlot = findDir(node, 'slot', true)
  if (onComponentSlot) {
    // 组件自身上的 `v-slot` 等价于默认插槽定义。
    const { arg, exp } = onComponentSlot
    if (arg && !isStaticExp(arg)) {
      hasDynamicSlots = true
    }
    slotsProperties.push(
      createObjectProperty(
        arg || createSimpleExpression('default', true),
        buildSlotFn(exp, undefined, children, loc),
      ),
    )
  }

  // 2. Iterate through children and check for template slots
  //    <template v-slot:foo="{ prop }">
  let hasTemplateSlots = false
  let hasNamedDefaultSlot = false
  const implicitDefaultChildren: TemplateChildNode[] = []
  const seenSlotNames = new Set<string>()
  let conditionalBranchIndex = 0

  for (let i = 0; i < children.length; i++) {
    const slotElement = children[i]
    let slotDir

    if (
      !isTemplateNode(slotElement) ||
      !(slotDir = findDir(slotElement, 'slot', true))
    ) {
      // not a <template v-slot>, skip.
      // 非 `<template v-slot>` 子节点后面可能会并入隐式默认插槽。
      if (slotElement.type !== NodeTypes.COMMENT) {
        implicitDefaultChildren.push(slotElement)
      }
      continue
    }

    if (onComponentSlot) {
      // already has on-component slot - this is incorrect usage.
      context.onError(
        createCompilerError(ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE, slotDir.loc),
      )
      break
    }

    hasTemplateSlots = true
    const { children: slotChildren, loc: slotLoc } = slotElement
    const {
      arg: slotName = createSimpleExpression(`default`, true),
      exp: slotProps,
      loc: dirLoc,
    } = slotDir

    // check if name is dynamic.
    let staticSlotName: string | undefined
    if (isStaticExp(slotName)) {
      staticSlotName = slotName ? slotName.content : `default`
    } else {
      // 动态插槽名天然需要走动态 slots 分支。
      hasDynamicSlots = true
    }

    const vFor = findDir(slotElement, 'for')
    const slotFunction = buildSlotFn(slotProps, vFor, slotChildren, slotLoc)

    // check if this slot is conditional (v-if/v-for)
    let vIf: DirectiveNode | undefined
    let vElse: DirectiveNode | undefined
    if ((vIf = findDir(slotElement, 'if'))) {
      // `<template v-slot v-if>` 会编译成条件插槽分支。
      hasDynamicSlots = true
      dynamicSlots.push(
        createConditionalExpression(
          vIf.exp!,
          buildDynamicSlot(slotName, slotFunction, conditionalBranchIndex++),
          defaultFallback,
        ),
      )
    } else if (
      (vElse = findDir(slotElement, /^else(?:-if)?$/, true /* allowEmpty */))
    ) {
      // `v-else(-if)` 需要回连到前一个动态 slot 条件表达式上。
      // find adjacent v-if
      let j = i
      let prev
      while (j--) {
        prev = children[j]
        if (!isCommentOrWhitespace(prev)) {
          break
        }
      }
      if (prev && isTemplateNode(prev) && findDir(prev, /^(?:else-)?if$/)) {
        __TEST__ && assert(dynamicSlots.length > 0)
        // attach this slot to previous conditional
        let conditional = dynamicSlots[
          dynamicSlots.length - 1
        ] as ConditionalExpression
        while (
          conditional.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
        ) {
          conditional = conditional.alternate
        }
        conditional.alternate = vElse.exp
          ? createConditionalExpression(
              vElse.exp,
              buildDynamicSlot(
                slotName,
                slotFunction,
                conditionalBranchIndex++,
              ),
              defaultFallback,
            )
          : buildDynamicSlot(slotName, slotFunction, conditionalBranchIndex++)
      } else {
        context.onError(
          createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, vElse.loc),
        )
      }
    } else if (vFor) {
      // `<template v-slot v-for>` 最终会变成 renderList(...) 产出的动态 slot 数组。
      hasDynamicSlots = true
      const parseResult = vFor.forParseResult
      if (parseResult) {
        finalizeForParseResult(parseResult, context)
        // Render the dynamic slots as an array and add it to the createSlot()
        // args. The runtime knows how to handle it appropriately.
        dynamicSlots.push(
          createCallExpression(context.helper(RENDER_LIST), [
            parseResult.source,
            createFunctionExpression(
              createForLoopParams(parseResult),
              buildDynamicSlot(slotName, slotFunction),
              true /* force newline */,
            ),
          ]),
        )
      } else {
        context.onError(
          createCompilerError(
            ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION,
            vFor.loc,
          ),
        )
      }
    } else {
      // check duplicate static names
      if (staticSlotName) {
        if (seenSlotNames.has(staticSlotName)) {
          context.onError(
            createCompilerError(
              ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES,
              dirLoc,
            ),
          )
          continue
        }
        seenSlotNames.add(staticSlotName)
        if (staticSlotName === 'default') {
          hasNamedDefaultSlot = true
        }
      }
      // 普通静态命名插槽直接记到 slotsProperties 对象里。
      slotsProperties.push(createObjectProperty(slotName, slotFunction))
    }
  }

  if (!onComponentSlot) {
    const buildDefaultSlotProperty = (
      props: ExpressionNode | undefined,
      children: TemplateChildNode[],
    ) => {
      const fn = buildSlotFn(props, undefined, children, loc)
      if (__COMPAT__ && context.compatConfig) {
        fn.isNonScopedSlot = true
      }
      return createObjectProperty(`default`, fn)
    }

    if (!hasTemplateSlots) {
      // 没有显式 `<template v-slot>` 时，组件 children 直接视为默认插槽。
      // implicit default slot (on component)
      slotsProperties.push(buildDefaultSlotProperty(undefined, children))
    } else if (
      implicitDefaultChildren.length &&
      // #3766
      // with whitespace: 'preserve', whitespaces between slots will end up in
      // implicitDefaultChildren. Ignore if all implicit children are whitespaces.
      !implicitDefaultChildren.every(isWhitespaceText)
    ) {
      // 命名插槽和隐式默认插槽混用时，这里处理默认插槽的兜底归并。
      // implicit default slot (mixed with named slots)
      if (hasNamedDefaultSlot) {
        context.onError(
          createCompilerError(
            ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
            implicitDefaultChildren[0].loc,
          ),
        )
      } else {
        slotsProperties.push(
          buildDefaultSlotProperty(undefined, implicitDefaultChildren),
        )
      }
    }
  }

  const slotFlag = hasDynamicSlots
    ? SlotFlags.DYNAMIC
    : hasForwardedSlots(node.children)
      ? SlotFlags.FORWARDED
      : SlotFlags.STABLE
  // 最终 slots 对象会附带 `_` 标记，告诉 runtime 当前 slots 稳定性。
  let slots = createObjectExpression(
    slotsProperties.concat(
      createObjectProperty(
        `_`,
        // 2 = compiled but dynamic = can skip normalization, but must run diff
        // 1 = compiled and static = can skip normalization AND diff as optimized
        createSimpleExpression(
          slotFlag + (__DEV__ ? ` /* ${slotFlagsText[slotFlag]} */` : ``),
          false,
        ),
      ),
    ),
    loc,
  ) as SlotsExpression
  if (dynamicSlots.length) {
    // 动态 slot 不直接塞进对象，而是交给 createSlots(staticSlots, dynamicSlots)。
    slots = createCallExpression(context.helper(CREATE_SLOTS), [
      slots,
      createArrayExpression(dynamicSlots),
    ]) as SlotsExpression
  }

  return {
    slots,
    hasDynamicSlots,
  }
}

function buildDynamicSlot(
  name: ExpressionNode,
  fn: FunctionExpression,
  index?: number,
): ObjectExpression {
  // 动态 slot 的单项结构形如 `{ name, fn, key? }`。
  const props = [
    createObjectProperty(`name`, name),
    createObjectProperty(`fn`, fn),
  ]
  if (index != null) {
    props.push(
      createObjectProperty(`key`, createSimpleExpression(String(index), true)),
    )
  }
  return createObjectExpression(props)
}

function hasForwardedSlots(children: TemplateChildNode[]): boolean {
  // 如果 slot 被继续透传给更深层组件，则当前 slots 不能视为完全静态。
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case NodeTypes.ELEMENT:
        if (
          child.tagType === ElementTypes.SLOT ||
          hasForwardedSlots(child.children)
        ) {
          return true
        }
        break
      case NodeTypes.IF:
        if (hasForwardedSlots(child.branches)) return true
        break
      case NodeTypes.IF_BRANCH:
      case NodeTypes.FOR:
        if (hasForwardedSlots(child.children)) return true
        break
      default:
        break
    }
  }
  return false
}
