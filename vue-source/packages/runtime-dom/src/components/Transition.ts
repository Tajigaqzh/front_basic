/**
 * 文件作用：实现浏览器环境下的 `Transition` 运行时能力。
 *
 * 它在 `BaseTransition` 的平台无关流程上，补齐了浏览器专属能力：
 * - 过渡 class 切换
 * - 双 `requestAnimationFrame` 时序
 * - `transitionend / animationend` 监听
 * - 强制重排
 * - CSS 过渡信息探测
 */

import {
  BaseTransition,
  type BaseTransitionProps,
  BaseTransitionPropsValidators,
  DeprecationTypes,
  type FunctionalComponent,
  assertNumber,
  compatUtils,
  h,
} from '@vue-source/runtime-core'
import { extend, isArray, isObject, toNumber } from '@vue-source/shared'

const TRANSITION = 'transition'
const ANIMATION = 'animation'

type AnimationTypes = typeof TRANSITION | typeof ANIMATION

export interface TransitionProps extends BaseTransitionProps<Element> {
  name?: string
  type?: AnimationTypes
  css?: boolean
  duration?: number | { enter: number; leave: number }
  // custom transition classes
  enterFromClass?: string
  enterActiveClass?: string
  enterToClass?: string
  appearFromClass?: string
  appearActiveClass?: string
  appearToClass?: string
  leaveFromClass?: string
  leaveActiveClass?: string
  leaveToClass?: string
}

// 元素上暂存的过渡类名集合，class patch 时会把它们一起保留。
export const vtcKey: unique symbol = Symbol('_vtc')

export interface ElementWithTransition extends HTMLElement {
  // `_vtc` 保存过渡过程中临时添加的 class，避免普通 class patch 把它们冲掉。
  [vtcKey]?: Set<string>
}

const DOMTransitionPropsValidators = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: true,
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String,
}

export const TransitionPropsValidators: any = /*@__PURE__*/ extend(
  {},
  BaseTransitionPropsValidators as any,
  DOMTransitionPropsValidators,
)

/**
 * 作用：给 Transition 组件补充运行时元信息。
 */
const decorate = (t: typeof Transition) => {
  t.displayName = 'Transition'
  t.props = TransitionPropsValidators
  if (__COMPAT__) {
    t.__isBuiltIn = true
  }
  return t
}

/**
 * 作用：DOM 环境下的 Transition 组件。
 *
 * 它本质上是对平台无关的 `BaseTransition` 做了一层包装，
 * 主要补充浏览器里的 class 切换、重排、transitionend 监听等逻辑。
 */
export const Transition: FunctionalComponent<TransitionProps> =
  /*@__PURE__*/ decorate((props, { slots }) =>
    h(BaseTransition, resolveTransitionProps(props), slots),
  )

/**
 * 作用：统一调用单个或数组形式的过渡钩子。
 */
const callHook = (
  hook: Function | Function[] | undefined,
  args: any[] = [],
) => {
  // 统一抹平“单个钩子 / 钩子数组”两种形态，后续流程就不需要反复分支。
  if (isArray(hook)) {
    hook.forEach(h => h(...args))
  } else if (hook) {
    hook(...args)
  }
}

/**
 * 作用：判断用户钩子是否要求手动调用 done 来结束过渡。
 */
const hasExplicitCallback = (
  hook: Function | Function[] | undefined,
): boolean => {
  // 用户钩子如果声明了第二个参数，说明它要手动调用 done；
  // 这时运行时不能再自动根据 CSS 结束事件收尾，否则会出现重复结束。
  return hook
    ? isArray(hook)
      ? hook.some(h => h.length > 1)
      : hook.length > 1
    : false
}

/**
 * 作用：把用户传入的 Transition props 解析成 BaseTransition 真正要用的过渡钩子。
 */
