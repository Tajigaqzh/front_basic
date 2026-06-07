/**
 * 文件作用：实现内置运行时组件。
 *
 * 当前文件 Teleport.ts 负责一个特殊内置组件的运行时行为，
 * 例如 KeepAlive、Teleport、Suspense、BaseTransition 等。
 */

import type { ComponentInternalInstance } from '../component'
import type { SuspenseBoundary } from './Suspense'
import {
  type ElementNamespace,
  MoveType,
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type RendererOptions,
  queuePostRenderEffect,
  traverseStaticChildren,
} from '../renderer'
import type { VNode, VNodeArrayChildren, VNodeProps } from '../vnode'
import { ShapeFlags, isString } from '@vue-source/shared'
import { warn } from '../warning'
import { isHmrUpdating } from '../hmr'
import { type SchedulerJob, SchedulerJobFlags } from '../scheduler'

export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>

export interface TeleportProps {
  to: string | RendererElement | null | undefined
  disabled?: boolean
  defer?: boolean
}

// 延迟挂载模式下，先把待执行的挂载任务挂在这里，便于更新时取消旧任务。
const pendingMounts = new WeakMap<VNode, SchedulerJob>()

export const TeleportEndKey: unique symbol = Symbol('_vte')

/**
 * 作用：判断某个 vnode type 是否为 Teleport 内置类型。
 */
export const isTeleport = (type: any): boolean => type.__isTeleport

/**
 * 作用：判断当前 Teleport 是否被禁用。
 *
 * 被禁用时，子节点不会传送到目标容器，而是留在原始渲染位置。
 */
const isTeleportDisabled = (props: VNode['props']): boolean =>
  props && (props.disabled || props.disabled === '')

/**
 * 作用：判断当前 Teleport 是否启用延迟挂载模式。
 */
const isTeleportDeferred = (props: VNode['props']): boolean =>
  props && (props.defer || props.defer === '')

/**
 * 作用：判断 Teleport 目标节点是否位于 SVG 命名空间。
 */
const isTargetSVG = (target: RendererElement): boolean =>
  typeof SVGElement !== 'undefined' && target instanceof SVGElement

/**
 * 作用：判断 Teleport 目标节点是否位于 MathML 命名空间。
 */
const isTargetMathML = (target: RendererElement): boolean =>
  typeof MathMLElement === 'function' && target instanceof MathMLElement

/**
 * 作用：把 Teleport 的 `to` 选项解析成真实目标节点。
 *
 * 参数说明：
 * - `props`：Teleport 的 props。
 * - `select`：宿主层传入的查询函数，DOM 环境里通常是 `querySelector`。
 *
 * 返回值：
 * - 返回最终要传送到的宿主节点；找不到时返回 `null`。
 */
