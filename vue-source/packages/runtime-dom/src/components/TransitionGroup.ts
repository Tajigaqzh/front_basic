/**
 * 文件作用：实现浏览器环境下的 `TransitionGroup` 运行时能力。
 *
 * 它在普通 `Transition` 的 enter/leave 基础上，
 * 额外负责“同级列表节点移动”这一类动画场景。
 *
 * 核心思路就是典型的 FLIP：
 * - First：记录旧位置
 * - Last：记录新位置
 * - Invert：先施加反向位移
 * - Play：去掉反向位移，让浏览器过渡到真实位置
 */

import {
  type ElementWithTransition,
  type TransitionProps,
  TransitionPropsValidators,
  addTransitionClass,
  forceReflow,
  getTransitionInfo,
  removeTransitionClass,
  resolveTransitionProps,
  vtcKey,
} from './Transition'
import {
  type ComponentOptions,
  DeprecationTypes,
  Fragment,
  type SetupContext,
  Text,
  type VNode,
  compatUtils,
  createVNode,
  getCurrentInstance,
  getTransitionRawChildren,
  onUpdated,
  resolveTransitionHooks,
  setTransitionHooks,
  toRaw,
  useTransitionState,
  warn,
} from '@vue-source/runtime-core'
import { extend } from '@vue-source/shared'

interface Position {
  top: number
  left: number
}

// 旧位置和新位置分开存，便于在更新后计算每个子节点位移量。
const positionMap = new WeakMap<VNode, Position>()
const newPositionMap = new WeakMap<VNode, Position>()
const moveCbKey = Symbol('_moveCb')
const enterCbKey = Symbol('_enterCb')

export type TransitionGroupProps = Omit<TransitionProps, 'mode'> & {
  tag?: string
  moveClass?: string
}

/**
 * 作用：给 TransitionGroup 组件补充运行时元信息。
 */
const decorate = (t: typeof TransitionGroupImpl) => {
  // TransitionGroup 不支持 `mode`，这里把继承自 Transition 的该字段移除。
  delete t.props.mode
  if (__COMPAT__) {
    t.__isBuiltIn = true
  }
  return t
}

const TransitionGroupImpl: ComponentOptions = /*@__PURE__*/ decorate({
  name: 'TransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state = useTransitionState()
    // `prevChildren` 保存更新前仍在 DOM 中的可移动子节点。
    let prevChildren: VNode[]
    // `children` 保存本轮渲染输出的子节点。
    let children: VNode[]

    onUpdated(() => {
      // 首次渲染后 children 一定已经建立，这里只处理更新阶段。
      if (!prevChildren.length) {
        return
      }
      const moveClass = props.moveClass || `${props.name || 'v'}-move`

      if (
        !hasCSSTransform(
          prevChildren[0].el as ElementWithTransition,
          instance.vnode.el as Node,
          moveClass,
        )
      ) {
        // 如果 moveClass 根本没有声明 transform 过渡，就没必要走整套 FLIP 计算。
        prevChildren = []
        return
      }

      // 分三轮执行，避免读写交叉导致布局抖动：
      // 1. 清理旧回调
      // 2. 读取新位置
      // 3. 回写反向位移
      prevChildren.forEach(callPendingCbs)
      prevChildren.forEach(recordPosition)
      const movedChildren = prevChildren.filter(applyTranslation)

      // 强制重排，让浏览器确认“从旧位置瞬移到新位置”的起点状态。
      forceReflow(instance.vnode.el as Node)

      movedChildren.forEach(c => {
        const el = c.el as ElementWithTransition
        const style = el.style
        addTransitionClass(el, moveClass)
        style.transform = style.webkitTransform = style.transitionDuration = ''
        const cb = ((el as any)[moveCbKey] = (e: TransitionEvent) => {
          if (e && e.target !== el) {
            return
          }
          if (!e || e.propertyName.endsWith('transform')) {
            el.removeEventListener('transitionend', cb)
            ;(el as any)[moveCbKey] = null
            removeTransitionClass(el, moveClass)
          }
        })
        el.addEventListener('transitionend', cb)
      })
      prevChildren = []
    })

    return () => {
      // 每次渲染都要重新给当前 children 挂上过渡钩子，
      // 这样 enter/leave/move 才能和最新 vnode 树对齐。
      const rawProps = toRaw(props)
      const cssTransitionProps = resolveTransitionProps(rawProps)
      let tag = rawProps.tag || Fragment

      if (
        __COMPAT__ &&
        !rawProps.tag &&
        compatUtils.checkCompatEnabled(
          DeprecationTypes.TRANSITION_GROUP_ROOT,
          instance.parent,
        )
      ) {
        tag = 'span'
      }

      prevChildren = []
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (child.el && child.el instanceof Element) {
            prevChildren.push(child)
            // 更新前先给旧子节点挂上过渡钩子，并记录当前位置。
            setTransitionHooks(
              child,
              resolveTransitionHooks(
                child,
                cssTransitionProps,
                state,
                instance,
              ),
            )
            positionMap.set(child, getPosition(child.el as HTMLElement))
          }
        }
      }

      children = slots.default ? getTransitionRawChildren(slots.default()) : []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.key != null) {
          // TransitionGroup 依赖 key 识别复用和移动目标。
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance),
          )
        } else if (__DEV__ && child.type !== Text) {
          warn(`<TransitionGroup> children must be keyed.`)
        }
      }

      return createVNode(tag, null, children)
    }
  },
})

