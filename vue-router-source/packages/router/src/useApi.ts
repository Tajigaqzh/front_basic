import { inject } from 'vue'
import { routerKey, routeLocationKey } from './injectionSymbols'
import type { Router } from './router'
import type { RouteMap } from './typed-routes/route-map'
import type { RouteLocationNormalizedLoaded } from './typed-routes'

/**
 * Returns the router instance. Equivalent to using `$router` inside
 * templates.
 */
export function useRouter(): Router {
  // 这里没有额外逻辑，本质就是从 app.provide() 出来的 routerKey 中取实例。
  return inject(routerKey)!
}

/**
 * Returns the current route location. Equivalent to using `$route` inside
 * templates.
 */
export function useRoute<Name extends keyof RouteMap = keyof RouteMap>(
  _name?: Name
) {
  // useRoute 取到的是 router 安装时提供的响应式 currentRoute。
  // 因此路由一旦 finalizeNavigation，组件内依赖会自动刷新。
  return inject(routeLocationKey) as RouteLocationNormalizedLoaded<
    Name | RouteMap[Name]['childrenNames']
  >
}
