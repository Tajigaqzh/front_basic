/**
 * 文件作用：实现 DOM 专属内置组件。
 *
 * 当前文件 TransitionGroup.ts 负责浏览器环境里的过渡类内置组件，
 * 例如 Transition、TransitionGroup。
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
        prevChildren = []
        return
      }

      // 分三轮执行，避免读写交叉导致布局抖动。
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
  newPositionMap.set(c, getPosition(c.el as HTMLElement))
}

/**
 * 作用：根据前后位置差给节点施加一个“反向位移”，为 FLIP 动画做准备。
 */
function applyTranslation(c: VNode): VNode | undefined {
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
    s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${
      dy / scaleY
    }px)`
    s.transitionDuration = '0s'
    return c
  }
}

/**
 * 作用：读取元素当前的屏幕坐标。
 */
function getPosition(el: HTMLElement): Position {
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
  container.appendChild(clone)
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}
