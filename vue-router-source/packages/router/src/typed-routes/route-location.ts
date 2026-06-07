import type {
  RouteLocationOptions,
  RouteQueryAndHash,
  _RouteLocationBase,
  RouteLocationMatched,
  RouteParamsRawGeneric,
} from '../types'
import type { _LiteralUnion } from '../types/utils'
// inlining the type as it avoids code splitting issues
import type {
  RouteMap,
  RouteMapGeneric,
  RouteRecordInfoGeneric,
} from './route-map'
import type { RouteRecord, RouteRecordNormalized } from '../matcher/types'
import type { RouteRecordNameGeneric } from './route-records'

/**
 * Generic version of {@link RouteLocation}. It is used when no {@link RouteMap} is provided.
 */
// 泛型兜底版 RouteLocation：不依赖已知命名路由映射。
export interface RouteLocationGeneric
  extends _RouteLocationBase, RouteLocationOptions {
  /**
   * Array of {@link RouteRecord} containing components as they were
   * passed when adding records. It can also contain redirect records. This
   * can't be used directly. **This property is non-enumerable**.
   */
  matched: RouteRecord[]
}

/**
 * Helper to generate a type safe version of the {@link RouteLocation} type.
 */
// 已知 name 时，可把 params 精确到该路由对应的 params 类型。
export interface RouteLocationTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric },
  Name extends keyof RouteMap,
> extends RouteLocationGeneric {
  // Extract is needed because keyof can produce numbers
  name: Extract<Name, string | symbol>
  params: RouteMap[Name]['params']
}

/**
 * List of all possible {@link RouteLocation} indexed by the route name.
 * @internal
 */
// 把 RouteMap 变成“按 name 索引的 RouteLocation 字典”。
export type RouteLocationTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationTyped<RouteMap, N>
}

/**
 * Generic version of {@link RouteLocationNormalized} that is used when no {@link RouteMap} is provided.
 */
// normalized 版本是 matcher/resolve 之后的内部稳定结果。
export interface RouteLocationNormalizedGeneric extends _RouteLocationBase {
  name: RouteRecordNameGeneric
  /**
   * Array of {@link RouteRecordNormalized}
   */
  matched: RouteRecordNormalized[]
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationNormalized} type.
 */
// 类型安全版 normalized route。
export interface RouteLocationNormalizedTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
  Name extends keyof RouteMap = keyof RouteMap,
> extends RouteLocationNormalizedGeneric {
  name: Extract<Name, string | symbol>
  // we don't override path because it could contain params and in practice it's just not useful
  params: RouteMap[Name]['params']

  /**
   * Array of {@link RouteRecordNormalized}
   */
  matched: RouteRecordNormalized[] // non-enumerable
}

/**
 * List of all possible {@link RouteLocationNormalized} indexed by the route name.
 * @internal
 */
export type RouteLocationNormalizedTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationNormalizedTyped<RouteMap, N>
}

/**
 * Generic version of {@link RouteLocationNormalizedLoaded} that is used when no {@link RouteMap} is provided.
 */
// loaded 版本意味着 lazy component 已经被解析完成，可以直接交给 RouterView 渲染。
export interface RouteLocationNormalizedLoadedGeneric extends RouteLocationNormalizedGeneric {
  /**
   * Array of {@link RouteLocationMatched} containing only plain components (any
   * lazy-loaded components have been loaded and were replaced inside the
   * `components` object) so it can be directly used to display routes. It
   * cannot contain redirect records either. **This property is non-enumerable**.
   */
  matched: RouteLocationMatched[]
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationNormalizedLoaded} type.
 */
export interface RouteLocationNormalizedLoadedTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
  Name extends keyof RouteMap = keyof RouteMap,
> extends RouteLocationNormalizedLoadedGeneric {
  name: Extract<Name, string | symbol>
  // we don't override path because it could contain params and in practice it's just not useful
  params: RouteMap[Name]['params']
}

/**
 * List of all possible {@link RouteLocationNormalizedLoaded} indexed by the route name.
 * @internal
 */
export type RouteLocationNormalizedLoadedTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = { [N in keyof RouteMap]: RouteLocationNormalizedLoadedTyped<RouteMap, N> }

/**
 * Generic version of {@link RouteLocationAsRelative}. It is used when no {@link RouteMap} is provided.
 */
// 相对导航对象：不直接给 path，而是基于当前路由增量描述变更。
export interface RouteLocationAsRelativeGeneric
  extends RouteQueryAndHash, RouteLocationOptions {
  name?: RouteRecordNameGeneric
  params?: RouteParamsRawGeneric
  /**
   * A relative path to the current location. This property should be removed
   */
  path?: undefined
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationAsRelative} type.
 */
export interface RouteLocationAsRelativeTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
  Name extends keyof RouteMap = keyof RouteMap,
> extends RouteLocationAsRelativeGeneric {
  name?: Extract<Name, string | symbol>
  params?: RouteMap[Name]['paramsRaw']
}

/**
 * List of all possible {@link RouteLocationAsRelative} indexed by the route name.
 * @internal
 */
export type RouteLocationAsRelativeTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationAsRelativeTyped<RouteMap, N>
}

/**
 * Generic version of {@link RouteLocationAsPath}. It is used when no {@link RouteMap} is provided.
 */
// 按 path 指定目标地址时的对象形态。
export interface RouteLocationAsPathGeneric
  extends RouteQueryAndHash, RouteLocationOptions {
  /**
   * Percentage encoded pathname section of the URL.
   */
  path: string
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationAsPath} type.
 */
