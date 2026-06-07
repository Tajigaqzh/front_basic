/**
 * 文件作用：实现内置运行时组件。
 *
 * 当前文件 Suspense.ts 负责一个特殊内置组件的运行时行为，
 * 例如 KeepAlive、Teleport、Suspense、BaseTransition 等。
 */

import {
  Comment,
  type VNode,
  type VNodeProps,
  closeBlock,
  createVNode,
  currentBlock,
  isBlockTreeEnabled,
  isSameVNodeType,
  normalizeVNode,
  openBlock,
} from '../vnode'
import { ShapeFlags, isArray, isFunction, toNumber } from '@vue-source/shared'
import {
  type ComponentInternalInstance,
  handleSetupResult,
  unsetCurrentInstance,
} from '../component'
import type { Slots } from '../componentSlots'
import {
  type ElementNamespace,
  MoveType,
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type SetupRenderEffectFn,
  queuePostRenderEffect,
} from '../renderer'
import { queuePostFlushCb } from '../scheduler'
import { filterSingleRoot, updateHOCHostEl } from '../componentRenderUtils'
import {
  assertNumber,
  popWarningContext,
  pushWarningContext,
  warn,
} from '../warning'
import { ErrorCodes, handleError } from '../errorHandling'
import { NULL_DYNAMIC_COMPONENT } from '../helpers/resolveAssets'

export interface SuspenseProps {
  onResolve?: () => void
  onPending?: () => void
  onFallback?: () => void
  /**
   * Switch to fallback content if it takes longer than `timeout` milliseconds to render the new default content.
   * A `timeout` value of `0` will cause the fallback content to be displayed immediately when default content is replaced.
   */
  timeout?: string | number
  /**
   * Allow suspense to be captured by parent suspense
   *
   * @default false
   */
  suspensible?: boolean
}

/**
 * 作用：判断某个 vnode type 是否为 Suspense 内置类型。
 */
export const isSuspense = (type: any): boolean => type.__isSuspense

// 每产生一个新的 pending 分支就递增一次，方便区分异步分支的有效性。
let suspenseId = 0

/**
 * 作用：重置 suspense 自增 id。
 *
 * 这个方法主要服务测试场景，方便让断言结果稳定可预测。
 */
export const resetSuspenseId = (): number => (suspenseId = 0)

/**
 * 作用：Suspense 的内置实现入口。
 *
 * 虽然它在编译阶段表现得像组件，但底层并不走普通组件初始化链，
 * 而是直接挂进渲染器，用来协调异步依赖、pending 分支和 fallback 分支。
 */
export const SuspenseImpl = {
  name: 'Suspense',
  // 渲染器通过 `__isSuspense` 标记识别它，避免直接硬编码导入，保持可 tree-shake。
  __isSuspense: true,
  /**
   * 作用：处理 Suspense 的初次挂载与更新。
   *
   * 参数说明：
   * - `n1`：旧 vnode，为空表示首次挂载。
   * - `n2`：新 vnode。
   * - 其余参数由渲染器传入，用于指定宿主容器、父组件、父 suspense、命名空间和优化标记。
   */
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean,
    // 渲染器把平台相关实现能力整体透传进来，Suspense 自己不直接依赖 DOM。
    rendererInternals: RendererInternals,
  ): void {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    } else {
      // 父 suspense 尚未 resolve 时，当前 suspense 可能已经包含在父级 pending 分支中，
      // 这里要避免重复 patch 导致内部组件被多次挂载。
      if (
        parentSuspense &&
        parentSuspense.deps > 0 &&
        !n1.suspense!.isInFallback
      ) {
        n2.suspense = n1.suspense!
        n2.suspense.vnode = n2
        n2.el = n1.el
        return
      }
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    }
  },
  hydrate: hydrateSuspense as typeof hydrateSuspense,
  normalize: normalizeSuspenseChildren as typeof normalizeSuspenseChildren,
}

// Force-casted public typing for h and TSX props inference
export const Suspense = (__FEATURE_SUSPENSE__
  ? SuspenseImpl
  : null) as unknown as {
  __isSuspense: true
  new (): {
    $props: VNodeProps & SuspenseProps
    $slots: {
      default(): VNode[]
      fallback(): VNode[]
    }
  }
}

