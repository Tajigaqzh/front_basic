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
  /**
   * 切换当前 render 上下文。
   *
   * 主要功能：
   * - 记录“当前是谁在执行 render”
   * - 同步更新当前组件对应的 scopeId
   * - 返回旧上下文，供外层在 render 结束后恢复
   *
   * 所在链路：
   * - `renderComponentRoot()`
   * - `withCtx()` 包装后的插槽函数
   * - vnode 创建时如果需要拿当前组件实例 / scopeId，也依赖这里维护的状态
   */
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
  /**
   * 手动压入当前 scopeId。
   *
   * 主要用途：
   * - 兼容旧编译产物在创建提升静态节点时显式切换 scopeId
   */
  currentScopeId = id
}

/**
 * 作用：清空当前 scope id，供旧版编译产物兼容调用。
 */
export function popScopeId(): void {
  /**
   * 弹出当前 scopeId。
   *
   * 这里的实现很简单，直接清空即可，
   * 因为旧编译产物会自行按调用顺序成对控制 push / pop。
   */
  currentScopeId = null
}

/**
 * 作用：兼容旧编译产物的 `withScopeId` 帮助函数。
 */
export const withScopeId = (_id: string): typeof withCtx => withCtx
// 新编译产物不会再实际依赖 `withScopeId`，这里保留只是为了兼容旧 helper 名称。

export type ContextualRenderFn = {
  (...args: any[]): any
  _n: boolean /* already normalized */
  _c: boolean /* compiled */
  _d: boolean /* disableTracking */
  _ns: boolean /* nonScoped */
}
// 这些私有标记由编译产物和运行时协作使用：
// - `_n`：是否已经包过上下文
// - `_c`：是否来自编译生成插槽
// - `_d`：执行时是否默认关闭 block tracking
// - `_ns`：compat 下是否为非作用域插槽

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
  /**
   * 给插槽函数绑定所属组件的渲染上下文。
   *
   * 主要功能：
   * - 执行插槽时临时切到插槽所属组件实例
   * - 让插槽内部创建的 vnode 能拿到正确的 currentRenderingInstance / scopeId
   * - 处理 block tracking，避免把插槽执行过程错误并入外层 block 收集
   *
   * 参数：
   * - `fn`：原始插槽函数
   * - `ctx`：插槽所属组件实例
   * - `isNonScopedSlot`：兼容模式下标记是否为非作用域插槽
   */
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
      // 插槽执行完必须恢复外层 render 上下文，否则后续 vnode 创建会错误归属到插槽拥有者组件。
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
