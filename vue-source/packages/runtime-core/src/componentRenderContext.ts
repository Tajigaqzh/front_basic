/**
 * 文件作用：维护当前渲染时的上下文信息。
 *
 * 这份文件会保存当前正在渲染的组件实例、当前作用域 id 等数据，
 * 供 vnode 创建和 SFC 样式作用域等逻辑使用。
 */

import type { ComponentInternalInstance } from './component'
import { devtoolsComponentUpdated } from './devtools'
import { setBlockTracking } from './vnode'

// 当前正在执行 render 的组件实例，解析组件、指令、插槽上下文时都会依赖它。
export let currentRenderingInstance: ComponentInternalInstance | null = null
// 当前作用域 id 主要给 SFC scoped style 和 hoisted vnode 创建链路使用。
export let currentScopeId: string | null = null

/**
 * 作用：切换当前正在渲染的组件实例，并返回切换前的实例。
 *
 * 参数说明：
 * - `instance`：即将进入 render 的组件实例，传 `null` 表示清空。
 *
 * 返回值：
 * - 返回切换前的渲染实例，供外层 render 结束后恢复。
 */
export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  // 兼容旧编译产物时，scopeId 字段名可能仍然是 `_scopeId`。
  if (__COMPAT__ && !currentScopeId) {
    currentScopeId = (instance && (instance.type as any)._scopeId) || null
  }
  return prev
}

/**
 * 作用：在创建提升静态 vnode 时临时压入当前 scope id。
 */
export function pushScopeId(id: string | null): void {
  currentScopeId = id
}

/**
 * 作用：清空当前 scope id，供旧版编译产物兼容调用。
 */
export function popScopeId(): void {
  currentScopeId = null
}

/**
 * 作用：兼容旧编译产物的 `withScopeId` 帮助函数。
 */
export const withScopeId = (_id: string): typeof withCtx => withCtx

export type ContextualRenderFn = {
  (...args: any[]): any
  _n: boolean /* already normalized */
  _c: boolean /* compiled */
  _d: boolean /* disableTracking */
  _ns: boolean /* nonScoped */
}

/**
 * 作用：给编译生成的插槽函数绑定渲染上下文。
 *
 * 参数说明：
 * - `fn`：原始插槽函数。
 * - `ctx`：插槽所属的组件实例，默认取当前渲染实例。
 * - `isNonScopedSlot`：兼容模式下区分是否为非作用域插槽。
 */
export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance,
  isNonScopedSlot?: boolean, // __COMPAT__ only
): Function {
  if (!ctx) return fn

  // 已经包装过的函数直接复用，避免重复套壳。
  if ((fn as ContextualRenderFn)._n) {
    return fn
  }

  const renderFnWithContext: ContextualRenderFn = (...args: any[]) => {
    // 编译插槽被当普通函数调用时可能破坏 block 跟踪，这里默认先关闭再恢复。
    if (renderFnWithContext._d) {
      setBlockTracking(-1)
    }
    const prevInstance = setCurrentRenderingInstance(ctx)
    let res
    try {
      res = fn(...args)
    } finally {
      setCurrentRenderingInstance(prevInstance)
      if (renderFnWithContext._d) {
        setBlockTracking(1)
      }
    }

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      devtoolsComponentUpdated(ctx)
    }

    return res
  }

  // `_n` 表示这个插槽函数已经完成上下文化包装。
  renderFnWithContext._n = true
  // `_c` 表示它来自编译产物，normalizeChildren 会据此打上编译插槽标记。
  renderFnWithContext._c = true
  // `_d` 默认开启，表示执行该函数时默认禁用 block tracking。
  renderFnWithContext._d = true
  // `_ns` 只在兼容模式下使用，用来区分非作用域插槽。
  if (__COMPAT__ && isNonScopedSlot) {
    renderFnWithContext._ns = true
  }
  return renderFnWithContext
}