function triggerEvent(
  vnode: VNode,
  name: 'onResolve' | 'onPending' | 'onFallback',
) {
  // Suspense 的这三个事件本质上都是从 props 上透传出来的回调。
  const eventListener = vnode.props && vnode.props[name]
  if (isFunction(eventListener)) {
    eventListener()
  }
}

/**
 * 作用：首次挂载 Suspense 边界。
 *
 * 核心流程：
 * - 先创建一个隐藏容器，把默认内容分支挂进去。
 * - 如果默认分支里遇到异步依赖，就显示 fallback。
 * - 如果没有异步依赖，直接把默认分支 resolve 成为激活分支。
 */
function mountSuspense(
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
) {
  const {
    p: patch,
    o: { createElement },
  } = rendererInternals
  const hiddenContainer = createElement('div')
  // `hiddenContainer` 用来离屏挂载 pendingBranch，等确定可显示后再搬回真实容器。
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    namespace,
    slotScopeIds,
    optimized,
    rendererInternals,
  ))

  // 先把默认内容分支挂到隐藏容器中，同时统计其中注册的异步依赖数。
  patch(
    null,
    (suspense.pendingBranch = vnode.ssContent!),
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    namespace,
    slotScopeIds,
  )
  // 根据异步依赖计数决定是直接 resolve，还是进入 fallback 状态。
  if (suspense.deps > 0) {
    triggerEvent(vnode, 'onPending')
    triggerEvent(vnode, 'onFallback')

    // 当前默认分支还没准备好，先把 fallback 真正渲染到可见容器里。
    patch(
      null,
      vnode.ssFallback!,
      container,
      anchor,
      parentComponent,
      null, // fallback tree will not have suspense context
      namespace,
      slotScopeIds,
    )
    setActiveBranch(suspense, vnode.ssFallback!)
  } else {
    // 默认分支同步可用，直接切为激活内容。
    suspense.resolve(false, true)
  }
}

/**
 * 作用：更新已有的 Suspense 边界。
 */
function patchSuspense(
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  { p: patch, um: unmount, o: { createElement } }: RendererInternals,
) {
  const suspense = (n2.suspense = n1.suspense)!
  suspense.vnode = n2
  n2.el = n1.el
  const newBranch = n2.ssContent!
  const newFallback = n2.ssFallback!

  const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense
  if (pendingBranch) {
    // 已经有一棵正在等待 resolve 的分支，本次更新优先覆盖它。
    suspense.pendingBranch = newBranch
    if (isSameVNodeType(pendingBranch, newBranch)) {
      // 根类型相同，只需要在隐藏容器里继续 patch 当前 pending 分支。
      patch(
        pendingBranch,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      if (suspense.deps <= 0) {
        suspense.resolve()
      } else if (isInFallback) {
        // 当前已经在 fallback 态时，fallback 也要跟着新 vnode 更新。
        if (!isHydrating) {
          patch(
            activeBranch,
            newFallback,
            container,
            anchor,
            parentComponent,
            null, // fallback tree will not have suspense context
            namespace,
            slotScopeIds,
            optimized,
          )
          setActiveBranch(suspense, newFallback)
        }
      }
    } else {
      // 旧 pending 分支还没 resolve 就被切换掉，需要递增 pendingId 让旧异步回调失效。
      suspense.pendingId = suspenseId++
      if (isHydrating) {
        // hydration 途中切分支时，当前 DOM 树已经不可信，后面要按 activeBranch 清掉。
        suspense.isHydrating = false
        suspense.activeBranch = pendingBranch
      } else {
        unmount(pendingBranch, parentComponent, suspense)
      }
      // 重置依赖计数和离屏容器，开始准备全新的 pending 分支。
      suspense.deps = 0
      suspense.effects.length = 0
      suspense.hiddenContainer = createElement('div')

      if (isInFallback) {
        // 当前已经显示 fallback，继续在隐藏容器里准备新内容分支。
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized,
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        } else {
          patch(
            activeBranch,
            newFallback,
            container,
            anchor,
            parentComponent,
            null, // fallback tree will not have suspense context
            namespace,
            slotScopeIds,
            optimized,
          )
          setActiveBranch(suspense, newFallback)
        }
      } else if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
        // 分支又切回当前已激活分支，直接在可见容器里 patch 并强制 resolve。
        patch(
          activeBranch,
          newBranch,
          container,
          anchor,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized,
        )
        // force resolve
        suspense.resolve(true)
      } else {
        // 切到了第三棵全新分支，重新离屏挂载并等待它 resolve。
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized,
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        }
      }
    }
  } else {
    if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
      // 当前只有激活分支，没有 pending 分支，且根类型没变，走普通更新。
      patch(
        activeBranch,
        newBranch,
        container,
        anchor,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      setActiveBranch(suspense, newBranch)
    } else {
      // 激活分支的根节点发生切换，需要重新进入 pending 流程。
      triggerEvent(n2, 'onPending')
      suspense.pendingBranch = newBranch
      if (newBranch.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        suspense.pendingId = newBranch.component!.suspenseId!
      } else {
        suspense.pendingId = suspenseId++
      }
      patch(
        null,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      if (suspense.deps <= 0) {
        // 新分支没有异步依赖，直接切换显示。
        suspense.resolve()
      } else {
        const { timeout, pendingId } = suspense
        // timeout 控制 fallback 何时真正显示，0 表示立即显示，>0 表示延时显示。
        if (timeout > 0) {
          setTimeout(() => {
            if (suspense.pendingId === pendingId) {
              suspense.fallback(newFallback)
            }
          }, timeout)
        } else if (timeout === 0) {
          suspense.fallback(newFallback)
        }
      }
    }
  }
}

export interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement, SuspenseProps>
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  namespace: ElementNamespace
  container: RendererElement
  hiddenContainer: RendererElement
  activeBranch: VNode | null
  isFallbackMountPending: boolean
  pendingBranch: VNode | null
  deps: number
  pendingId: number
  timeout: number
  isInFallback: boolean
  isHydrating: boolean
  isUnmounted: boolean
  effects: Function[]
  resolve(force?: boolean, sync?: boolean): void
  fallback(fallbackVNode: VNode): void
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType,
  ): void
  next(): RendererNode | null
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn,
    optimized: boolean,
  ): void
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}

let hasWarned = false

/**
 * 作用：创建 Suspense 边界对象。
 *
 * 这个对象是 Suspense 运行时的核心状态机，后续 resolve、fallback、
 * registerDep、move、unmount 都围绕它展开。
 */
function createSuspenseBoundary(
  vnode: VNode,
  parentSuspense: SuspenseBoundary | null,
  parentComponent: ComponentInternalInstance | null,
  container: RendererElement,
  hiddenContainer: RendererElement,
  anchor: RendererNode | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
  isHydrating = false,
): SuspenseBoundary {
  /* v8 ignore start */
  if (__DEV__ && !__TEST__ && !hasWarned) {
    hasWarned = true
    // @ts-expect-error `console.info` cannot be null error
    // eslint-disable-next-line no-console
    console[console.info ? 'info' : 'log'](
      `<Suspense> is an experimental feature and its API will likely change.`,
    )
  }
  /* v8 ignore stop */

  const {
    p: patch,
    m: move,
    um: unmount,
    n: next,
    o: { parentNode, remove },
  } = rendererInternals

  // `suspensible: true` 表示当前 suspense 可以继续并入父 suspense 的等待链。
  let parentSuspenseId: number | undefined
  const isSuspensible = isVNodeSuspensible(vnode)
  if (isSuspensible) {
    if (parentSuspense && parentSuspense.pendingBranch) {
      parentSuspenseId = parentSuspense.pendingId
      parentSuspense.deps++
    }
  }

  const timeout = vnode.props ? toNumber(vnode.props.timeout) : undefined
  if (__DEV__) {
    assertNumber(timeout, `Suspense timeout`)
  }

  const initialAnchor = anchor
  const suspense: SuspenseBoundary = {
    vnode,
    parent: parentSuspense,
    parentComponent,
    namespace,
    container,
    hiddenContainer,
    deps: 0,
    pendingId: suspenseId++,
    timeout: typeof timeout === 'number' ? timeout : -1,
    activeBranch: null,
    isFallbackMountPending: false,
    pendingBranch: null,
    isInFallback: !isHydrating,
    isHydrating,
    isUnmounted: false,
    effects: [],

    resolve(resume = false, sync = false) {
      if (__DEV__) {
        if (!resume && !suspense.pendingBranch) {
          throw new Error(
            `suspense.resolve() is called without a pending branch.`,
          )
        }
        if (suspense.isUnmounted) {
          throw new Error(
            `suspense.resolve() is called on an already unmounted suspense boundary.`,
          )
        }
      }
      const {
        vnode,
        activeBranch,
        pendingBranch,
        pendingId,
        effects,
        parentComponent,
        container,
        isInFallback,
      } = suspense

      // 如果外面还包着 Transition，并且是 out-in 模式，内容入场要等旧分支离场后再执行。
      let delayEnter: boolean | null = false
      if (suspense.isHydrating) {
        suspense.isHydrating = false
      } else if (!resume) {
        delayEnter =
          activeBranch &&
          pendingBranch!.transition &&
          pendingBranch!.transition.mode === 'out-in'
        let hasUpdatedAnchor = false
        if (delayEnter) {
          activeBranch!.transition!.afterLeave = () => {
            if (pendingId === suspense.pendingId) {
              move(
                pendingBranch!,
                container,
                anchor === initialAnchor && !hasUpdatedAnchor
                  ? next(activeBranch!)
                  : anchor,
                MoveType.ENTER,
              )
              queuePostFlushCb(effects)
              // clear el reference from fallback vnode to allow GC after transition
              if (isInFallback && vnode.ssFallback) {
                vnode.ssFallback.el = null
              }
            }
          }
        }
        // 正常 resolve 时，要把当前活跃树卸掉，再把 pending 分支切成新的激活分支。
        if (activeBranch && !suspense.isFallbackMountPending) {
          // fallback 树可能被父 suspense 搬动过，所以这里重新获取最新插入锚点。
          if (parentNode(activeBranch.el!) === container) {
            anchor = next(activeBranch)
            hasUpdatedAnchor = true
          }
          unmount(activeBranch, parentComponent, suspense, true)
          // clear el reference from fallback vnode to allow GC
          if (!delayEnter && isInFallback && vnode.ssFallback) {
            queuePostRenderEffect(() => (vnode.ssFallback!.el = null), suspense)
          }
        }
        if (!delayEnter) {
          // 没有过渡阻塞时，直接把离屏内容分支搬回真实容器。
          move(pendingBranch!, container, anchor, MoveType.ENTER)
        }
      }

      suspense.isFallbackMountPending = false
      setActiveBranch(suspense, pendingBranch!)
      suspense.pendingBranch = null
      suspense.isInFallback = false

      // 再把这期间缓存下来的 post effects 决定是自己冲刷，还是并入父 suspense。
      let parent = suspense.parent
      let hasUnresolvedAncestor = false
      while (parent) {
        if (parent.pendingBranch) {
          // 父 suspense 还没 resolve，就把当前 effects 合并给父级，统一延后执行。
          parent.effects.push(...effects)
          hasUnresolvedAncestor = true
          break
        }
        parent = parent.parent
      }
      // 没有未决父 suspense，也没有过渡阻塞，当前这批副作用可以立即冲刷。
      if (!hasUnresolvedAncestor && !delayEnter) {
        queuePostFlushCb(effects)
      }
      suspense.effects = []

      // 如果当前 suspense 被父级统计为一个依赖，这里还要回头递减父级 deps。
      if (isSuspensible) {
        if (
          parentSuspense &&
          parentSuspense.pendingBranch &&
          parentSuspenseId === parentSuspense.pendingId
        ) {
          parentSuspense.deps--
          if (parentSuspense.deps === 0 && !sync) {
            parentSuspense.resolve()
          }
        }
      }

      triggerEvent(vnode, 'onResolve')
    },

    fallback(fallbackVNode) {
      if (!suspense.pendingBranch) {
        return
      }

      const { vnode, activeBranch, parentComponent, container, namespace } =
        suspense

      triggerEvent(vnode, 'onFallback')

      const anchor = next(activeBranch!)
      const mountFallback = () => {
        suspense.isFallbackMountPending = false
        if (!suspense.isInFallback) {
          return
        }
        // 把 fallback 真正挂到可见容器中，并切成当前 activeBranch。
        patch(
          null,
          fallbackVNode,
          container,
          anchor,
          parentComponent,
          null, // fallback tree will not have suspense context
          namespace,
          slotScopeIds,
          optimized,
        )
        setActiveBranch(suspense, fallbackVNode)
      }

      const delayEnter =
        fallbackVNode.transition && fallbackVNode.transition.mode === 'out-in'
      if (delayEnter) {
        suspense.isFallbackMountPending = true
        activeBranch!.transition!.afterLeave = mountFallback
      }
      suspense.isInFallback = true

      // 进入 fallback 前，先把当前可见内容分支卸掉。
      unmount(
        activeBranch!,
        parentComponent,
        null, // no suspense so unmount hooks fire now
        true, // shouldRemove
      )

      if (!delayEnter) {
        mountFallback()
      }
    },

    move(container, anchor, type) {
      suspense.activeBranch &&
        move(suspense.activeBranch, container, anchor, type)
      suspense.container = container
    },

    next() {
      return suspense.activeBranch && next(suspense.activeBranch)
    },

    registerDep(instance, setupRenderEffect, optimized) {
      const isInPendingSuspense = !!suspense.pendingBranch
      if (isInPendingSuspense) {
        // 异步 setup 组件注册进来后，会让当前 suspense 的待决依赖数 +1。
        suspense.deps++
      }
      const hydratedEl = instance.vnode.el
      instance
        .asyncDep!.catch(err => {
          handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
        })
        .then(asyncSetupResult => {
          // setup Promise resolve 时，可能组件或 suspense 早就失效了，需要先做有效性判断。
          if (
            instance.isUnmounted ||
            suspense.isUnmounted ||
            suspense.pendingId !== instance.suspenseId
          ) {
            return
          }
          // 清掉残留 currentInstance，避免重新进入渲染链时串上下文。
          unsetCurrentInstance()
          instance.asyncResolved = true
          const { vnode } = instance
          if (__DEV__) {
            pushWarningContext(vnode)
          }
          handleSetupResult(instance, asyncSetupResult, false)
          if (hydratedEl) {
            // hydration 期间先接管到的真实 DOM 仍要保留下来。
            vnode.el = hydratedEl
          }
          const placeholder = !hydratedEl && instance.subTree.el
          setupRenderEffect(
            instance,
            vnode,
            // 异步组件 resolve 前组件可能已经被移动，所以这里重新读取当前真实父节点和锚点。
            parentNode(hydratedEl || instance.subTree.el!)!,
            hydratedEl ? null : next(instance.subTree),
            suspense,
            namespace,
            optimized,
          )
          if (placeholder) {
            // 真实子树渲染完成后，移除之前用于占位的注释/元素。
            vnode.placeholder = null
            remove(placeholder)
          }
          updateHOCHostEl(instance, vnode.el)
          if (__DEV__) {
            popWarningContext()
          }
          // 当前异步依赖完成，若它仍属于当前 pending 分支，就尝试推动 suspense resolve。
          if (isInPendingSuspense && --suspense.deps === 0) {
            suspense.resolve()
          }
        })
    },

    unmount(parentSuspense, doRemove) {
      suspense.isUnmounted = true
      if (suspense.activeBranch) {
        unmount(
          suspense.activeBranch,
          parentComponent,
          parentSuspense,
          doRemove,
        )
      }
      if (suspense.pendingBranch) {
        unmount(
          suspense.pendingBranch,
          parentComponent,
          parentSuspense,
          doRemove,
        )
      }
    },
  }

  return suspense
}

