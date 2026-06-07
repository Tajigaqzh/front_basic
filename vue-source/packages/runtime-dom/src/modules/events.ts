/**
 * 文件作用：处理某一类 DOM 属性写入。
 *
 * 当前文件 events.ts 专门负责一类浏览器属性更新策略，
 * 让 patchProp 可以把总分发继续下沉到更细的实现里。
 */

import { NOOP, hyphenate, isArray, isFunction } from '@vue-source/shared'
import {
  type ComponentInternalInstance,
  ErrorCodes,
  callWithAsyncErrorHandling,
  warn,
} from '@vue-source/runtime-core'

interface Invoker extends EventListener {
  // `value` 保存当前最新事件处理函数；更新监听时通常只改它，不重新解绑/绑定 DOM。
  value: EventValue
  // `attached` 记录 invoker 绑定到 DOM 时的时间戳，用于过滤同一轮事件冒泡中的误触发。
  attached: number
}

type EventValue = Function | Function[]

/**
 * 绑定原生事件监听。
 */
export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.addEventListener(event, handler, options)
}

/**
 * 解绑原生事件监听。
 */
export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.removeEventListener(event, handler, options)
}

/**
 * DOM 元素上缓存 Vue 事件 invoker 的私有 key。
 */
const veiKey: unique symbol = Symbol('_vei')

/**
 * 更新某个 DOM 事件监听。
 *
 * 主要功能：
 * - 已存在 invoker 时直接替换回调引用
 * - 新增事件时创建 invoker 并绑定
 * - 删除事件时解绑并清理缓存
 */
export function patchEvent(
  el: Element & { [veiKey]?: Record<string, Invoker | undefined> },
  rawName: string,
  prevValue: EventValue | null,
  nextValue: EventValue | unknown,
  instance: ComponentInternalInstance | null = null,
): void {
  /**
   * 更新元素上的原生事件监听。
   *
   * 主要功能：
   * - 初次绑定时创建 invoker 并注册到 DOM
   * - 更新时只替换 invoker.value，避免反复 remove / addEventListener
   * - 删除时再真正解绑 DOM 事件
   *
   * 参数：
   * - `el`：目标 DOM 元素
   * - `rawName`：Vue 侧事件名，如 `onClickOnce`
   * - `prevValue`：旧事件处理函数
   * - `nextValue`：新事件处理函数
   * - `instance`：当前组件实例，用于错误处理时定位上下文
   */
  // vei = vue event invokers
  // `invokers` 是挂在元素上的事件缓存表。
  // key 是 Vue 侧原始事件名，value 是真正绑定到 DOM 的统一包装函数。
  const invokers = el[veiKey] || (el[veiKey] = {})
  // `existingInvoker` 表示这个 DOM 元素在当前 rawName 下是否已经绑定过统一包装函数。
  const existingInvoker = invokers[rawName]
  if (nextValue && existingInvoker) {
    // patch
    // 更新时只替换 invoker 内部引用，避免频繁 remove/addEventListener。
    existingInvoker.value = __DEV__
      ? sanitizeEventValue(nextValue, rawName)
      : (nextValue as EventValue)
  } else {
    const [name, options] = parseName(rawName)
    if (nextValue) {
      // add
      const invoker = (invokers[rawName] = createInvoker(
        __DEV__
          ? sanitizeEventValue(nextValue, rawName)
          : (nextValue as EventValue),
        instance,
      ))
      addEventListener(el, name, invoker, options)
    } else if (existingInvoker) {
      // remove
      // 只有从“有监听”变为“无监听”时，才真正解绑 DOM 事件。
      removeEventListener(el, name, existingInvoker, options)
      invokers[rawName] = undefined
    }
  }
}

const optionsModifierRE = /(?:Once|Passive|Capture)$/

/**
 * 解析运行时事件名。
 *
 * 例如：
 * - `onClickOnceCapture`
 * 会被拆成：
 * - `click`
 * - `{ once: true, capture: true }`
 */
