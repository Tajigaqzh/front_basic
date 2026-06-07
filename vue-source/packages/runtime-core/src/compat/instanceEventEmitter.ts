/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 instanceEventEmitter.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isArray } from '@vue-source/shared'
import type { ComponentInternalInstance } from '../component'
import { ErrorCodes, callWithAsyncErrorHandling } from '../errorHandling'
import { DeprecationTypes, assertCompatEnabled } from './compatConfig'
import type { ComponentPublicInstance } from '../componentPublicInstance'

interface EventRegistry {
  [event: string]: Function[] | undefined
}

const eventRegistryMap = /*@__PURE__*/ new WeakMap<
  ComponentInternalInstance,
  EventRegistry
>()

/**
 * 作用：拿到某个组件实例专属的兼容事件注册表。
 */
export function getRegistry(
  instance: ComponentInternalInstance,
): EventRegistry {
  let events = eventRegistryMap.get(instance)
  if (!events) {
    // 每个组件实例独立维护一份 `$on/$off/$emit` 兼容事件表。
    eventRegistryMap.set(instance, (events = Object.create(null)))
  }
  return events!
}

/**
 * 作用：兼容 Vue 2 的 `$on`。
 *
 * 支持单个事件名或事件名数组，把回调记录到当前组件实例的兼容事件表里。
 */
export function on(
  instance: ComponentInternalInstance,
  event: string | string[],
  fn: Function,
): ComponentPublicInstance | null {
  if (isArray(event)) {
    event.forEach(e => on(instance, e, fn))
  } else {
    if (event.startsWith('hook:')) {
      assertCompatEnabled(
        DeprecationTypes.INSTANCE_EVENT_HOOKS,
        instance,
        event,
      )
    } else {
      assertCompatEnabled(DeprecationTypes.INSTANCE_EVENT_EMITTER, instance)
    }
    const events = getRegistry(instance)
    ;(events[event] || (events[event] = [])).push(fn)
  }
  return instance.proxy
}

/**
 * 作用：兼容 Vue 2 的 `$once`。
 */
export function once(
  instance: ComponentInternalInstance,
  event: string,
  fn: Function,
): ComponentPublicInstance | null {
  // 包一层后在首次触发时主动解绑，再执行用户原始回调。
  const wrapped = (...args: any[]) => {
    off(instance, event, wrapped)
    fn.apply(instance.proxy, args)
  }
  wrapped.fn = fn
  on(instance, event, wrapped)
  return instance.proxy
}

/**
 * 作用：兼容 Vue 2 的 `$off`。
 *
 * 不传参数清空全部事件；
 * 传数组批量移除；
 * 传单个事件名时移除整类或指定回调。
 */
export function off(
  instance: ComponentInternalInstance,
  event?: string | string[],
  fn?: Function,
): ComponentPublicInstance | null {
  assertCompatEnabled(DeprecationTypes.INSTANCE_EVENT_EMITTER, instance)
  const vm = instance.proxy
  if (!event) {
    eventRegistryMap.set(instance, Object.create(null))
    return vm
  }
  if (isArray(event)) {
    event.forEach(e => off(instance, e, fn))
    return vm
  }
  const events = getRegistry(instance)
  const cbs = events[event!]
  if (!cbs) {
    return vm
  }
  if (!fn) {
    events[event!] = undefined
    return vm
  }
  events[event!] = cbs.filter(cb => !(cb === fn || (cb as any).fn === fn))
  return vm
}

/**
 * 作用：兼容 Vue 2 的实例级 `$emit`。
 *
 * 这里只会触发通过 `$on/$once` 注册到当前实例兼容事件表里的监听器，
 * 与 Vue 3 正常的组件 emits 机制是两条独立链路。
 */
export function emit(
  instance: ComponentInternalInstance,
  event: string,
  args: any[],
): ComponentPublicInstance | null {
  const cbs = getRegistry(instance)[event]
  if (cbs) {
    callWithAsyncErrorHandling(
      cbs.map(cb => cb.bind(instance.proxy)),
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }
  return instance.proxy
}