function hydrateSuspense(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
  hydrateNode: (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => Node | null,
): Node | null {
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    node.parentNode!,
    // eslint-disable-next-line no-restricted-globals
    document.createElement('div'),
    null,
    namespace,
    slotScopeIds,
    optimized,
    rendererInternals,
    true /* hydrating */,
  ))
  // SSR 产物可能来自“默认内容已成功解析”或“已经回退到 fallback”两种状态。
  // 客户端无法提前知道具体是哪一种，只能先按默认内容分支尝试 hydrate。
  const result = hydrateNode(
    node,
    (suspense.pendingBranch = vnode.ssContent!),
    parentComponent,
    suspense,
    slotScopeIds,
    optimized,
  )
  if (suspense.deps === 0) {
    suspense.resolve(false, true)
  }
  return result
}

/**
 * 作用：把 Suspense 的 slots 统一规范化成 `ssContent` 和 `ssFallback` 两棵 vnode 子树。
 */
function normalizeSuspenseChildren(vnode: VNode): void {
  const { shapeFlag, children } = vnode
  const isSlotChildren = shapeFlag & ShapeFlags.SLOTS_CHILDREN
  vnode.ssContent = normalizeSuspenseSlot(
    isSlotChildren ? (children as Slots).default : children,
  )
  vnode.ssFallback = isSlotChildren
    ? normalizeSuspenseSlot((children as Slots).fallback)
    : createVNode(Comment)
}

