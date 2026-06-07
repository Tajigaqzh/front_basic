/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 componentFunctional.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import {
  type ComponentOptions,
  type FunctionalComponent,
  getCurrentInstance,
} from '../component'
import { resolveInjections } from '../componentOptions'
import type { InternalSlots } from '../componentSlots'
import { getCompatListeners } from './instanceListeners'
import { compatH } from './renderFn'

const normalizedFunctionalComponentMap = new WeakMap<
  ComponentOptions,
  FunctionalComponent
>()

// 这个代理把 `ctx.slots.foo` 包装成 Vue 2 `$scopedSlots.foo()` 的访问体验。
export const legacySlotProxyHandlers: ProxyHandler<InternalSlots> = {
  get(target, key: string) {
    const slot = target[key]
    return slot && slot()
  },
}

/**
 * 作用：把 Vue 2 `functional: true` 组件对象转换成 Vue 3 函数组件。
 *
 * 转换重点：
 * - 构造旧版 `legacyCtx`
 * - 兼容 listeners / injections / scopedSlots / children / data
 * - 保留 props、displayName、compatConfig 等元信息
 */
export function convertLegacyFunctionalComponent(
  comp: ComponentOptions,
): FunctionalComponent {
  if (normalizedFunctionalComponentMap.has(comp)) {
    return normalizedFunctionalComponentMap.get(comp)!
  }

  const legacyFn = comp.render as any

  const Func: FunctionalComponent = (props, ctx) => {
    const instance = getCurrentInstance()!

    // 这里拼的是 Vue 2 functional render 的第二个参数签名。
    const legacyCtx = {
      props,
      children: instance.vnode.children || [],
      data: instance.vnode.props || {},
      scopedSlots: ctx.slots,
      parent: instance.parent && instance.parent.proxy,
      slots() {
        return new Proxy(ctx.slots, legacySlotProxyHandlers)
      },
      get listeners() {
        return getCompatListeners(instance)
      },
      get injections() {
        // Vue 2 functional 组件里可以直接从 ctx.injections 读 inject 值，这里按需懒解析。
        if (comp.inject) {
          const injections = {}
          resolveInjections(comp.inject, injections)
          return injections
        }
        return {}
      },
    }
    return legacyFn(compatH, legacyCtx)
  }
  Func.props = comp.props
  Func.displayName = comp.name
  Func.compatConfig = comp.compatConfig
  // Vue 2 functional 组件默认不继承 attrs，这里保持同样语义。
  Func.inheritAttrs = false

  normalizedFunctionalComponentMap.set(comp, Func)
  return Func
}
