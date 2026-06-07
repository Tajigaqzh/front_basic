import type {
  RouteParamsGeneric,
  RouteComponent,
  RouteParamsRawGeneric,
  RawRouteComponent,
} from '../types'

/**
 * Identity function that returns the value as is.
 *
 * @param v - the value to return
 *
 * @internal
 */
export const identityFn = <T>(v: T) => v

export * from './env'

/**
 * Allows differentiating lazy components from functional components and vue-class-component
 * @internal
 *
 * @param component
 */
export function isRouteComponent(
  component: RawRouteComponent
): component is RouteComponent {
  // 路由组件既可能是对象组件，也可能是被编译器/类组件包装后的对象，
  // 这里通过一组宽松特征位来判断“它能不能当成组件用”。
  return (
    typeof component === 'object' ||
    'displayName' in component ||
    'props' in component ||
    '__vccOpts' in component
  )
}

export function isESModule(obj: any): obj is { default: RouteComponent } {
  // 动态 import 的结果在不同构建环境下形态不完全一样，
  // 所以这里同时兼容 __esModule、toStringTag、default 组件这几种信号。
  return (
    obj.__esModule ||
    obj[Symbol.toStringTag] === 'Module' ||
    // support CF with dynamic imports that do not
    // add the Module string tag
    (obj.default && isRouteComponent(obj.default))
  )
}

export const assign = Object.assign

export function applyToParams(
  fn: (v: string | number | null | undefined) => string,
  params: RouteParamsRawGeneric | undefined
): RouteParamsGeneric {
  // 对 params 做“按值映射但保持对象结构不变”，
  // router.ts 里会用它来统一做 encode / decode / string 化。
  const newParams: RouteParamsGeneric = {}

  for (const key in params) {
    const value = params[key]
    newParams[key] = isArray(value) ? value.map(fn) : fn(value)
  }

  return newParams
}

export const noop = () => {}

/**
 * Typesafe alternative to Array.isArray
 * https://github.com/microsoft/TypeScript/pull/48228
 *
 * @internal
 */
export const isArray: (
  arg: ArrayLike<any> | unknown
) => arg is ReadonlyArray<any> = Array.isArray

export function mergeOptions<T extends object>(
  defaults: T,
  partialOptions: Partial<T>
): T {
  // mergeOptions 不做深合并，只做浅层“有值则覆盖”，
  // 因为这里处理的多是 parser/router 配置对象。
  const options = {} as T
  for (const key in defaults) {
    options[key] = key in partialOptions ? partialOptions[key]! : defaults[key]
  }

  return options
}
