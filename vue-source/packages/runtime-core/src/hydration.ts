/**
 * 文件作用：实现服务端渲染后的客户端激活（hydration）逻辑。
 *
 * 它负责把“服务端已经输出好的真实 DOM”与“客户端重新生成的 VNode 树”对齐，
 * 在尽量复用现有节点的前提下补齐事件、组件实例和后续更新能力。
 *
 * 和普通 mount 的区别在于：
 * - 普通 mount 以 VNode 为准创建新 DOM
 * - hydration 以现有 DOM 为起点，把它激活成可继续更新的客户端树
 */

import {
  Fragment,
  Static,
  Text,
  Comment as VComment,
  type VNode,
  type VNodeHook,
  createTextVNode,
  createVNode,
  invokeVNodeHook,
  normalizeVNode,
} from './vnode'
import { flushPostFlushCbs } from './scheduler'
import type { ComponentInternalInstance, ComponentOptions } from './component'
import { invokeDirectiveHook } from './directives'
import { warn } from './warning'
import {
  PatchFlags,
  ShapeFlags,
  def,
  getEscapedCssVarName,
  includeBooleanAttr,
  isBooleanAttr,
  isKnownHtmlAttr,
  isKnownSvgAttr,
  isOn,
  isRenderableAttrValue,
  isReservedProp,
  isString,
  normalizeClass,
  normalizeCssVarValue,
  normalizeStyle,
  stringifyStyle,
} from '@vue-source/shared'
import { type RendererInternals, needTransition } from './renderer'
import { setRef } from './rendererTemplateRef'
import {
  type SuspenseBoundary,
  type SuspenseImpl,
  queueEffectWithSuspense,
} from './components/Suspense'
import type { TeleportImpl, TeleportVNode } from './components/Teleport'
import { isAsyncWrapper } from './apiAsyncComponent'
import { isReactive } from '@vue-source/reactivity'
import { updateHOCHostEl } from './componentRenderUtils'

export type RootHydrateFunction = (
  vnode: VNode<Node, Element>,
  container: (Element | ShadowRoot) & { _vnode?: VNode },
) => void

export enum DOMNodeTypes {
  ELEMENT = 1,
  TEXT = 3,
  COMMENT = 8,
}

let hasLoggedMismatchError = false
// mismatch 只需要打一次总错误，避免控制台被大量重复日志淹没。
const logMismatchError = () => {
  if (__TEST__ || hasLoggedMismatchError) {
    return
  }
  // this error should show up in production
  console.error('Hydration completed but contains mismatches.')
  hasLoggedMismatchError = true
}

/**
 * 作用：判断一个容器是否是 SVG 根容器。
 */
const isSVGContainer = (container: Element) =>
  container.namespaceURI!.includes('svg') &&
  container.tagName !== 'foreignObject'

/**
 * 作用：判断一个容器是否是 MathML 根容器。
 */
const isMathMLContainer = (container: Element) =>
  container.namespaceURI!.includes('MathML')

/**
 * 作用：把宿主容器转换成渲染器使用的命名空间类型。
 */
const getContainerType = (
  container: Element | ShadowRoot,
): 'svg' | 'mathml' | undefined => {
  if (container.nodeType !== DOMNodeTypes.ELEMENT) return undefined
  if (isSVGContainer(container as Element)) return 'svg'
  if (isMathMLContainer(container as Element)) return 'mathml'
  return undefined
}

export const isComment = (node: Node): node is Comment =>
  node.nodeType === DOMNodeTypes.COMMENT

/**
 * 作用：创建整套 hydration 入口函数。
 *
 * 返回值：
 * - 返回两个函数：根级 `hydrate` 和递归级 `hydrateNode`。
 */
