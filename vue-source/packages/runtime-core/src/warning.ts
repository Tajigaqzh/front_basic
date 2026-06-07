/**
 * 文件作用：统一运行时 warning 输出链路。
 *
 * 它负责：
 * - 维护 warning 触发时的组件上下文栈
 * - 格式化组件 trace
 * - 调用 `app.config.warnHandler` 或回退到 `console.warn`
 *
 * 这份文件和 `errorHandling.ts` 的关系是：
 * - `errorHandling` 处理“异常”
 * - 这里处理“警告”
 */

import type { VNode } from './vnode'
import {
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Data,
  formatComponentName,
} from './component'
import { isFunction, isString } from '@vue-source/shared'
import { isRef, pauseTracking, resetTracking, toRaw } from '@vue-source/reactivity'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'

type ComponentVNode = VNode & {
  type: ConcreteComponent
}

// 这条栈保存当前 warning 触发点对应的 vnode 链路，后面格式化组件 trace 时会用到。
const stack: VNode[] = []

type TraceEntry = {
  vnode: ComponentVNode
  recurseCount: number
}

type ComponentTraceStack = TraceEntry[]

/**
 * 作用：把当前 vnode 压入 warning 上下文栈。
 *
 * 调用场景：
 * - 渲染器、组件处理流程在可能触发 warning 的位置前后成对调用
 */
export function pushWarningContext(vnode: VNode): void {
  stack.push(vnode)
}

/**
 * 作用：弹出当前 warning 上下文。
 */
export function popWarningContext(): void {
  stack.pop()
}

let isWarning = false

/**
 * 作用：输出运行时 warning，并附带组件追踪信息。
 *
 * 参数说明：
 * - `msg`：基础警告文案。
 * - `args`：额外补充数据，会透传给 warnHandler 或 console.warn。
 */
export function warn(msg: string, ...args: any[]): void {
  if (isWarning) return
  isWarning = true

  // 警告格式化时可能读取 props / ref，先暂停追踪，避免 patch 中形成递归依赖。
  pauseTracking()

  const instance = stack.length ? stack[stack.length - 1].component : null
  const appWarnHandler = instance && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      ErrorCodes.APP_WARN_HANDLER,
      [
        // eslint-disable-next-line no-restricted-syntax
        msg + args.map(a => a.toString?.() ?? JSON.stringify(a)).join(''),
        instance && instance.proxy,
        trace
          .map(
            ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`,
          )
          .join('\n'),
        trace,
      ],
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    if (
      trace.length &&
      // avoid spamming console during tests
      !__TEST__
    ) {
      /* v8 ignore next 2 */
      warnArgs.push(`\n`, ...formatTrace(trace))
    }
    console.warn(...warnArgs)
  }

  resetTracking()
  isWarning = false
}

/**
 * 作用：根据当前 warning 栈和组件父链重建一条可读的组件追踪路径。
 */
export function getComponentTrace(): ComponentTraceStack {
  let currentVNode: VNode | null = stack[stack.length - 1]
  if (!currentVNode) {
    return []
  }

  // 直接用 warning 栈在更新中可能不完整，这里沿着组件 parent 指针重建完整链路。
  const normalizedStack: ComponentTraceStack = []

  while (currentVNode) {
    const last = normalizedStack[0]
    if (last && last.vnode === currentVNode) {
      last.recurseCount++
    } else {
      normalizedStack.push({
        vnode: currentVNode as ComponentVNode,
        recurseCount: 0,
      })
    }
    const parentInstance: ComponentInternalInstance | null =
      currentVNode.component && currentVNode.component.parent
    currentVNode = parentInstance && parentInstance.vnode
  }

  return normalizedStack
}

/* v8 ignore start */
function formatTrace(trace: ComponentTraceStack): any[] {
  const logs: any[] = []
  trace.forEach((entry, i) => {
    logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
  })
  return logs
}

function formatTraceEntry({ vnode, recurseCount }: TraceEntry): any[] {
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const isRoot = vnode.component ? vnode.component.parent == null : false
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot,
  )}`
  const close = `>` + postfix
  return vnode.props
    ? [open, ...formatProps(vnode.props), close]
    : [open + close]
}

function formatProps(props: Data): any[] {
  const res: any[] = []
  const keys = Object.keys(props)
  keys.slice(0, 3).forEach(key => {
    res.push(...formatProp(key, props[key]))
  })
  if (keys.length > 3) {
    res.push(` ...`)
  }
  return res
}

function formatProp(key: string, value: unknown): any[]
function formatProp(key: string, value: unknown, raw: true): any
function formatProp(key: string, value: unknown, raw?: boolean): any {
  if (isString(value)) {
    value = JSON.stringify(value)
    return raw ? value : [`${key}=${value}`]
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return raw ? value : [`${key}=${value}`]
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true)
    return raw ? value : [`${key}=Ref<`, value, `>`]
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`]
  } else {
    value = toRaw(value)
    return raw ? value : [`${key}=`, value]
  }
}

/**
 * 作用：开发阶段校验某个值是否为合法数字。
 */
export function assertNumber(val: unknown, type: string): void {
  if (!__DEV__) return
  if (val === undefined) {
    return
  } else if (typeof val !== 'number') {
    warn(`${type} is not a valid number - ` + `got ${JSON.stringify(val)}.`)
  } else if (isNaN(val)) {
    warn(`${type} is NaN - ` + 'the duration expression might be incorrect.')
  }
}
/* v8 ignore stop */