const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions['querySelector'],
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      __DEV__ &&
        warn(
          `Current renderer does not support string target for Teleports. ` +
            `(missing querySelector renderer option)`,
        )
      return null
    } else {
      const target = select(targetSelector)
      if (__DEV__ && !target && !isTeleportDisabled(props)) {
        warn(
          `Failed to locate Teleport target with selector "${targetSelector}". ` +
            `Note the target element must exist before the component is mounted - ` +
            `i.e. the target cannot be rendered by the component itself, and ` +
            `ideally should be outside of the entire Vue component tree.`,
        )
      }
      return target as T
    }
  } else {
    if (__DEV__ && !targetSelector && !isTeleportDisabled(props)) {
      warn(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector as T
  }
}

export const TeleportImpl = {
  name: 'Teleport',
  __isTeleport: true,
  /**
   * 作用：处理 Teleport vnode 的挂载、更新和移动。
   *
   * 它是渲染器在识别到 `__isTeleport` 后直接调用的入口，
   * 负责决定子节点应该渲染在原容器还是目标容器，以及后续更新时如何搬运。
   */
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean,
    internals: RendererInternals,
  ): void {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment, parentNode },
    } = internals

    const disabled = isTeleportDisabled(n2.props)
    // `dynamicChildren` 记录编译阶段提取出来的动态子节点块，可用于优化更新。
    let { dynamicChildren } = n2

    // #3302
    // HMR updated, force full diff
    if (__DEV__ && isHmrUpdating) {
      optimized = false
      dynamicChildren = null
    }

    /**
     * 作用：把 Teleport 的一批子节点挂到指定容器。
     *
     * 这个内部函数会同时服务“原地渲染”和“传送到目标容器”两种场景。
     */
    const mount = (
      vnode: TeleportVNode,
      container: RendererElement,
      anchor: RendererNode,
    ) => {
      // Teleport *always* has Array children. This is enforced in both the
      // compiler and vnode children normalization.
      if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(
          vnode.children as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
        )
      }
    }

    const mountToTarget = (vnode: TeleportVNode = n2) => {
      const disabled = isTeleportDisabled(vnode.props)
      const target = (vnode.target = resolveTarget(vnode.props, querySelector))
      // `targetAnchor` 是 Teleport 在目标容器内的结束锚点，后续移动和卸载都依赖它。
      const targetAnchor = prepareAnchor(target, vnode, createText, insert)
      if (target) {
        // 传送目标可能跨命名空间，例如从普通 DOM 树传进 SVG/MathML。
        if (namespace !== 'svg' && isTargetSVG(target)) {
          namespace = 'svg'
        } else if (namespace !== 'mathml' && isTargetMathML(target)) {
          namespace = 'mathml'
        }

        // 自定义元素需要额外记住 teleport 目标，后面插槽扫描和样式同步会用到。
        if (parentComponent && parentComponent.isCE) {
          ;(
            parentComponent.ce!._teleportTargets ||
            (parentComponent.ce!._teleportTargets = new Set())
          ).add(target)
        }

        if (!disabled) {
          mount(vnode, target, targetAnchor)
          updateCssVars(vnode, false)
        }
      } else if (__DEV__ && !disabled) {
        warn('Invalid Teleport target on mount:', target, `(${typeof target})`)
      }
    }

    const queuePendingMount = (vnode: TeleportVNode) => {
      // 延迟 Teleport 需要等当前渲染提交后再决定真实落点，所以挂进 post-render 队列。
      const mountJob: SchedulerJob = () => {
        if (pendingMounts.get(vnode) !== mountJob) return
        pendingMounts.delete(vnode)
        if (isTeleportDisabled(vnode.props)) {
          // Suspense resolve 期间占位节点可能已被搬家，所以这里实时读取当前父节点。
          const mountContainer = parentNode(vnode.el!) || container
          mount(vnode, mountContainer, vnode.anchor!)
          updateCssVars(vnode, true)
        }
        mountToTarget(vnode)
      }
      pendingMounts.set(vnode, mountJob)
      queuePostRenderEffect(mountJob, parentSuspense)
    }

    if (n1 == null) {
      // 主视图里永远都会保留一对锚点，哪怕内容真正被传送走了也是如此。
      const placeholder = (n2.el = __DEV__
        ? createComment('teleport start')
        : createText(''))
      const mainAnchor = (n2.anchor = __DEV__
        ? createComment('teleport end')
        : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      if (
        isTeleportDeferred(n2.props) ||
        (__FEATURE_SUSPENSE__ && parentSuspense && parentSuspense.pendingBranch)
      ) {
        // defer 或父 suspense 未 resolve 时，先缓冲挂载，等时机成熟再处理目标容器。
        queuePendingMount(n2)
        return
      }

      if (disabled) {
        // disabled 模式等同“只保留锚点，但内容渲染在原位置”。
        mount(n2, container, mainAnchor)
        updateCssVars(n2, true)
      }

      mountToTarget()
    } else {
      // update content
      n2.el = n1.el
      const mainAnchor = (n2.anchor = n1.anchor)!
      // defer / suspense 场景下，之前的 target 挂载任务可能还没执行，这里要用最新 vnode 替换它。
      const pendingMount = pendingMounts.get(n1)
      if (pendingMount) {
        pendingMount.flags! |= SchedulerJobFlags.DISPOSED
        pendingMounts.delete(n1)
        queuePendingMount(n2)
        return
      }
      n2.targetStart = n1.targetStart
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (namespace === 'svg' || isTargetSVG(target)) {
        namespace = 'svg'
      } else if (namespace === 'mathml' || isTargetMathML(target)) {
        namespace = 'mathml'
      }

      if (dynamicChildren) {
        // block root 走动态子节点快路径。
        patchBlockChildren(
          n1.dynamicChildren!,
          dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
        )
        // 即便走 block 优化，也要把根层静态子节点的 DOM 引用继续同步给新 vnode。
        traverseStaticChildren(n1, n2, !__DEV__)
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          false,
        )
      }

      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled：把内容从 target 搬回主容器。
          moveTeleport(
            n2,
            container,
            mainAnchor,
            internals,
            TeleportMoveTypes.TOGGLE,
          )
        } else {
          // disabled 状态下 `to` 改了也先保留旧值，等再次 enabled 时再用正确目标切换。
          if (n2.props && n1.props && n2.props.to !== n1.props.to) {
            n2.props.to = n1.props.to
          }
        }
      } else {
        // enabled 状态下优先处理目标容器切换。
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props,
            querySelector,
          ))
          if (nextTarget) {
            moveTeleport(
              n2,
              nextTarget,
              null,
              internals,
              TeleportMoveTypes.TARGET_CHANGE,
            )
          } else if (__DEV__) {
            warn(
              'Invalid Teleport target on update:',
              target,
              `(${typeof target})`,
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled：把内容从主容器搬回目标容器。
          moveTeleport(
            n2,
            target,
            targetAnchor,
            internals,
            TeleportMoveTypes.TOGGLE,
          )
        }
      }
      updateCssVars(n2, disabled)
    }
  },

  remove(
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    { um: unmount, o: { remove: hostRemove } }: RendererInternals,
    doRemove: boolean,
  ): void {
    const {
      shapeFlag,
      children,
      anchor,
      targetStart,
      targetAnchor,
      target,
      props,
    } = vnode

    const shouldRemove = doRemove || !isTeleportDisabled(props)
    // defer + suspense 场景下，内容可能压根还没真正挂上去，先取消待执行挂载任务。
    const pendingMount = pendingMounts.get(vnode)
    if (pendingMount) {
      pendingMount.flags! |= SchedulerJobFlags.DISPOSED
      pendingMounts.delete(vnode)
    }

    if (target) {
      // 目标容器内的锚点也属于 Teleport 自己维护的结构，卸载时一起删掉。
      hostRemove(targetStart!)
      hostRemove(targetAnchor!)
    }

    // 主视图结束锚点只在真正移除 Teleport 自身时才删。
    doRemove && hostRemove(anchor!)
    // 只要子节点真的挂载过，就不管 disabled 与否都要逐个 unmount。
    if (!pendingMount && shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        const child = (children as VNode[])[i]
        unmount(
          child,
          parentComponent,
          parentSuspense,
          shouldRemove,
          !!child.dynamicChildren,
        )
      }
    }
  },

  move: moveTeleport as typeof moveTeleport,
  hydrate: hydrateTeleport as typeof hydrateTeleport,
}

