/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 componentAsync.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isArray, isObject, isPromise } from '@vue-source/shared'
import { defineAsyncComponent } from '../apiAsyncComponent'
import type { Component } from '../component'
import { isVNode } from '../vnode'

interface LegacyAsyncOptions {
  component: Promise<Component>
  loading?: Component
  error?: Component
  delay?: number
  timeout?: number
}

type LegacyAsyncReturnValue = Promise<Component> | LegacyAsyncOptions

type LegacyAsyncComponent = (
  resolve?: (res: LegacyAsyncReturnValue) => void,
  reject?: (reason?: any) => void,
) => LegacyAsyncReturnValue | undefined

const normalizedAsyncComponentMap = new WeakMap<
  LegacyAsyncComponent,
  Component
>()

/**
 * 作用：把 Vue 2 风格异步组件工厂函数转换成 Vue 3 异步组件定义。
 *
 * 支持的旧写法：
 * - 直接返回 Promise
 * - 返回 `{ component, loading, error, delay, timeout }`
 * - 不直接返回值，而是通过 `resolve/reject` 回调异步给结果
 */
export function convertLegacyAsyncComponent(
  comp: LegacyAsyncComponent,
): Component {
  if (normalizedAsyncComponentMap.has(comp)) {
    return normalizedAsyncComponentMap.get(comp)!
  }

  // Vue 2 工厂函数必须先执行一次，才能知道它到底走哪种异步组件声明格式。
  let resolve: (res: LegacyAsyncReturnValue) => void
  let reject: (reason?: any) => void
  const fallbackPromise = new Promise<Component>((r, rj) => {
    ;((resolve = r), (reject = rj))
  })

  const res = comp(resolve!, reject!)

  let converted: Component
  if (isPromise(res)) {
    // 旧工厂直接返回 Promise 时，最容易直接映射到 defineAsyncComponent。
    converted = defineAsyncComponent(() => res)
  } else if (isObject(res) && !isVNode(res) && !isArray(res)) {
    // 旧对象写法里的 loading/error/delay/timeout 在这里一一桥接。
    converted = defineAsyncComponent({
      loader: () => res.component,
      loadingComponent: res.loading,
      errorComponent: res.error,
      delay: res.delay,
      timeout: res.timeout,
    })
  } else if (res == null) {
    // 某些 Vue 2 工厂不直接返回值，而是后续调用 `resolve`，这里用 fallbackPromise 接住。
    converted = defineAsyncComponent(() => fallbackPromise)
  } else {
    // 其余情况基本已经是 Vue 3 可接受的组件形式，直接原样返回。
    converted = comp as any // probably a v3 functional comp
  }
  normalizedAsyncComponentMap.set(comp, converted)
  return converted
}