export function resolveTransitionProps(
  rawProps: TransitionProps,
): BaseTransitionProps<Element> {
  /**
   * 把 DOM 专属过渡配置解析成 `BaseTransition` 真正消费的钩子集合。
   *
   * 主要功能：
   * - 过滤出非 DOM 专属字段，保留给 BaseTransition
   * - 基于类名前缀生成 enter/appear/leave 三套 class 名
   * - 把用户钩子和浏览器 class 切换流程组装成统一过渡钩子
   *
   * 返回值：
   * - 返回可直接传给 `BaseTransition` 的 props 对象
   */
  const baseProps: BaseTransitionProps<Element> = {}
  for (const key in rawProps) {
    if (!(key in DOMTransitionPropsValidators)) {
      ;(baseProps as any)[key] = (rawProps as any)[key]
    }
  }

  if (rawProps.css === false) {
    return baseProps
  }

  const {
    name = 'v',
    type,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    appearFromClass = enterFromClass,
    appearActiveClass = enterActiveClass,
    appearToClass = enterToClass,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
  } = rawProps

  // legacy transition class compat
  const legacyClassEnabled =
    __COMPAT__ &&
    compatUtils.isCompatEnabled(DeprecationTypes.TRANSITION_CLASSES, null)
  let legacyEnterFromClass: string
  let legacyAppearFromClass: string
  let legacyLeaveFromClass: string
  if (__COMPAT__ && legacyClassEnabled) {
    const toLegacyClass = (cls: string) => cls.replace(/-from$/, '')
    if (!rawProps.enterFromClass) {
      legacyEnterFromClass = toLegacyClass(enterFromClass)
    }
    if (!rawProps.appearFromClass) {
      legacyAppearFromClass = toLegacyClass(appearFromClass)
    }
    if (!rawProps.leaveFromClass) {
      legacyLeaveFromClass = toLegacyClass(leaveFromClass)
    }
  }

  // `durations` 把 number / object 形式统一成 `[enter, leave]`。
  const durations = normalizeDuration(duration)
  // `enterDuration` / `leaveDuration` 是显式指定的兜底时长。
  // 传了它们就不再依赖浏览器样式探测，避免某些动态样式场景拿到不稳定值。
  const enterDuration = durations && durations[0]
  const leaveDuration = durations && durations[1]
  const {
    onBeforeEnter,
    onEnter,
    onEnterCancelled,
    onLeave,
    onLeaveCancelled,
    onBeforeAppear = onBeforeEnter,
    onAppear = onEnter,
    onAppearCancelled = onEnterCancelled,
  } = baseProps

  // 进入阶段结束时统一清理 class，并触发 done。
  const finishEnter = (
    el: Element & { _enterCancelled?: boolean },
    isAppear: boolean,
    done?: () => void,
    isCancelled?: boolean,
  ) => {
    // 进入态结束时必须把 `*-to` / `*-active` 清掉，否则元素会长期停留在过渡类名里。
    el._enterCancelled = isCancelled
    removeTransitionClass(el, isAppear ? appearToClass : enterToClass)
    removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass)
    done && done()
  }

  // 离开阶段结束时统一清理 class，并触发 done。
  const finishLeave = (
    el: Element & { _isLeaving?: boolean },
    done?: () => void,
  ) => {
    // 离开态结束后，元素通常马上会被移除；这里先把离开标记和 class 清干净，
    // 避免下次复用该元素时带着旧状态。
    el._isLeaving = false
    removeTransitionClass(el, leaveFromClass)
    removeTransitionClass(el, leaveToClass)
    removeTransitionClass(el, leaveActiveClass)
    done && done()
  }

  // enter 和 appear 只有 class 名不同，主流程可以复用一套工厂。
  // enter 和 appear 的主体流程一致，只是 class 名和用户钩子来源不同。
  const makeEnterHook = (isAppear: boolean) => {
    /**
     * 生成 enter / appear 阶段的真实运行时钩子。
     *
     * 流程大致是：
     * 1. 先调用用户钩子，暴露 `done`
     * 2. 下一帧把 `*-from` 切成 `*-to`
     * 3. 若用户没手动接管结束，则监听 CSS 过渡自然结束
     */
    return (el: Element, done: () => void) => {
      // `resolve` 把 BaseTransition 的 done 和 DOM class 清理绑在一起，
      // 确保无论用户手动结束还是运行时自动结束，收尾动作都一致。
      const hook = isAppear ? onAppear : onEnter
      const resolve = () => finishEnter(el, isAppear, done)
      callHook(hook, [el, resolve])
      nextFrame(() => {
        // 双 rAF 之后再从 `*-from` 切到 `*-to`，浏览器才能稳定识别这是一次过渡。
        removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass)
        if (__COMPAT__ && legacyClassEnabled) {
          const legacyClass = isAppear
            ? legacyAppearFromClass
            : legacyEnterFromClass
          if (legacyClass) {
            removeTransitionClass(el, legacyClass)
          }
        }
        addTransitionClass(el, isAppear ? appearToClass : enterToClass)
        if (!hasExplicitCallback(hook)) {
          // 用户没有接管 done 时，由运行时根据真实 CSS 持续时间自动收尾。
          whenTransitionEnds(el, type, enterDuration, resolve)
        }
      })
    }
  }

  return extend(baseProps, {
    onBeforeEnter(el) {
      // beforeEnter 只负责建立初始 class 状态，不在这里触发真正的过渡结束监听。
      callHook(onBeforeEnter, [el])
      addTransitionClass(el, enterFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyEnterFromClass) {
        addTransitionClass(el, legacyEnterFromClass)
      }
      addTransitionClass(el, enterActiveClass)
    },
    onBeforeAppear(el) {
      // appear 本质上是“首次挂载时的 enter”，只是类名和用户钩子可单独配置。
      callHook(onBeforeAppear, [el])
      addTransitionClass(el, appearFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyAppearFromClass) {
        addTransitionClass(el, legacyAppearFromClass)
      }
      addTransitionClass(el, appearActiveClass)
    },
    onEnter: makeEnterHook(false),
    onAppear: makeEnterHook(true),
    onLeave(
      el: Element & { _isLeaving?: boolean; _enterCancelled?: boolean },
      done,
    ) {
      // leave 的关键点是先建立 from/active 态，再强制重排，最后下一帧切到 to 态。
      el._isLeaving = true
      const resolve = () => finishLeave(el, done)
      addTransitionClass(el, leaveFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyLeaveFromClass) {
        addTransitionClass(el, legacyLeaveFromClass)
      }
      // add *-leave-active class before reflow so in the case of a cancelled enter transition
      // the css will not get the final state (#10677)
      if (!el._enterCancelled) {
        // force reflow so *-leave-from classes immediately take effect (#2593)
        forceReflow(el)
        addTransitionClass(el, leaveActiveClass)
      } else {
        addTransitionClass(el, leaveActiveClass)
        forceReflow(el)
      }
      nextFrame(() => {
        if (!el._isLeaving) {
          // cancelled
          return
        }
        removeTransitionClass(el, leaveFromClass)
        if (__COMPAT__ && legacyClassEnabled && legacyLeaveFromClass) {
          removeTransitionClass(el, legacyLeaveFromClass)
        }
        addTransitionClass(el, leaveToClass)
        if (!hasExplicitCallback(onLeave)) {
          whenTransitionEnds(el, type, leaveDuration, resolve)
        }
      })
      callHook(onLeave, [el, resolve])
    },
    onEnterCancelled(el) {
      // enter/appear 被中断时，也要走统一收尾，把临时 class 清掉。
      finishEnter(el, false, undefined, true)
      callHook(onEnterCancelled, [el])
    },
    onAppearCancelled(el) {
      finishEnter(el, true, undefined, true)
      callHook(onAppearCancelled, [el])
    },
    onLeaveCancelled(el) {
      finishLeave(el)
      callHook(onLeaveCancelled, [el])
    },
  } as BaseTransitionProps<Element>)
}

