import type {
  RouteLocation,
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './route-location'
import type { RouteMap, RouteMapGeneric } from './route-map'

/**
 * @internal
 */
// redirect 既可以是一个静态目标，也可以是一个根据 to/from 动态计算的函数。
export type RouteRecordRedirectOption =
  | RouteLocationRaw
  | ((
      to: RouteLocation,
      from: RouteLocationNormalizedLoaded
    ) => RouteLocationRaw)

/**
 * Generic version of {@link RouteRecordName}.
 */
// 内部通用版路由名，允许 undefined 是因为某些 record 本身就没有 name。
export type RouteRecordNameGeneric = string | symbol | undefined

/**
 * Possible values for a route record **after normalization**
 *
 * NOTE: since `RouteRecordName` is a type, it evaluates too early and it's often the generic version {@link RouteRecordNameGeneric}. If you need a typed version of all of the names of routes, use {@link RouteMap | `keyof RouteMap`}
 */
export type RouteRecordName = RouteMapGeneric extends RouteMap
  ? RouteRecordNameGeneric
  : keyof RouteMap

/**
 * @internal
 */
// props 既可以是布尔值，也可以是对象，也可以是基于 to 动态计算 props 的函数。
export type _RouteRecordProps<Name extends keyof RouteMap = keyof RouteMap> =
  | boolean
  | Record<string, any>
  | ((to: RouteLocationNormalized<Name>) => Record<string, any>)
