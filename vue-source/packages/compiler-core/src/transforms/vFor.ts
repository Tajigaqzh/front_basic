// 结构指令 transform 相关能力。
import {
  type NodeTransform,
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  type BlockCodegenNode,
  ConstantTypes,
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  type ForCodegenNode,
  type ForIteratorExpression,
  type ForNode,
  type ForParseResult,
  type ForRenderListExpression,
  NodeTypes,
  type PlainElementNode,
  type RenderSlotCall,
  type SimpleExpressionNode,
  type SlotOutletNode,
  type VNodeCall,
  createBlockStatement,
  createCallExpression,
  createCompoundExpression,
  createFunctionExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
  getVNodeBlockHelper,
  getVNodeHelper,
} from '../ast'
import { ErrorCodes, createCompilerError } from '../errors'
import {
  findDir,
  findProp,
  injectProp,
  isSlotOutlet,
  isTemplateNode,
} from '../utils'
import {
  FRAGMENT,
  IS_MEMO_SAME,
  OPEN_BLOCK,
  RENDER_LIST,
} from '../runtimeHelpers'
import { processExpression } from './transformExpression'
import { validateBrowserExpression } from '../validateExpression'
import { PatchFlags } from '@vue-source/shared'

// v-for 会把元素/模板节点提升成 ForNode，并生成 renderList(...) 结构。
export const transformFor: NodeTransform = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    const { helper, removeHelper } = context
    return processFor(node, dir, context, forNode => {
      // v-for 最终会生成 `renderList(source, (value, key, index) => child)`。
      // create the loop render function expression now, and add the
      // iterator on exit after all children have been traversed
      const renderExp = createCallExpression(helper(RENDER_LIST), [
        forNode.source,
      ]) as ForRenderListExpression
      const isTemplate = isTemplateNode(node)
      const memo = findDir(node, 'memo')
      const keyProp = findProp(node, `key`, false, true)
      const isDirKey = keyProp && keyProp.type === NodeTypes.DIRECTIVE
      let keyExp =
        keyProp &&
        (keyProp.type === NodeTypes.ATTRIBUTE
          ? keyProp.value
            ? createSimpleExpression(keyProp.value.content, true)
            : undefined
          : keyProp.exp)

      const keyProperty = keyExp ? createObjectProperty(`key`, keyExp) : null

      if (!__BROWSER__) {
        // `<template v-for>` 自身之后会被 ForNode 吃掉，所以这里提前处理它上的表达式。
        // #2085 / #5288 process :key and v-memo expressions need to be
        // processed on `<template v-for>`. In this case the node is discarded
        // and never traversed so its binding expressions won't be processed
        // by the normal transforms.
        if (isTemplate && memo) {
          memo.exp = processExpression(
            memo.exp! as SimpleExpressionNode,
            context,
          )
        }
        if ((isTemplate || memo) && keyProperty && isDirKey) {
          keyExp =
            keyProp.exp =
            keyProperty.value =
              processExpression(
                keyProperty.value as SimpleExpressionNode,
                context,
              )
        }
      }

      const isStableFragment =
        forNode.source.type === NodeTypes.SIMPLE_EXPRESSION &&
        forNode.source.constType > ConstantTypes.NOT_CONSTANT
      // 根据数据源稳定性和 key 情况决定 Fragment 的 patchFlag。
      const fragmentFlag = isStableFragment
        ? PatchFlags.STABLE_FRAGMENT
        : keyProp
          ? PatchFlags.KEYED_FRAGMENT
          : PatchFlags.UNKEYED_FRAGMENT

      // 外层先生成一个 Fragment block，内部 children 是 renderList 调用。
      forNode.codegenNode = createVNodeCall(
        context,
        helper(FRAGMENT),
        undefined,
        renderExp,
        fragmentFlag,
        undefined,
        undefined,
        true /* isBlock */,
        !isStableFragment /* disableTracking */,
        false /* isComponent */,
        node.loc,
      ) as ForCodegenNode

      return () => {
        // 退出阶段时，循环体子节点都已经 transform 完，可以决定最终 childBlock。
        // finish the codegen now that all children have been traversed
        let childBlock: BlockCodegenNode
        const { children } = forNode

        // check <template v-for> key placement
        if ((__DEV__ || !__BROWSER__) && isTemplate) {
          node.children.some(c => {
            if (c.type === NodeTypes.ELEMENT) {
              const key = findProp(c, 'key')
              if (key) {
                context.onError(
                  createCompilerError(
                    ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT,
                    key.loc,
                  ),
                )
                return true
              }
            }
          })
        }

        const needFragmentWrapper =
          children.length !== 1 || children[0].type !== NodeTypes.ELEMENT
        const slotOutlet = isSlotOutlet(node)
          ? node
          : isTemplate &&
              node.children.length === 1 &&
              isSlotOutlet(node.children[0])
            ? (node.children[0] as SlotOutletNode) // api-extractor somehow fails to infer this
            : null

        if (slotOutlet) {
          // `<slot v-for>` 走 renderSlot 路径，不走普通元素/Fragment 路径。
          // <slot v-for="..."> or <template v-for="..."><slot/></template>
          childBlock = slotOutlet.codegenNode as RenderSlotCall
          if (isTemplate && keyProperty) {
            // <template v-for="..." :key="..."><slot/></template>
            // we need to inject the key to the renderSlot() call.
            // the props for renderSlot is passed as the 3rd argument.
            injectProp(childBlock, keyProperty, context)
          }
        } else if (needFragmentWrapper) {
          // 多根 `<template v-for>` 每次迭代都包一个 Fragment。
          // <template v-for="..."> with text or multi-elements
          // should generate a fragment block for each loop
          childBlock = createVNodeCall(
            context,
            helper(FRAGMENT),
            keyProperty ? createObjectExpression([keyProperty]) : undefined,
            node.children,
            PatchFlags.STABLE_FRAGMENT,
            undefined,
            undefined,
            true,
            undefined,
            false /* isComponent */,
          )
        } else {
          // 单根普通元素直接复用子元素 codegenNode，但要重新调整 block 状态。
          // Normal element v-for. Directly use the child's codegenNode
          // but mark it as a block.
          childBlock = (children[0] as PlainElementNode)
            .codegenNode as VNodeCall
          if (isTemplate && keyProperty) {
            injectProp(childBlock, keyProperty, context)
          }
          if (childBlock.isBlock !== !isStableFragment) {
            if (childBlock.isBlock) {
              // switch from block to vnode
              removeHelper(OPEN_BLOCK)
              removeHelper(
                getVNodeBlockHelper(context.inSSR, childBlock.isComponent),
              )
            } else {
              // switch from vnode to block
              removeHelper(
                getVNodeHelper(context.inSSR, childBlock.isComponent),
              )
            }
          }
          // 稳定列表可少做 block 跟踪；不稳定列表保留 block 便于高效 diff。
          childBlock.isBlock = !isStableFragment
          if (childBlock.isBlock) {
            helper(OPEN_BLOCK)
            helper(getVNodeBlockHelper(context.inSSR, childBlock.isComponent))
          } else {
            helper(getVNodeHelper(context.inSSR, childBlock.isComponent))
          }
        }

        if (memo) {
          // v-memo 会额外生成“命中缓存则复用旧 vnode”的逻辑。
          const loop = createFunctionExpression(
            createForLoopParams(forNode.parseResult, [
              createSimpleExpression(`_cached`),
            ]),
          )
          loop.body = createBlockStatement([
            createCompoundExpression([`const _memo = (`, memo.exp!, `)`]),
            createCompoundExpression([
              `if (_cached && _cached.el`,
              ...(keyExp ? [` && _cached.key === `, keyExp] : []),
              ` && ${context.helperString(
                IS_MEMO_SAME,
              )}(_cached, _memo)) return _cached`,
            ]),
            createCompoundExpression([`const _item = `, childBlock as any]),
            createSimpleExpression(`_item.memo = _memo`),
            createSimpleExpression(`return _item`),
          ])
          renderExp.arguments.push(
            loop as ForIteratorExpression,
            createSimpleExpression(`_cache`),
            createSimpleExpression(String(context.cached.length)),
          )
          // increment cache count
          context.cached.push(null)
        } else {
          // 普通 v-for 只需要把迭代函数塞给 renderList。
          renderExp.arguments.push(
            createFunctionExpression(
              createForLoopParams(forNode.parseResult),
              childBlock,
              true /* force newline */,
            ) as ForIteratorExpression,
          )
        }
      }
    })
  },
)