function normalizeDuration(
  duration: TransitionProps['duration'],
): [number, number] | null {
  /**
   * 归一化显式过渡时长配置。
   *
   * 支持：
   * - `number`
   * - `{ enter, leave }`
   * - `null/undefined`
   */
  if (duration == null) {
    return null
  } else if (isObject(duration)) {
    return [NumberOf(duration.enter), NumberOf(duration.leave)]
  } else {
    const n = NumberOf(duration)
    return [n, n]
  }
}

function NumberOf(val: unknown): number {
  /**
   * 把用户提供的时长值安全转成数字，并在开发环境做合法性校验。
   */
  const res = toNumber(val)
  if (__DEV__) {
    assertNumber(res, '<transition> explicit duration')
  }
  return res
}

export function addTransitionClass(el: Element, cls: string): void {
  /**
   * 给元素添加过渡 class，并记录到 `_vtc` 集合。
   *
   * 这样后续普通 `class` patch 时能把这些临时类一并保留下来，
   * 不会被用户自己的 class 更新冲掉。
   */
  cls.split(/\s+/).forEach(c => c && el.classList.add(c))
  ;(
    (el as ElementWithTransition)[vtcKey] ||
    ((el as ElementWithTransition)[vtcKey] = new Set())
  ).add(cls)
}