export function createHydrationFunctions(
  rendererInternals: RendererInternals<Node, Element>,
): [
  RootHydrateFunction,
  (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized?: boolean,
  ) => Node | null,
] {
  const {
    mt: mountComponent,
    p: patch,
    o: {
      patchProp,
      createText,
      nextSibling,
      parentNode,
      remove,
      insert,
      createComment,
    },
  } = rendererInternals

  /**
   * 作用：从服务端已有 DOM 根节点开始，把 vnode 树激活成客户端可继续更新的运行时树。
   */
  const hydrate: RootHydrateFunction = (vnode, container) => {
    if (!container.hasChildNodes()) {
      ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warn(
          `Attempting to hydrate existing markup but container is empty. ` +
            `Performing full mount instead.`,
        )
      patch(null, vnode, container)
      flushPostFlushCbs()
      container._vnode = vnode
      return
    }

    // hydration 总是从容器第一个现有子节点开始“消费”服务端 DOM。
    hydrateNode(container.firstChild!, vnode, null, null, null)
    flushPostFlushCbs()
    container._vnode = vnode
  }

  /**
   * 作用：递归比对当前真实 DOM 节点和目标 vnode，并把该节点“接管”为客户端 vnode。
   *
   * 返回值：
   * - 返回当前 vnode 处理完成后，下一个尚未消费的兄弟节点。
   */
  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized = false,
  ): Node | null => {
    optimized = optimized || !!vnode.dynamicChildren
    // Fragment 在服务端会带注释锚点，这里先识别当前位置是不是片段起点。
    const isFragmentStart = isComment(node) && node.data === '['
    const onMismatch = () =>
      handleMismatch(
        node,
        vnode,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        isFragmentStart,
      )
    // mismatch 处理闭包里顺手带上“当前位置是否其实是 fragment 起点”，
    // 因为 fragment 失配时不能只删当前注释，还要考虑整段边界清理。

    const { type, ref, shapeFlag, patchFlag } = vnode
    let domType = node.nodeType
    // hydration 不创建新 DOM，而是把现有节点直接绑定到 vnode.el。
    vnode.el = node

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      def(node, '__vnode', vnode, true)
      def(node, '__vueParentComponent', parentComponent, true)
    }

    if (patchFlag === PatchFlags.BAIL) {
      optimized = false
      vnode.dynamicChildren = null
    }

    let nextNode: Node | null = null
    switch (type) {
      case Text:
        if (domType !== DOMNodeTypes.TEXT) {
          // 空文本在 SSR HTML 中通常会被省掉，客户端需要按 vnode 补一个出来。
          if (vnode.children === '') {
            insert((vnode.el = createText('')), parentNode(node)!, node)
            nextNode = node
          } else {
            nextNode = onMismatch()
          }
        } else {
          if ((node as Text).data !== vnode.children) {
            ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              warn(
                `Hydration text mismatch in`,
                node.parentNode,
                `\n  - rendered on server: ${JSON.stringify(
                  (node as Text).data,
                )}` +
                  `\n  - expected on client: ${JSON.stringify(vnode.children)}`,
              )
            logMismatchError()
            ;(node as Text).data = vnode.children as string
          }
          // 文本 vnode 只消费当前这个文本节点，所以下一个待处理节点就是它的下一个兄弟。
          nextNode = nextSibling(node)
        }
        break
      case VComment:
        if (isTemplateNode(node)) {
          nextNode = nextSibling(node)
          // `<transition appear>` hydrate 时可能先落在 template 上，这里替换成真实内容节点。
          replaceNode(
            (vnode.el = node.content.firstChild!),
            node,
            parentComponent,
          )
        } else if (domType !== DOMNodeTypes.COMMENT || isFragmentStart) {
          nextNode = onMismatch()
        } else {
          nextNode = nextSibling(node)
        }
        break
      case Static:
        if (isFragmentStart) {
          // 整段静态内容在服务端可能被包成 fragment，这里先跳过起始锚点。
          node = nextSibling(node)!
          domType = node.nodeType
        }
        if (domType === DOMNodeTypes.ELEMENT || domType === DOMNodeTypes.TEXT) {
          // 静态节点不会逐个 patch，只需要接管现有 DOM 并记录结束锚点。
          nextNode = node
          // 如果构建时裁掉了静态 vnode 的 children 文本，这里反向从服务端 DOM 收养回来。
          const needToAdoptContent = !(vnode.children as string).length
          for (let i = 0; i < vnode.staticCount!; i++) {
            if (needToAdoptContent)
              vnode.children +=
                nextNode.nodeType === DOMNodeTypes.ELEMENT
                  ? (nextNode as Element).outerHTML
                  : (nextNode as Text).data
            if (i === vnode.staticCount! - 1) {
              vnode.anchor = nextNode
            }
            nextNode = nextSibling(nextNode)!
          }
          return isFragmentStart ? nextSibling(nextNode) : nextNode
        } else {
          onMismatch()
        }
        break
      case Fragment:
        if (!isFragmentStart) {
          nextNode = onMismatch()
        } else {
          // Fragment hydration 的真正工作是递归接管它锚点之间那一整段子节点。
          nextNode = hydrateFragment(
            node as Comment,
            vnode,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized,
          )
        }
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          if (
            (domType !== DOMNodeTypes.ELEMENT ||
              (vnode.type as string).toLowerCase() !==
                (node as Element).tagName.toLowerCase()) &&
            !isTemplateNode(node)
          ) {
            nextNode = onMismatch()
          } else {
            nextNode = hydrateElement(
              node as Element,
              vnode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized,
            )
          }
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件 vnode 只要已经拿到 `.el`，后续 setupRenderEffect 就会走 hydrate 而不是 full mount。
          vnode.slotScopeIds = slotScopeIds
          const container = parentNode(node)!

          // 组件根可能是 fragment、teleport 等特殊结构，要先定位它消费完后的下一个节点。
          if (isFragmentStart) {
            nextNode = locateClosingAnchor(node)
          } else if (isComment(node) && node.data === 'teleport start') {
            nextNode = locateClosingAnchor(node, node.data, 'teleport end')
          } else {
            nextNode = nextSibling(node)
          }

          mountComponent(
            vnode,
            container,
            null,
            parentComponent,
            parentSuspense,
            getContainerType(container),
            optimized,
          )

          // 异步组件真正解析前，也要先放一个能对应现有 DOM 的占位 vnode，避免后续移动/卸载出错。
          if (
            isAsyncWrapper(vnode) &&
            !(vnode.type as ComponentOptions).__asyncResolved
          ) {
            // 异步包装组件尚未 resolve 时，只能先伪造一个与现有 DOM 对齐的 subTree 占位。
            let subTree
            if (isFragmentStart) {
              subTree = createVNode(Fragment)
              subTree.anchor = nextNode
                ? nextNode.previousSibling
                : container.lastChild
            } else {
              subTree =
                node.nodeType === 3 ? createTextVNode('') : createVNode('div')
            }
            subTree.el = node
            vnode.component!.subTree = subTree
          }
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          if (domType !== DOMNodeTypes.COMMENT) {
            nextNode = onMismatch()
          } else {
            // Teleport 自己知道目标容器、起止锚点和内容分布，hydrate 也必须交给它专门处理。
            nextNode = (vnode.type as typeof TeleportImpl).hydrate(
              node,
              vnode as TeleportVNode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized,
              rendererInternals,
              hydrateChildren,
            )
          }
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          // Suspense 自己会创建边界对象，并决定当前 DOM 应该按内容分支还是 fallback 分支接管。
          nextNode = (vnode.type as typeof SuspenseImpl).hydrate(
            node,
            vnode,
            parentComponent,
            parentSuspense,
            getContainerType(parentNode(node)!),
            slotScopeIds,
            optimized,
            rendererInternals,
            hydrateNode,
          )
        } else if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
          warn('Invalid HostVNode type:', type, `(${typeof type})`)
        }
    }

    if (ref != null) {
      // hydration 虽然不创建 DOM，但 ref 绑定语义和普通挂载一致，仍要补上。
      setRef(ref, null, parentSuspense, vnode)
    }

    return nextNode
  }

  /**
   * 作用：接管单个真实元素节点，并完成子节点、props、指令、过渡相关的 hydration。
   */
  const hydrateElement = (
    el: Element,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => {
    optimized = optimized || !!vnode.dynamicChildren
    const { type, props, patchFlag, shapeFlag, dirs, transition } = vnode
    // 表单元素上某些值即使 SSR 输出正确，也必须在客户端再补一次 prop patch。
    const forcePatch = type === 'input' || type === 'option'
    // 静态提升节点可跳过大部分接管逻辑；开发环境为了 HMR 仍会继续下探。
    if (__DEV__ || forcePatch || patchFlag !== PatchFlags.CACHED) {
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created')
      }

      // appear 过渡在 hydrate 时也要补齐 beforeEnter / enter 链。
      let needCallTransitionHooks = false
      if (isTemplateNode(el)) {
        needCallTransitionHooks =
          needTransition(
            null, // no need check parentSuspense in hydration
            transition,
          ) &&
          parentComponent &&
          parentComponent.vnode.props &&
          parentComponent.vnode.props.appear

        const content = (el as HTMLTemplateElement).content
          .firstChild as Element & { $cls?: string }

        if (needCallTransitionHooks) {
          // hydrate 前先暂存 class，避免过渡类和现有 class 被后续 patch 混淆。
          const cls = content.getAttribute('class')
          if (cls) content.$cls = cls
          transition!.beforeEnter(content)
        }

        // `<template>` 自身不是真正宿主节点，要替换成里面的真实内容节点。
        replaceNode(content, el, parentComponent)
        vnode.el = el = content
      }

      // 先接管子节点，再处理自身 props / hooks。
      if (
        shapeFlag & ShapeFlags.ARRAY_CHILDREN &&
        // skip if element has innerHTML / textContent
        !(props && (props.innerHTML || props.textContent))
      ) {
        let next = hydrateChildren(
          el.firstChild,
          vnode,
          el,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized,
        )
        if (next && !isMismatchAllowed(el, MismatchTypes.CHILDREN)) {
          ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
            warn(
              `Hydration children mismatch on`,
              el,
              `\nServer rendered element contains more child nodes than client vdom.`,
            )
          logMismatchError()
        }
        while (next) {
          // 服务端比客户端多出来的尾部节点，统一删掉。
          const cur = next
          next = next.nextSibling
          remove(cur)
        }
      } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // `pre/textarea` 在 HTML 解析时会吞掉首个换行，这里比较前要做同样归一化。
        let clientText = vnode.children as string
        if (
          clientText[0] === '\n' &&
          (el.tagName === 'PRE' || el.tagName === 'TEXTAREA')
        ) {
          clientText = clientText.slice(1)
        }
        const { textContent } = el
        if (
          textContent !== clientText &&
          // innerHTML normalize \r\n or \r into a single \n in the DOM
          textContent !== clientText.replace(/\r\n|\r/g, '\n')
        ) {
          if (!isMismatchAllowed(el, MismatchTypes.TEXT)) {
            ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              warn(
                `Hydration text content mismatch on`,
                el,
                `\n  - rendered on server: ${textContent}` +
                  `\n  - expected on client: ${clientText}`,
              )
            logMismatchError()
          }
          el.textContent = vnode.children as string
        }
      }

      // props 接管既包括 mismatch 检查，也包括必须重新 patch 的宿主属性。
      if (props) {
        if (
          __DEV__ ||
          __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__ ||
          forcePatch ||
          !optimized ||
          patchFlag & (PatchFlags.FULL_PROPS | PatchFlags.NEED_HYDRATION)
        ) {
          const isCustomElement = el.tagName.includes('-')
          for (const key in props) {
            // 先做 mismatch 检查，再决定是否需要真实 patch。
            if (
              (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              // #11189 skip if this node has directives that have created hooks
              // as it could have mutated the DOM in any possible way
              !(dirs && dirs.some(d => d.dir.created)) &&
              propHasMismatch(el, key, props[key], vnode, parentComponent)
            ) {
              logMismatchError()
            }
            if (
              (forcePatch &&
                (key.endsWith('value') || key === 'indeterminate')) ||
              (isOn(key) && !isReservedProp(key)) ||
              // force hydrate v-bind with .prop modifiers
              key[0] === '.' ||
              (isCustomElement && !isReservedProp(key))
            ) {
              // hydration 并不会把所有 props 全量重写；
              // 这里只补那些会影响运行时行为、或服务端无法完整表达语义的关键字段。
              patchProp(el, key, null, props[key], undefined, parentComponent)
            }
          }
        } else if (props.onClick) {
          // 点击监听是最常见路径，这里走一个快速通道避免完整遍历 props。
          patchProp(
            el,
            'onClick',
            null,
            props.onClick,
            undefined,
            parentComponent,
          )
        } else if (patchFlag & PatchFlags.STYLE && isReactive(props.style)) {
          // hydration 不会重新跑 style patch，但响应式 style 仍要触发依赖收集。
          for (const key in props.style) props.style[key]
        }
      }

      // 最后补齐 vnode hooks、指令 hooks 和可能的 enter 过渡。
      let vnodeHooks: VNodeHook | null | undefined
      if ((vnodeHooks = props && props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHooks, parentComponent, vnode)
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
      }
      if (
        (vnodeHooks = props && props.onVnodeMounted) ||
        dirs ||
        needCallTransitionHooks
      ) {
        queueEffectWithSuspense(() => {
          vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode)
          needCallTransitionHooks && transition!.enter(el)
          dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
        }, parentSuspense)
      }
    }

    return el.nextSibling
  }

  /**
   * 作用：顺序接管某个父 vnode 下的全部子节点。
   *
   * 它同时负责：
   * - 处理连续文本 vnode
   * - 服务端节点不足时补 mount
   * - 服务端节点过多时记录 mismatch 并清理
   */
  const hydrateChildren = (
    node: Node | null,
    parentVNode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ): Node | null => {
    optimized = optimized || !!parentVNode.dynamicChildren
    const children = parentVNode.children as VNode[]
    const l = children.length
    // 只打一轮“服务端节点不足”的 mismatch 警告，避免后续每个缺失节点都重复刷日志。
    let hasCheckedMismatch = false
    for (let i = 0; i < l; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      const isText = vnode.type === Text
      if (node) {
        if (isText && !optimized) {
          // 手写 render / JSX 可能产生连续文本 vnode，但浏览器通常只保留一个文本节点。
          if (i + 1 < l && normalizeVNode(children[i + 1]).type === Text) {
            // 提前补一个额外 TextNode，让下一个文本 vnode 也有节点可接管。
            insert(
              createText(
                (node as Text).data.slice((vnode.children as string).length),
              ),
              container,
              nextSibling(node),
            )
            ;(node as Text).data = vnode.children as string
          }
        }
        node = hydrateNode(
          node,
          vnode,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized,
        )
      } else if (isText && !vnode.children) {
        // 空文本在 SSR 里通常缺席，这里客户端补一个出来。
        insert((vnode.el = createText('')), container)
      } else {
        if (!hasCheckedMismatch) {
          hasCheckedMismatch = true
          if (!isMismatchAllowed(container, MismatchTypes.CHILDREN)) {
            ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              warn(
                `Hydration children mismatch on`,
                container,
                `\nServer rendered element contains fewer child nodes than client vdom.`,
              )
            logMismatchError()
          }
        }

        // the SSRed DOM didn't contain enough nodes. Mount the missing ones.
        // 服务端 DOM 不够时，直接对缺失 vnode 走普通 patch 挂载即可。
        patch(
          null,
          vnode,
          container,
          null,
          parentComponent,
          parentSuspense,
          getContainerType(container),
          slotScopeIds,
        )
      }
    }
    // 返回“还未被当前父 vnode 消费掉”的下一个真实兄弟节点，供外层继续接管。
    return node
  }

  const hydrateFragment = (
    node: Comment,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => {
    // Fragment 自己不对应真实元素，要把作用域 id 和子节点 hydration 一起向下传。
    const { slotScopeIds: fragmentSlotScopeIds } = vnode
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds
        ? slotScopeIds.concat(fragmentSlotScopeIds)
        : fragmentSlotScopeIds
    }

    const container = parentNode(node)!
    const next = hydrateChildren(
      nextSibling(node)!,
      vnode,
      container,
      parentComponent,
      parentSuspense,
      slotScopeIds,
      optimized,
    )
    if (next && isComment(next) && next.data === ']') {
      // 找到结束锚点后，fragment 这段服务端 DOM 就算完整接管成功。
      return nextSibling((vnode.anchor = next))
    } else {
      // 没有找到 fragment 结束锚点，说明服务端结构和客户端预期已经脱节。
      logMismatchError()

      // 客户端补一个结束锚点，后续 patch 才能继续依赖 fragment 边界工作。
      insert((vnode.anchor = createComment(`]`)), container, next)
      return next
    }
  }

  /**
   * 作用：处理“服务端现有 DOM 和客户端 vnode 不一致”的兜底修复逻辑。
   *
   * 核心策略：
   * - 先记录 mismatch。
   * - 移除当前错误节点。
   * - 对客户端 vnode 重新走一次正常 mount / patch。
   */
  const handleMismatch = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    isFragment: boolean,
  ): Node | null => {
    // mismatch 时不会继续“强行接管错误节点”，而是局部回退到客户端挂载，
    // 这样能确保这段子树重新回到一致状态。
    if (!isMismatchAllowed(node.parentElement!, MismatchTypes.CHILDREN)) {
      ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warn(
          `Hydration node mismatch:\n- rendered on server:`,
          node,
          node.nodeType === DOMNodeTypes.TEXT
            ? `(text)`
            : isComment(node) && node.data === '['
              ? `(start of fragment)`
              : ``,
          `\n- expected on client:`,
          vnode.type,
        )
      logMismatchError()
    }

    vnode.el = null

    if (isFragment) {
      // fragment 起点不匹配时，还要顺手把多余的片段内部节点一并清掉。
      const end = locateClosingAnchor(node)
      while (true) {
        const next = nextSibling(node)
        if (next && next !== end) {
          remove(next)
        } else {
          break
        }
      }
    }

    const next = nextSibling(node)
    const container = parentNode(node)!
    remove(node)

    patch(
      null,
      vnode,
      container,
      next,
      parentComponent,
      parentSuspense,
      getContainerType(container),
      slotScopeIds,
    )
    // mismatch 后组件根节点引用可能已经换了，要把父组件链上的 host el 一起纠正。
    if (parentComponent) {
      parentComponent.vnode.el = vnode.el
      updateHOCHostEl(parentComponent, vnode.el)
    }
    return next
  }

  /**
   * 作用：从当前节点开始向后查找对应的结束锚点。
   *
   * 主要给 Fragment、Teleport 这类使用注释边界的结构使用。
   */
  const locateClosingAnchor = (
    node: Node | null,
    open = '[',
    close = ']',
  ): Node | null => {
    // 这里用 `match` 计数处理嵌套片段/Teleport，确保遇到成对嵌套注释时不会过早停下。
    let match = 0
    while (node) {
      node = nextSibling(node)
      if (node && isComment(node)) {
        if (node.data === open) match++
        if (node.data === close) {
          if (match === 0) {
            // 返回的是“结束锚点的下一个兄弟”，因为外层通常要继续消费它后面的节点。
            return nextSibling(node)
          } else {
            match--
          }
        }
      }
    }
    return node
  }

  /**
   * 作用：用新的真实节点替换旧节点，并把组件链上缓存的 `.el` 一并同步掉。
   */
  const replaceNode = (
    newNode: Node,
    oldNode: Node,
    parentComponent: ComponentInternalInstance | null,
  ): void => {
    // replace node
    const parentNode = oldNode.parentNode
    if (parentNode) {
      parentNode.replaceChild(newNode, oldNode)
    }

    // update vnode
    // 替换真实节点后，还要沿父组件链把缓存的 `.el` 一起修正，
    // 否则后续更新仍可能握着旧 DOM 引用。
    let parent = parentComponent
    while (parent) {
      if (parent.vnode.el === oldNode) {
        parent.vnode.el = parent.subTree.el = newNode
      }
      parent = parent.parent
    }
  }

  /**
   * 作用：判断当前真实节点是否为 `<template>`。
   */
  const isTemplateNode = (node: Node): node is HTMLTemplateElement => {
    return (
      node.nodeType === DOMNodeTypes.ELEMENT &&
      (node as Element).tagName === 'TEMPLATE'
    )
  }

  return [hydrate, hydrateNode]
}

