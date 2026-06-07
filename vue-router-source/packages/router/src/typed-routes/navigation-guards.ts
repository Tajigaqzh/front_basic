import type { _Awaitable } from '../types/utils'
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationNormalized,
  RouteLocationRaw,
} from './route-location'
import type { NavigationFailure } from '../errors'
import type { ComponentPublicInstance } from 'vue'

/**
 * Return types for a Navigation Guard. Based on `TypesConfig`
 *
 * @see {@link TypesConfig}
 */
// 守卫允许的返回结果会被 router.ts 统一翻译成继续、终止、重定向或报错。
export type NavigationGuardReturn = void | Error | boolean | RouteLocationRaw

/**
 * Navigation Guard with a type parameter for `this`.
 * @see {@link TypesConfig}
 */
// 主要给组件选项式守卫使用，它们的 this 指向组件实例或 undefined。
export interface NavigationGuardWithThis<T> {
  (
    this: T,
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * In `router.beforeResolve((to) => {})`, the `to` is typed as `RouteLocationNormalizedLoaded`, not
 * `RouteLocationNormalized` like in `router.beforeEach()`. In practice it doesn't change much as users do not rely on
 * the difference between them but if we update the type in vue-router, we will have to update this type too.
 * @internal
 */
// beforeResolve 发生在组件懒加载等流程之后，所以 `to` 已经是 loaded 版本。
export interface _NavigationGuardResolved {
  (
    this: undefined,
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * Navigation Guard.
 */
// 通用守卫类型，覆盖 beforeEach / beforeEnter / beforeRouteUpdate 等大多数场景。
export interface NavigationGuard {
  (
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * Navigation hook triggered after a navigation is settled.
 */
// afterEach 只观察结果，不参与导航控制，因此没有 next，也不返回控制值。
export interface NavigationHookAfter {
  (
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    failure?: NavigationFailure | void
  ): unknown
}

/**
 * Callback passed to navigation guards to continue or abort the navigation.
 *
 * @deprecated Prefer returning a value from the guard instead of calling
 * `next(value)`. The callback will be removed in a future version of Vue Router.
 */
// 这是旧式 next API 的重载定义，源码内部仍兼容它，但推荐直接 return 值。
export interface NavigationGuardNext {
  (): void
  (error: Error): void
  (location: RouteLocationRaw): void
  (valid: boolean | undefined): void
  (cb: NavigationGuardNextCallback): void
  /**
   * Allows to detect if `next` isn't called in a resolved guard. Used
   * internally in DEV mode to emit a warning. Commented out to simplify
   * typings.
   * @internal
   */
  // _called: boolean
}

/**
 * Callback that can be passed to `next()` in `beforeRouteEnter()` guards.
 */
// beforeRouteEnter 的回调会在组件实例真正挂载后再收到 vm。
export type NavigationGuardNextCallback = (
  vm: ComponentPublicInstance
) => unknown