export const TransitionGroup = TransitionGroupImpl as unknown as {
  new (): {
    $props: TransitionGroupProps
  }
}

/**
 * 作用：清掉节点上尚未结束的 enter/move 回调，避免上一轮动画残留影响本轮。
 */
function callPendingCbs(c: VNode) {
  /**
   * 清理节点上尚未结束的 enter/move 回调。
   *
   * 为什么需要它：
   * - 列表项可能在上一次动画还没结束时就进入下一轮更新
   * - 旧回调不清掉，新的位移动画很容易被旧的 transitionend 逻辑干扰
   */
  const el = c.el as any
  if (el[moveCbKey]) {
    el[moveCbKey]()
  }
  if (el[enterCbKey]) {
    el[enterCbKey]()
  }
}

/**
 * 作用：记录子节点更新后的新位置。
 */
function recordPosition(c: VNode) {
  /**
   * 记录节点更新后的新屏幕坐标。
   *
   * 这一步对应 FLIP 里的 Last。
   */
  newPositionMap.set(c, getPosition(c.el as HTMLElement))
}

/**
 * 作用：根据前后位置差给节点施加一个“反向位移”，为 FLIP 动画做准备。
 */
function applyTranslation(c: VNode): VNode | undefined {
  /**
   * 根据旧位置和新位置给节点施加一个“反向位移”。
   *
   * 这一步对应 FLIP 里的 Invert：
   * - 元素真实位置其实已经变了
   * - 先用 transform 把它瞬间拉回旧位置
   * - 后续再移除 transform，让浏览器自然过渡到新位置
   */
  const oldPos = positionMap.get(c)!
  const newPos = newPositionMap.get(c)!
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const el = c.el as HTMLElement
    const s = el.style
    const rect = el.getBoundingClientRect()
    let scaleX = 1
    let scaleY = 1
    if (el.offsetWidth) scaleX = rect.width / el.offsetWidth
    if (el.offsetHeight) scaleY = rect.height / el.offsetHeight
    if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1
    if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1
    // 缩放几乎等于 1 时直接按 1 处理，减少浮点误差造成的位移抖动。
    if (Math.abs(scaleX - 1) < 0.01) scaleX = 1
    if (Math.abs(scaleY - 1) < 0.01) scaleY = 1
    // 某些场景元素本身带缩放，位移量要按当前缩放比例折算，否则视觉移动距离会不准。
    s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${
      dy / scaleY
    }px)`
    // 先把 transitionDuration 设成 0，让“瞬移回旧位置”这一步不出现可见动画。
    s.transitionDuration = '0s'
    return c
  }
}

/**
 * 作用：读取元素当前的屏幕坐标。
 */
function getPosition(el: HTMLElement): Position {
  // 这里取的是视口坐标；对于 FLIP 来说，只要前后比较使用同一坐标系即可。
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
  }
}

/**
 * 作用：探测当前 moveClass 是否真的声明了 transform 过渡。
 */
function hasCSSTransform(
  el: ElementWithTransition,
  root: Node,
  moveClass: string,
): boolean {
  // 通过克隆节点单独挂 moveClass，排除其他过渡类的干扰，再探测是否有 transform 过渡。
  const clone = el.cloneNode() as HTMLElement
  const _vtc = el[vtcKey]
  if (_vtc) {
    _vtc.forEach(cls => {
      cls.split(/\s+/).forEach(c => c && clone.classList.remove(c))
    })
  }
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'
  const container = (
    root.nodeType === 1 ? root : root.parentNode
  ) as HTMLElement
  // 把克隆节点临时插进真实容器，是为了让浏览器基于当前上下文算出准确过渡信息。
  container.appendChild(clone)
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}