/**
 * Dev only
 */
function propHasMismatch(
  el: Element & { $cls?: string },
  key: string,
  clientValue: any,
  vnode: VNode,
  instance: ComponentInternalInstance | null,
): boolean {
  // 这几个变量统一描述“服务端实际值”和“客户端期望值”的差异信息。
  let mismatchType: MismatchTypes | undefined
  let mismatchKey: string | undefined
  let actual: string | boolean | null | undefined
  let expected: string | boolean | null | undefined
  if (key === 'class') {
    // class 顺序不同不会影响结果，这里按集合比较即可。
    if (el.$cls) {
      actual = el.$cls
      delete el.$cls
    } else {
      actual = el.getAttribute('class')
    }
    expected = normalizeClass(clientValue)
    if (!isSetEqual(toClassSet(actual || ''), toClassSet(expected))) {
      mismatchType = MismatchTypes.CLASS
      mismatchKey = `class`
    }
  } else if (key === 'style') {
    // style 顺序同样不重要，这里转成 map 后比较。
    actual = el.getAttribute('style') || ''
    expected = isString(clientValue)
      ? clientValue
      : stringifyStyle(normalizeStyle(clientValue))
    const actualMap = toStyleMap(actual)
    const expectedMap = toStyleMap(expected)
    // `v-show=false` 时，客户端预期样式里还要补一个 `display:none`。
    if (vnode.dirs) {
      for (const { dir, value } of vnode.dirs) {
        // @ts-expect-error only vShow has this internal name
        if (dir.name === 'show' && !value) {
          expectedMap.set('display', 'none')
        }
      }
    }

    if (instance) {
      // 组件 CSS vars 也是最终样式对齐的一部分，这里一起纳入预期值。
      resolveCssVars(instance, vnode, expectedMap)
    }

    if (!isMapEqual(actualMap, expectedMap)) {
      mismatchType = MismatchTypes.STYLE
      mismatchKey = 'style'
    }
  } else if (
    (el instanceof SVGElement && isKnownSvgAttr(key)) ||
    (el instanceof HTMLElement && (isBooleanAttr(key) || isKnownHtmlAttr(key)))
  ) {
    if (isBooleanAttr(key)) {
      actual = el.hasAttribute(key)
      expected = includeBooleanAttr(clientValue)
    } else if (clientValue == null) {
      actual = el.hasAttribute(key)
      expected = false
    } else {
      if (el.hasAttribute(key)) {
        actual = el.getAttribute(key)
      } else if (key === 'value' && el.tagName === 'TEXTAREA') {
        // #10000 textarea.value can't be retrieved by `hasAttribute`
        actual = (el as HTMLTextAreaElement).value
      } else {
        actual = false
      }
      expected = isRenderableAttrValue(clientValue)
        ? String(clientValue)
        : false
    }
    if (actual !== expected) {
      mismatchType = MismatchTypes.ATTRIBUTE
      mismatchKey = key
    }
  }

  if (mismatchType != null && !isMismatchAllowed(el, mismatchType)) {
    const format = (v: any) =>
      v === false ? `(not rendered)` : `${mismatchKey}="${v}"`
    const preSegment = `Hydration ${MismatchTypeString[mismatchType]} mismatch on`
    const postSegment =
      `\n  - rendered on server: ${format(actual)}` +
      `\n  - expected on client: ${format(expected)}` +
      `\n  Note: this mismatch is check-only. The DOM will not be rectified ` +
      `in production due to performance overhead.` +
      `\n  You should fix the source of the mismatch.`
    if (__TEST__) {
      // 测试环境下拼成单字符串，方便断言和排查。
      warn(`${preSegment} ${el.tagName}${postSegment}`)
    } else {
      // 开发环境把真实元素对象一并打出来，方便直接在控制台定位对应 DOM。
      warn(preSegment, el, postSegment)
    }
    return true
  }
  return false
}