/**
 * 作用：规范化单个 Suspense 插槽的返回值，并尽量保留 block tree 优化信息。
 */
function normalizeSuspenseSlot(s: any) {
  let block: VNode[] | null | undefined
  if (isFunction(s)) {
    const trackBlock = isBlockTreeEnabled && s._c
    if (trackBlock) {
      // 编译插槽在这里临时允许 block tracking，便于把动态子节点信息带出来。
      s._d = false
      openBlock()
    }
    s = s()
    if (trackBlock) {
      s._d = true
      block = currentBlock
      closeBlock()
    }
  }
  if (isArray(s)) {
    const singleChild = filterSingleRoot(s)
    if (
      __DEV__ &&
      !singleChild &&
      s.filter(child => child !== NULL_DYNAMIC_COMPONENT).length > 0
    ) {
      warn(`<Suspense> slots expect a single root node.`)
    }
    s = singleChild
  }
  s = normalizeVNode(s)
  if (block && !s.dynamicChildren) {
    // 外层 slot 自己没有动态子节点时，把编译阶段收集到的 block 信息挂回去。
    s.dynamicChildren = block.filter(c => c !== s)
  }
  return s
}

/**
 * 作用：在存在未决 suspense 时缓存 post effects，否则直接进入全局 post flush 队列。
 */
