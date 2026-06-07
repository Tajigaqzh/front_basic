import type { TypesConfig } from '../../config'

/**
 * The default error type used for data loaders. Can be customized via {@link TypesConfig}.
 *
 * @example
 * ```ts
 * // types-extension.d.ts
 * import 'vue-router/experimental'
 * export {}
 * declare module 'vue-router/experimental' {
 *   interface TypesConfig {
 *     Error: MyCustomError
 *   }
 * }
 * ```
 *
 * @internal
 */
export type ErrorDefault =
  TypesConfig extends Record<'Error', infer E> ? E : Error
// 允许业务通过 TypesConfig 覆盖 loader 默认错误类型。