export interface RouteLocationAsPathTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
  Name extends keyof RouteMap = keyof RouteMap,
> extends RouteLocationAsPathGeneric {
  path: _LiteralUnion<RouteMap[Name]['path']>

  // // allows to check for .path and other properties that exist in different route location types
  // [key: string]: unknown
}

/**
 * List of all possible {@link RouteLocationAsPath} indexed by the route name.
 * @internal
 */
export type RouteLocationAsPathTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationAsPathTyped<RouteMap, N>
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationAsString} type.
 */
// 字符串路径形态，对 typed route 来说会尽量收窄到已知 path 字面量。
export type RouteLocationAsStringTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMap[Name]['path']

/**
 * List of all possible {@link RouteLocationAsString} indexed by the route name.
 * @internal
 */
export type RouteLocationAsStringTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationAsStringTyped<RouteMap, N>
}

/**
 * Generic version of {@link RouteLocationResolved}. It is used when no {@link RouteMap} is provided.
 */
// resolved 版本是在 RouteLocation 基础上多了 href，可直接用于 a 标签。
export interface RouteLocationResolvedGeneric extends RouteLocationGeneric {
  /**
   * Resolved `href` for the route location that will be set on the `<a href="...">`.
   */
  href: string
}

/**
 * Helper to generate a type safe version of the {@link RouteLocationResolved} type.
 */
export interface RouteLocationResolvedTyped<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric },
  Name extends keyof RouteMap,
> extends RouteLocationTyped<RouteMap, Name> {
  /**
   * Resolved `href` for the route location that will be set on the `<a href="...">`.
   */
  href: string
}

/**
 * List of all possible {@link RouteLocationResolved} indexed by the route name.
 * @internal
 */
export type RouteLocationResolvedTypedList<
  RouteMap extends { [K in keyof RouteMap]: RouteRecordInfoGeneric } =
    RouteMapGeneric,
> = {
  [N in keyof RouteMap]: RouteLocationResolvedTyped<RouteMap, N>
}

/**
 * Type safe versions of types that are exposed by vue-router. We have to use a generic check to allow for names to be `undefined` when no `RouteMap` is provided.
 */
// 下面这一组导出是“有 RouteMap 时走精确类型，无 RouteMap 时退化为 generic”的总开关。

/**
 * {@link RouteLocationRaw} resolved using the matcher
 */
export type RouteLocation<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMapGeneric extends RouteMap
    // 没有生成具体 RouteMap 时，暴露兼容旧版 API 的宽泛类型。
    ? RouteLocationGeneric
    // 有 RouteMap 时，按路由名提取精确的解析结果。
    : RouteLocationTypedList<RouteMap>[Name]

/**
 * Similar to {@link RouteLocation} but its
 * {@link RouteLocationNormalizedTyped.matched | `matched` property} cannot contain redirect records
 */
export type RouteLocationNormalized<
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMapGeneric extends RouteMap
  ? RouteLocationNormalizedGeneric
  : RouteLocationNormalizedTypedList<RouteMap>[Name]

/**
 * Similar to {@link RouteLocationNormalized} but its `components` do not contain any function to lazy load components.
 * In other words, it's ready to be rendered by `<RouterView>`.
 */
export type RouteLocationNormalizedLoaded<
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMapGeneric extends RouteMap
  ? RouteLocationNormalizedLoadedGeneric
  : RouteLocationNormalizedLoadedTypedList<RouteMap>[Name]

/**
 * Route location relative to the current location. It accepts other properties than `path` like `params`, `query` and
 * `hash` to conveniently change them.
 */
export type RouteLocationAsRelative<
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMapGeneric extends RouteMap
  ? RouteLocationAsRelativeGeneric
  : RouteLocationAsRelativeTypedList<RouteMap>[Name]

/**
 * Route location resolved with {@link Router | `router.resolve()`}.
 */
export type RouteLocationResolved<
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMapGeneric extends RouteMap
  ? RouteLocationResolvedGeneric
  : RouteLocationResolvedTypedList<RouteMap>[Name]

/**
 * Same as {@link RouteLocationAsPath} but as a string literal.
 */
export type RouteLocationAsString<
  Name extends keyof RouteMap = keyof RouteMap,
> = RouteMapGeneric extends RouteMap
  ? string
  // 字面量联合外包一层 _LiteralUnion，这样既保留提示也允许任意字符串兜底。
  : _LiteralUnion<RouteLocationAsStringTypedList<RouteMap>[Name], string>

/**
 * Route location as an object with a `path` property.
 */
export type RouteLocationAsPath<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMapGeneric extends RouteMap
    ? RouteLocationAsPathGeneric
    : RouteLocationAsPathTypedList<RouteMap>[Name]

/**
 * Route location that can be passed to `router.push()` and other user-facing APIs.
 */
export type RouteLocationRaw<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMapGeneric extends RouteMap
    ?
        // 无类型路由时，push/replace 接口接受字符串、相对对象、显式 path 对象三种形态。
        | RouteLocationAsString
        | RouteLocationAsRelativeGeneric
        | RouteLocationAsPathGeneric
    :
        // 有类型路由时，三种形态都会被按路由名收窄到对应 params/query 结构。
        | _LiteralUnion<RouteLocationAsStringTypedList<RouteMap>[Name], string>
        | RouteLocationAsRelativeTypedList<RouteMap>[Name]
        | RouteLocationAsPathTypedList<RouteMap>[Name]
