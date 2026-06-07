import type { RouteLocationRaw, RouteRecordNameGeneric } from '../typed-routes'

export function isRouteLocation(route: any): route is RouteLocationRaw {
  // 运行时层面对 RouteLocationRaw 的判断是宽松的：
  // 只要是 string，或者是非空对象，就先交给后续 resolve 细化处理。
  return typeof route === 'string' || (route && typeof route === 'object')
}

export function isRouteName(
  name: unknown
): name is NonNullable<RouteRecordNameGeneric> {
  // 路由名允许 string 和 symbol，两者都要支持。
  return typeof name === 'string' || typeof name === 'symbol'
}