/**
 * 作用：把 class 字符串规范化成集合，便于忽略顺序做比对。
 */
function toClassSet(str: string): Set<string> {
  // class 属性语义上是无序集合，因此 hydration 比对不能直接按原字符串比较。
  return new Set(str.trim().split(/\s+/))
}

/**
 * 作用：比较两个 class 集合是否完全一致。
 */
function isSetEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const s of a) {
    if (!b.has(s)) {
      return false
    }
  }
  return true
}

/**
 * 作用：把 style 文本解析成键值表，便于忽略声明顺序做比对。
 */
function toStyleMap(str: string): Map<string, string> {
  // style 同样更适合按“属性名 -> 值”比较，而不是依赖原声明顺序。
  const styleMap: Map<string, string> = new Map()
  for (const item of str.split(';')) {
    let [key, value] = item.split(':')
    key = key.trim()
    value = value && value.trim()
    if (key && value) {
      styleMap.set(key, value)
    }
  }
  return styleMap
}

/**
 * 作用：比较两个样式 map 是否完全一致。
 */
function isMapEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const [key, value] of a) {
    if (value !== b.get(key)) {
      return false
    }
  }
  return true
}

/**
 * 作用：把组件运行时生成的 CSS 变量补进 hydration 的预期样式集合。
 */
