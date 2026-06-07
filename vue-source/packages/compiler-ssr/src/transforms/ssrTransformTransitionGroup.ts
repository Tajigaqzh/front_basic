import {
  type AttributeNode,
  type ComponentNode,
  type DirectiveNode,
  type JSChildNode,
  NodeTypes,
  type TransformContext,
  buildProps,
  createCallExpression,
  findProp,
} from '@vue-source/compiler-dom'
import { SSR_RENDER_ATTRS } from '../runtimeHelpers'
import {
  processChildren,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'
import { buildSSRProps } from './ssrTransformElement'

const wipMap = new WeakMap<ComponentNode, WIPEntry>()

interface WIPEntry {
  tag: AttributeNode | DirectiveNode
  propsExp: string | JSChildNode | null
  scopeId: string | null
}

// phase 1: build props
export function ssrTransformTransitionGroup(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    const tag = findProp(node, 'tag')
    if (tag) {
      // TransitionGroup 自己的 props 需要先单独抽出来，
      // 第二阶段再决定外层包裹标签怎么输出。
      const otherProps = node.props.filter(p => p !== tag)
      const { props, directives } = buildProps(
        node,
        context,
        otherProps,
        true /* isComponent */,
        false /* isDynamicComponent */,
        true /* ssr (skip event listeners) */,
      )
      let propsExp = null
      if (props || directives.length) {
        propsExp = createCallExpression(context.helper(SSR_RENDER_ATTRS), [
          buildSSRProps(props, directives, context),
        ])
      }
      wipMap.set(node, {
        tag,
        propsExp,
        scopeId: context.scopeId || null,
      })
    }
  }
}

// phase 2: process children
export function ssrProcessTransitionGroup(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  const entry = wipMap.get(node)
  if (entry) {
    const { tag, propsExp, scopeId } = entry
    if (tag.type === NodeTypes.DIRECTIVE) {
      // dynamic :tag
      // 动态 tag 编译期拿不到最终标签名，只能把开始/结束标签拆开按表达式输出。
      context.pushStringPart(`<`)
      context.pushStringPart(tag.exp!)
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      if (scopeId) {
        context.pushStringPart(` ${scopeId}`)
      }
      context.pushStringPart(`>`)

      processChildren(
        node,
        context,
        false,
        /**
         * TransitionGroup has the special runtime behavior of flattening and
         * concatenating all children into a single fragment (in order for them to
         * be patched using the same key map) so we need to account for that here
         * by disabling nested fragment wrappers from being generated.
         */
        true,
        /**
         * TransitionGroup filters out comment children at runtime and thus
         * doesn't expect comments to be present during hydration. We need to
         * account for that by disabling the empty comment that is otherwise
         * rendered for a falsy v-if that has no v-else specified. (#6715)
         */
        true,
      )
      context.pushStringPart(`</`)
      context.pushStringPart(tag.exp!)
      context.pushStringPart(`>`)
    } else {
      // static tag
      // 静态 tag 就是普通字符串包裹，但 children 仍要按 TransitionGroup 的
      // “扁平 fragment”语义处理。
      context.pushStringPart(`<${tag.value!.content}`)
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      if (scopeId) {
        context.pushStringPart(` ${scopeId}`)
      }
      context.pushStringPart(`>`)
      processChildren(node, context, false, true, true)
      context.pushStringPart(`</${tag.value!.content}>`)
    }
  } else {
    // fragment
    // 没有 tag 时，TransitionGroup 自身不输出包裹元素，只输出扁平 children。
    processChildren(node, context, true, true, true)
  }
}