function parseName(name: string): [string, EventListenerOptions | undefined] {
  /**
   * 解析 Vue 事件 prop 名，拆出真正的 DOM 事件名和 addEventListener 选项。
   *
   * 例如：
   * - `onClickOnceCapture`
   * 会被拆成：
   * - `click`
   * - `{ once: true, capture: true }`
   */
  let options: EventListenerOptions | undefined
  if (optionsModifierRE.test(name)) {
    options = {}
    let m
    while ((m = name.match(optionsModifierRE))) {
      // 后缀修饰符按尾部一层层剥离，例如 `onClickOnceCapture` -> `onClick` + options。
      name = name.slice(0, name.length - m[0].length)
      ;(options as any)[m[0].toLowerCase()] = true
    }
  }
  const event = name[2] === ':' ? name.slice(3) : hyphenate(name.slice(2))
  return [event, options]
}

// To avoid the overhead of repeatedly calling Date.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow: number = 0
const p = /*@__PURE__*/ Promise.resolve()
// 同一事件循环内复用一个时间戳，避免每次绑定监听都触发一次 `Date.now()`。
const getNow = () =>
  cachedNow || (p.then(() => (cachedNow = 0)), (cachedNow = Date.now()))

/**
 * 创建真正绑定到 DOM 上的 invoker。
 *
 * 作用：
 * - 统一处理单个函数和函数数组
 * - 包装错误处理
 * - 利用时间戳避免事件在同一轮 patch 中被错误重复触发
 */
function createInvoker(
  initialValue: EventValue,
  instance: ComponentInternalInstance | null,
) {
  /**
   * 创建真实绑定到 DOM 的事件包装函数。
   *
   * 主要功能：
   * - 把单个函数和函数数组统一成一个 invoker
   * - 接入组件级错误处理
   * - 用时间戳避免“事件冒泡过程中刚 patch 上去的新监听被同一次事件再次触发”
   */
  const invoker: Invoker = (e: Event & { _vts?: number }) => {
    // async edge case vuejs/vue#6566
    // inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // this no longer happens for templates in Vue 3, but could still be
    // theoretically possible for hand-written render functions.
    // the solution: we save the timestamp when a handler is attached,
    // and also attach the timestamp to any event that was handled by vue
    // for the first time (to avoid inconsistent event timestamp implementations
    // or events fired from iframes, e.g. #2513)
    // The handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    // `_vts` 表示这次事件第一次被 Vue 处理时记录下来的时间戳。
    // 只有事件发生时间晚于监听绑定时间，当前 invoker 才应该响应它。
    if (!e._vts) {
      e._vts = Date.now()
    } else if (e._vts <= invoker.attached) {
      return
    }
    const value = invoker.value
    if (isArray(value)) {
      // 数组监听时，需要自行模拟 stopImmediatePropagation 对后续 handler 的短路效果。
      const originalStop = e.stopImmediatePropagation
      e.stopImmediatePropagation = () => {
        originalStop.call(e)
        ;(e as any)._stopped = true
      }
      const handlers = value.slice()
      const args = [e]
      for (let i = 0; i < handlers.length; i++) {
        if ((e as any)._stopped) {
          break
        }
        const handler = handlers[i]
        if (handler) {
          callWithAsyncErrorHandling(
            handler,
            instance,
            ErrorCodes.NATIVE_EVENT_HANDLER,
            args,
          )
        }
      }
    } else {
      callWithAsyncErrorHandling(
        value,
        instance,
        ErrorCodes.NATIVE_EVENT_HANDLER,
        [e],
      )
    }
  }
  invoker.value = initialValue
  // 记录“监听何时被挂上去”，后续用来过滤同一轮冒泡中刚补上的监听。
  invoker.attached = getNow()
  return invoker
}

/**
 * 清洗事件值，确保最终拿到的是合法回调。
 */
function sanitizeEventValue(value: unknown, propName: string): EventValue {
  /**
   * 校验事件值是否合法。
   *
   * 为什么需要它：
   * - 运行时最终只能执行函数或函数数组
   * - 一旦用户把普通值错写成事件监听，开发期需要尽早暴露问题
   */
  if (isFunction(value) || isArray(value)) {
    return value as EventValue
  }
  warn(
    `Wrong type passed as event handler to ${propName} - did you forget @ or : ` +
      `in front of your prop?\nExpected function or array of functions, received type ${typeof value}.`,
  )
  return NOOP
}