function resolveCssVars(
  instance: ComponentInternalInstance,
  vnode: VNode,
  expectedMap: Map<string, string>,
) {
  const root = instance.subTree
  if (
    instance.getCssVars &&
    (vnode === root ||
      (root &&
        root.type === Fragment &&
        (root.children as VNode[]).includes(vnode)))
  ) {
    const cssVars = instance.getCssVars()
    for (const key in cssVars) {
      const value = normalizeCssVarValue(cssVars[key])
      expectedMap.set(`--${getEscapedCssVarName(key, false)}`, value)
    }
  }
  if (vnode === root && instance.parent) {
    // 根 vnode 上还要继续向上继承父组件注入下来的 CSS vars。
    resolveCssVars(instance.parent, instance.vnode, expectedMap)
  }
}

const allowMismatchAttr = 'data-allow-mismatch'

enum MismatchTypes {
  TEXT = 0,
  CHILDREN = 1,
  CLASS = 2,
  STYLE = 3,
  ATTRIBUTE = 4,
}

const MismatchTypeString: Record<MismatchTypes, string> = {
  [MismatchTypes.TEXT]: 'text',
  [MismatchTypes.CHILDREN]: 'children',
  [MismatchTypes.CLASS]: 'class',
  [MismatchTypes.STYLE]: 'style',
  [MismatchTypes.ATTRIBUTE]: 'attribute',
} as const

function isMismatchAllowed(
  el: Element | null,
  allowedType: MismatchTypes,
): boolean {
  // text / children mismatch 允许从父链上声明一次，向下整体生效。
  if (
    allowedType === MismatchTypes.TEXT ||
    allowedType === MismatchTypes.CHILDREN
  ) {
    while (el && !el.hasAttribute(allowMismatchAttr)) {
      el = el.parentElement
    }
  }
  const allowedAttr = el && el.getAttribute(allowMismatchAttr)
  if (allowedAttr == null) {
    return false
  } else if (allowedAttr === '') {
    // 空字符串表示该节点允许所有类型 mismatch。
    return true
  } else {
    // 非空时按逗号分隔的白名单理解，只允许指定类型的 mismatch 被静默放过。
    const list = allowedAttr.split(',')
    // text 可以视为 children mismatch 的子集。
    if (allowedType === MismatchTypes.TEXT && list.includes('children')) {
      return true
    }
    return list.includes(MismatchTypeString[allowedType])
  }
}