export function removeTransitionClass(el: Element, cls: string): void {
  /**
   * 移除过渡 class，并同步更新 `_vtc` 记录。
   */
  cls.split(/\s+/).forEach(c => c && el.classList.remove(c))
  const _vtc = (el as ElementWithTransition)[vtcKey]
  if (_vtc) {
    _vtc.delete(cls)
    if (!_vtc!.size) {
      ;(el as ElementWithTransition)[vtcKey] = undefined
    }
  }
}

function nextFrame(cb: () => void) {
  /**
   * 把回调延后到“下一帧之后再下一帧”。
   *
   * 这样浏览器有机会先应用 `*-from` 和 `*-active`，
   * 下一帧再切到 `*-to`，从而可靠触发 CSS 过渡。
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

let endId = 0
// `endId` 是一个全局单调递增序号。
// 每次开始等待过渡结束时都会写到元素的 `_endId` 上，用来屏蔽过期监听器。

function whenTransitionEnds(
  el: Element & { _endId?: number },
  expectedType: TransitionProps['type'] | undefined,
  explicitTimeout: number | null,
  resolve: () => void,
) {
  /**
   * 等待当前元素的过渡真正结束后再调用 `resolve`。
   *
   * 主要功能：
   * - 优先使用显式 duration
   * - 否则探测元素真实 transition/animation 时长
   * - 用 `_endId` 避免旧监听器在新一轮过渡里误触发
   */
  const id = (el._endId = ++endId)
  const resolveIfNotStale = () => {
    // 同一个元素可能在极短时间内连续进入多轮过渡；
    // 旧一轮的 timeout / end 事件触发时，必须先确认自己仍是“当前这一轮”。
    if (id === el._endId) {
      resolve()
    }
  }

  if (explicitTimeout != null) {
    return setTimeout(resolveIfNotStale, explicitTimeout)
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  if (!type) {
    // 没有任何 transition/animation 时，直接同步结束，避免组件一直卡在 pending。
    return resolve()
  }

  const endEvent = type + 'end'
  // 一个元素可能同时对多个 CSS 属性做过渡，浏览器会触发多次 end 事件；
  // 只有收齐全部属性的结束事件，或者超时兜底到点，才能真正 resolve。
  let ended = 0
  const end = () => {
    el.removeEventListener(endEvent, onEnd)
    resolveIfNotStale()
  }
  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end()
    }
  }
  setTimeout(() => {
    if (ended < propCount) {
      end()
    }
  }, timeout + 1)
  el.addEventListener(endEvent, onEnd)
}