// target-agnostic transform used for both Client and SSR
export function processFor(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (forNode: ForNode) => (() => void) | undefined,
): (() => void) | undefined {
  // parser 阶段已经把 v-for 拆成 source/value/key/index，这里直接消费它。
  if (!dir.exp) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_FOR_NO_EXPRESSION, dir.loc),
    )
    return
  }

  const parseResult = dir.forParseResult

  if (!parseResult) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION, dir.loc),
    )
    return
  }

  finalizeForParseResult(parseResult, context)

  const { addIdentifiers, removeIdentifiers, scopes } = context
  const { source, value, key, index } = parseResult

  const forNode: ForNode = {
    type: NodeTypes.FOR,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    objectIndexAlias: index,
    parseResult,
    children: isTemplateNode(node) ? node.children : [node],
  }

  // 用 ForNode 替换原始元素，后续 transform/codegen 都以它为中心继续处理。
  context.replaceNode(forNode)

  // bookkeeping
  scopes.vFor++
  if (!__BROWSER__ && context.prefixIdentifiers) {
    // v-for 别名引入了新的局部作用域，先登记，避免被误改写成 `_ctx.xxx`。
    // scope management
    // inject identifiers to context
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  const onExit = processCodegen && processCodegen(forNode)

  return (): void => {
    scopes.vFor--
    if (!__BROWSER__ && context.prefixIdentifiers) {
      // 离开当前循环作用域时，把这些局部别名从上下文里移除。
      value && removeIdentifiers(value)
      key && removeIdentifiers(key)
      index && removeIdentifiers(index)
    }
    if (onExit) onExit()
  }
}

