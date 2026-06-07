import type { RouteMap } from './route-map'

/**
 * Utility type for raw and non raw params like :id+
 *
 */
// 至少一个参数值，对应 repeatable 且非空的场景。
export type ParamValueOneOrMore<isRaw extends boolean> = [
  ParamValue<isRaw>,
  ...ParamValue<isRaw>[],
]

/**
 * Utility type for raw and non raw params like :id*
 *
 */
// 零个或多个参数值，可为空，也可缺省。
export type ParamValueZeroOrMore<isRaw extends boolean> = true extends isRaw
  ? ParamValue<isRaw>[] | undefined | null
  : ParamValue<isRaw>[] | undefined

/**
 * Utility type for raw and non raw params like :id?
 *
 */
// 可选参数，对应 path 上的 ? 修饰符。
export type ParamValueZeroOrOne<isRaw extends boolean> = true extends isRaw
  ? string | number | null | undefined
  : string

/**
 * Utility type for raw and non raw params like :id
 *
 */
// 基础单值参数。raw 允许 number，因为用户 push 时常会直接传数字。
export type ParamValue<isRaw extends boolean> = true extends isRaw
  ? string | number
  : string

// TODO: finish this refactor
// export type ParamValueOneOrMoreRaw = [ParamValueRaw, ...ParamValueRaw[]]
// export type ParamValue =  string
// export type ParamValueRaw = string | number

/**
 * Generate a type safe params for a route location. Requires the name of the route to be passed as a generic.
 * @see {@link RouteParamsGeneric}
 */
// 从 RouteMap 中按 name 取出“解析后的 params 类型”。
export type RouteParams<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMap[Name]['params']

/**
 * Generate a type safe raw params for a route location. Requires the name of the route to be passed as a generic.
 * @see {@link RouteParamsRaw}
 */
// 从 RouteMap 中按 name 取出“用户输入态的 raw params 类型”。
export type RouteParamsRaw<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMap[Name]['paramsRaw']