interface CSSTransitionInfo {
  type: AnimationTypes | null
  propCount: number
  timeout: number
  hasTransform: boolean
}

type AnimationProperties = 'Delay' | 'Duration'
type StylePropertiesKey =
  | `${AnimationTypes}${AnimationProperties}`
  | `${typeof TRANSITION}Property`

export function getTransitionInfo(
  el: Element,
  expectedType?: TransitionProps['type'],
): CSSTransitionInfo {
  /**
   * 读取元素当前的真实 CSS 过渡信息。
   *
   * 返回内容包括：
   * - 实际采用的是 transition 还是 animation
   * - 总超时时间
   * - 需要等待多少个属性结束事件
   * - 是否包含 transform 过渡
   */
  const styles = window.getComputedStyle(el) as Pick<
    CSSStyleDeclaration,
    StylePropertiesKey
  >
  // JSDOM may return undefined for transition properties
  const getStyleProperties = (key: StylePropertiesKey) =>
    (styles[key] || '').split(', ')
  const transitionDelays = getStyleProperties(`${TRANSITION}Delay`)
  const transitionDurations = getStyleProperties(`${TRANSITION}Duration`)
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations)
  const animationDelays = getStyleProperties(`${ANIMATION}Delay`)
  const animationDurations = getStyleProperties(`${ANIMATION}Duration`)
  const animationTimeout = getTimeout(animationDelays, animationDurations)

  let type: CSSTransitionInfo['type'] = null
  let timeout = 0
  let propCount = 0
  if (expectedType === TRANSITION) {
    // 用户显式指定 type 时，只看对应类型，避免 transition 和 animation 并存时误判。
    if (transitionTimeout > 0) {
      type = TRANSITION
      timeout = transitionTimeout
      propCount = transitionDurations.length
    }
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION
      timeout = animationTimeout
      propCount = animationDurations.length
    }
  } else {
    // 未指定 type 时，谁的总时长更长就认为当前主导效果是谁。
    timeout = Math.max(transitionTimeout, animationTimeout)
    type =
      timeout > 0
        ? transitionTimeout > animationTimeout
          ? TRANSITION
          : ANIMATION
        : null
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0
  }
  const hasTransform =
    // TransitionGroup 之类的场景需要知道是否存在 transform 过渡，
    // 因为 transform 过渡通常意味着元素正在做移动动画。
    type === TRANSITION &&
    /\b(?:transform|all)(?:,|$)/.test(
      getStyleProperties(`${TRANSITION}Property`).toString(),
    )
  return {
    type,
    timeout,
    propCount,
    hasTransform,
  }
}

function getTimeout(delays: string[], durations: string[]): number {
  /**
   * 计算一组 delay/duration 组合中的最大总时长。
   *
   * 浏览器允许 delay 数量少于 duration，运行时这里会按浏览器规则补齐后再计算。
   */
  while (delays.length < durations.length) {
    // 浏览器会循环复用 delay 列表；这里按同样规则补齐，才能算出真实最大耗时。
    delays = delays.concat(delays)
  }
  return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])))
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer
// numbers in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down
// (i.e. acting as a floor function) causing unexpected behaviors
function toMs(s: string): number {
  /**
   * 把 CSS 时间字符串转成毫秒数。
   *
   * 兼容：
   * - `0.3s`
   * - 老版本浏览器可能出现的逗号小数
   * - `auto`
   */
  // #8409 default value for CSS durations can be 'auto'
  if (s === 'auto') return 0
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}

// synchronously force layout to put elements into a certain state
export function forceReflow(el?: Node): number {
  /**
   * 强制浏览器立即完成一次布局计算。
   *
   * 过渡流程里常用它来确保前一阶段的 class 已经生效，
   * 然后再切换到下一阶段 class，从而稳定触发动画。
   */
  const targetDocument = el ? el.ownerDocument! : document
  return targetDocument.body.offsetHeight
}