export enum TeleportMoveTypes {
  TARGET_CHANGE,
  TOGGLE, // enable / disable
  REORDER, // moved in the main view
}

function moveTeleport(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER,
): void {
  /**
   * 作用：移动 Teleport 本身及其子节点。
   *
   * 三种场景：
   * - `TARGET_CHANGE`：目标容器变了。
   * - `TOGGLE`：disabled/enabled 切换。
   * - `REORDER`：主视图里的 Teleport 占位位置变了。
   */
  // 目标容器切换时，先把目标锚点搬过去，再处理内容。
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === TeleportMoveTypes.REORDER
  // REORDER 只需要调整主视图占位锚点位置。
  if (isReorder) {
    insert(el!, container, parentAnchor)
  }
  // enabled + REORDER 时，内容本来就在目标容器里，不应该跟着主视图占位一起挪。
  if (!pendingMounts.has(vnode) && (!isReorder || isTeleportDisabled(props))) {
    // Teleport has either Array children or no children.
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move(
          (children as VNode[])[i],
          container,
          parentAnchor,
          MoveType.REORDER,
        )
      }
    }
  }
  if (isReorder) {
    insert(anchor!, container, parentAnchor)
  }
}

interface TeleportTargetElement extends Element {
  // last teleport target
  _lpa?: Node | null
}