export function queueEffectWithSuspense(
  fn: Function | Function[],
  suspense: SuspenseBoundary | null,
): void {
  if (suspense && suspense.pendingBranch) {
    if (isArray(fn)) {
      suspense.effects.push(...fn)
    } else {
      suspense.effects.push(fn)
    }
  } else {
    queuePostFlushCb(fn)
  }
}

/**
 * 作用：切换当前 suspense 的激活分支，并把 host el 同步回 suspense vnode 和父组件链。
 */
function setActiveBranch(suspense: SuspenseBoundary, branch: VNode) {
  suspense.activeBranch = branch
  const { vnode, parentComponent } = suspense
  let el = branch.el
  // 某些 HOC / 异步包装层本身没有直接 el，需要继续向子树里钻到真实宿主节点。
  while (!el && branch.component) {
    branch = branch.component.subTree
    el = branch.el
  }
  vnode.el = el
  // in case suspense is the root node of a component,
  // recursively update the HOC el
  if (parentComponent && parentComponent.subTree === vnode) {
    parentComponent.vnode.el = el
    updateHOCHostEl(parentComponent, el)
  }
}

/**
 * 作用：判断当前 suspense 是否声明为可并入父 suspense 的依赖。
 */
function isVNodeSuspensible(vnode: VNode) {
  const suspensible = vnode.props && vnode.props.suspensible
  return suspensible != null && suspensible !== false
}
