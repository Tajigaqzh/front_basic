/**
 * Error throw when a matcher matches by regex but validation fails.
 *
 * @internal
 */
export class MatchMiss extends Error {
  // 统一错误名，外层解析器据此区分“正常 miss”与真正异常。
  name = 'MatchMiss'
}

/**
 * Helper to throw a {@link MatchMiss} error.
 * @param args - Arguments to pass to the `MatchMiss` constructor.
 *
 * @example
 * ```ts
 * miss()
 * // in a number param matcher
 * miss('Number must be finite')
 * ```
 */
export const miss: (
  ...args: ConstructorParameters<typeof MatchMiss>
) => never = (...args) => {
  // 用函数包装而不是 `throw new` 直接写，方便在表达式位置内联使用。
  throw new MatchMiss(...args)
}