function hydrateTeleport(
  node: Node,
  vnode: TeleportVNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  slotScopeIds: string[] | null,
  optimized: boolean,
  {
    o: { nextSibling, parentNode, querySelector, insert, createText },
  }: RendererInternals<Node, Element>,
  hydrateChildren: (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => Node | null,
): Node | null {
  /**
   * 作用：SSR 场景下接管 Teleport 结构。
   */
  function hydrateAnchor(
    target: TeleportTargetElement,
    targetNode: Node | null,
  ) {
    let targetAnchor = targetNode
    while (targetAnchor) {
      if (targetAnchor && targetAnchor.nodeType === 8) {
        if ((targetAnchor as Comment).data === 'teleport start anchor') {
          vnode.targetStart = targetAnchor
        } else if ((targetAnchor as Comment).data === 'teleport anchor') {
          vnode.targetAnchor = targetAnchor
          // `_lpa` 记录上一次 Teleport 在同一 target 中结束的位置，给下一个 Teleport 续接。
          target._lpa =
            vnode.targetAnchor && nextSibling(vnode.targetAnchor as Node)
          break
        }
      }
      targetAnchor = nextSibling(targetAnchor)
    }
  }

  function hydrateDisabledTeleport(node: Node, vnode: VNode) {
    // disabled 模式下，内容仍在主容器里，所以按普通子节点去 hydrate。
    vnode.anchor = hydrateChildren(
      nextSibling(node),
      vnode,
      parentNode(node)!,
      parentComponent,
      parentSuspense,
      slotScopeIds,
      optimized,
    )
  }

  const target = (vnode.target = resolveTarget<Element>(
    vnode.props,
    querySelector,
  ))
  const disabled = isTeleportDisabled(vnode.props)
  if (target) {
    // 多个 Teleport 指向同一 target 时，后一个要从前一个结束处继续接管。
    const targetNode =
      (target as TeleportTargetElement)._lpa || target.firstChild
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (disabled) {
        hydrateDisabledTeleport(node, vnode)
        hydrateAnchor(target as TeleportTargetElement, targetNode)
        if (!vnode.targetAnchor) {
          // 目标容器里找不到锚点时，客户端手动补一对，避免后续 move/unmount 失效。
          prepareAnchor(
            target,
            vnode,
            createText,
            insert,
            // if target is the same as the main view, insert anchors before current node
            // to avoid hydrating mismatch
            parentNode(node)! === target ? node : null,
          )
        }
      } else {
        vnode.anchor = nextSibling(node)
        hydrateAnchor(target as TeleportTargetElement, targetNode)
        // SSR 页面结构若把 Teleport 内容放错位置，客户端至少也要补齐 targetAnchor。
        if (!vnode.targetAnchor) {
          prepareAnchor(target, vnode, createText, insert)
        }

        hydrateChildren(
          targetNode && nextSibling(targetNode),
          vnode,
          target,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized,
        )
      }
    }
    updateCssVars(vnode, disabled)
  } else if (disabled) {
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      hydrateDisabledTeleport(node, vnode)
      vnode.targetStart = node
      vnode.targetAnchor = nextSibling(node)
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor as Node)
}

// Force-casted public typing for h and TSX props inference
export const Teleport = TeleportImpl as unknown as {
  __isTeleport: true
  new (): {
    $props: VNodeProps & TeleportProps
    $slots: {
      default(): VNode[]
    }
  }
}

function updateCssVars(vnode: VNode, isDisabled: boolean) {
  // `ctx.ut` 存在说明宿主组件使用了 CSS vars，需要把传送出去的节点也打上 owner 标记。
  const ctx = vnode.ctx
  if (ctx && ctx.ut) {
    let node, anchor
    if (isDisabled) {
      node = vnode.el
      anchor = vnode.anchor
    } else {
      node = vnode.targetStart
      anchor = vnode.targetAnchor
    }
    while (node && node !== anchor) {
      if (node.nodeType === 1) node.setAttribute('data-v-owner', ctx.uid)
      node = node.nextSibling
    }
    ctx.ut()
  }
}

function prepareAnchor(
  target: RendererElement | null,
  vnode: TeleportVNode,
  createText: RendererOptions['createText'],
  insert: RendererOptions['insert'],
  anchor: RendererNode | null = null,
) {
  /**
   * 作用：在目标容器里创建 Teleport 自己维护的一对锚点。
   */
  const targetStart = (vnode.targetStart = createText(''))
  const targetAnchor = (vnode.targetAnchor = createText(''))

  // 挂特殊标记，渲染器在做 nextSibling 搜索时可以识别并跳过整段 Teleport 内容。
  targetStart[TeleportEndKey] = targetAnchor

  if (target) {
    insert(targetStart, target, anchor)
    insert(targetAnchor, target, anchor)
  }

  return targetAnchor
}