export function finalizeForParseResult(
  result: ForParseResult,
  context: TransformContext,
): void {
  // parser 只负责按语法拆分；这里继续处理每一段表达式的作用域和前缀。
  if (result.finalized) return

  if (!__BROWSER__ && context.prefixIdentifiers) {
    result.source = processExpression(
      result.source as SimpleExpressionNode,
      context,
    )
    if (result.key) {
      result.key = processExpression(
        result.key as SimpleExpressionNode,
        context,
        true,
      )
    }
    if (result.index) {
      result.index = processExpression(
        result.index as SimpleExpressionNode,
        context,
        true,
      )
    }
    if (result.value) {
      result.value = processExpression(
        result.value as SimpleExpressionNode,
        context,
        true,
      )
    }
  }
  if (__DEV__ && __BROWSER__) {
    // 浏览器开发环境只做表达式合法性校验，不做完整前缀改写。
    validateBrowserExpression(result.source as SimpleExpressionNode, context)
    if (result.key) {
      validateBrowserExpression(
        result.key as SimpleExpressionNode,
        context,
        true,
      )
    }
    if (result.index) {
      validateBrowserExpression(
        result.index as SimpleExpressionNode,
        context,
        true,
      )
    }
    if (result.value) {
      validateBrowserExpression(
        result.value as SimpleExpressionNode,
        context,
        true,
      )
    }
  }
  result.finalized = true
}

export function createForLoopParams(
  { value, key, index }: ForParseResult,
  memoArgs: ExpressionNode[] = [],
): ExpressionNode[] {
  // 生成 renderList 回调参数列表，例如 `(item, key, index)`。
  return createParamsList([value, key, index, ...memoArgs])
}

function createParamsList(
  args: (ExpressionNode | undefined)[],
): ExpressionNode[] {
  // 尾部空参数会被裁掉；中间缺位则用 `_`、`__` 这类占位符补齐位置。
  let i = args.length
  while (i--) {
    if (args[i]) break
  }
  return args
    .slice(0, i + 1)
    .map((arg, i) => arg || createSimpleExpression(`_`.repeat(i + 1), false))
}
