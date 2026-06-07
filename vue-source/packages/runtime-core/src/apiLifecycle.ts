/**
 * 文件作用：定义组件生命周期注册 API。
 *
 * 这份文件负责把 `onMounted`、`onUpdated`、`onUnmounted` 等外部 API
 * 注册到当前组件实例上，让组件在后续挂载、更新、卸载阶段可以按时执行这些钩子。
 *
 * 它本身不直接触发生命周期执行，
 * 而是负责在 setup 阶段把用户传入的钩子收集到实例上，等渲染器在合适时机统一调度。
 */

import {
  type ComponentInternalInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { ErrorTypeStrings, callWithAsyncErrorHandling } from './errorHandling'
import {
  type DebuggerEvent,
  pauseTracking,
  resetTracking,
} from '@vue-source/reactivity'
import { LifecycleHooks } from './enums'

export { onActivated, onDeactivated } from './components/KeepAlive'

/**
 * 往组件实例上注册一个生命周期钩子。
 *
 * 主要功能：
 * - 把原始钩子包装成运行时统一调用形式
 * - 在执行前后维护 `currentInstance`
 * - 暂停依赖收集，避免生命周期内部访问响应式数据时污染当前 effect
 */
export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
): Function | undefined {
  /**
   * 把一个生命周期钩子注册到目标组件实例上。
   *
   * 主要功能：
   * - 为用户钩子包一层统一错误处理与 `currentInstance` 恢复逻辑
   * - 缓存包装结果，便于调度器后续去重
   * - 按需插入到当前生命周期数组头部或尾部
   *
   * 参数：
   * - `type`：生命周期枚举值
   * - `hook`：用户传入的原始钩子
   * - `target`：目标组件实例，默认取当前活跃实例
   * - `prepend`：是否插到队列前面
   */
  if (target) {
    // 生命周期注册本质上只是把钩子挂到实例上的对应数组里；
    // 真正执行时机并不在这里，而在 renderer 的 mount/update/unmount 流程中统一调度。
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking()
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        const reset = setCurrentInstance(target)
        const res = callWithAsyncErrorHandling(hook, target, type, args)
        reset()
        resetTracking()
        return res
      })
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  }
}

/**
 * 生命周期注册 API 工厂。
 *
 * 作用：
 * - 给不同生命周期阶段生成统一的注册函数
 * - 例如生成 `onMounted`、`onUpdated`、`onUnmounted`
 */
const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
  (
    hook: T,
    target: ComponentInternalInstance | null = currentInstance,
  ): void => {
    /**
     * 生成某个具体生命周期的注册函数。
     *
     * 主要功能：
     * - 根据生命周期类型统一复用 `injectHook`
     * - 在 SSR setup 阶段过滤掉不该注册的客户端生命周期
     */
    // SSR setup 阶段大部分客户端生命周期都没有意义，
    // 因为服务端不会真正经历 mounted/updated 这类 DOM 生命周期。
    if (
      !isInSSRComponentSetup ||
      lifecycle === LifecycleHooks.SERVER_PREFETCH
    ) {
      injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)
    }
  }
type CreateHook<T = any> = (
  hook: T,
  target?: ComponentInternalInstance | null,
) => void

// 以下导出都是“某个生命周期阶段的注册函数”，底层都由 `createHook()` 统一生成。
export const onBeforeMount: CreateHook = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted: CreateHook = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate: CreateHook = createHook(
  LifecycleHooks.BEFORE_UPDATE,
)
export const onUpdated: CreateHook = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount: CreateHook = createHook(
  LifecycleHooks.BEFORE_UNMOUNT,
)
export const onUnmounted: CreateHook = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch: CreateHook = createHook(
  LifecycleHooks.SERVER_PREFETCH,
)

export type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTriggered: CreateHook<DebuggerHook> =
  createHook<DebuggerHook>(LifecycleHooks.RENDER_TRIGGERED)
export const onRenderTracked: CreateHook<DebuggerHook> =
  createHook<DebuggerHook>(LifecycleHooks.RENDER_TRACKED)

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentPublicInstance | null,
  info: string,
) => boolean | void

/**
 * 注册错误捕获钩子。
 *
 * 作用：
 * - 拦截当前组件子树内部抛出的错误
 * - 让组件在本地有机会消费或上报错误
 */
export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: ComponentInternalInstance | null = currentInstance,
): void {
  /**
   * 注册错误捕获钩子。
   *
   * 这个钩子会在当前组件子树内部出现运行时错误时被调用，
   * 让组件有机会：
   * - 本地吞掉错误
   * - 做上报
   * - 渲染降级 UI
   */
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
