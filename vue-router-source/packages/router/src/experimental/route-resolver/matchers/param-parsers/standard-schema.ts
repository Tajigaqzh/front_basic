import type { StandardSchemaV1 } from './standard-schema-types'
import { miss } from '../errors'
import type { ParamParser } from './types'
import type { MatcherQueryParamsValue } from '../matcher-pattern'

/**
 * Normalizes a param parser input, converting a StandardSchema-compliant object
 * into a {@link ParamParser} if needed.
 *
 * @param parser - a param parser or a StandardSchema-compliant validator
 *
 * @internal
 */
export function normalizeParamParser<
  TParam = MatcherQueryParamsValue,
  TUrlParam = MatcherQueryParamsValue,
  TParamRaw = TParam,
>(
  parser:
    | ParamParser<TParam, TUrlParam, TParamRaw>
    | StandardSchemaV1<unknown, TParam>
): ParamParser<TParam, TUrlParam, TParamRaw> {
  return '~standard' in parser
    ? {
        get(value: TUrlParam): TParam {
          // 标准 schema 只提供 validate，因此这里适配成 vue-router 需要的 get() 形式。
          const result = parser['~standard'].validate(
            value
          ) as StandardSchemaV1.Result<TParam>
          if (__DEV__ && result instanceof Promise) {
            throw new TypeError(
              'async validation is not supported for param parsers'
            )
          }
          if (result.issues) {
            // schema 校验失败统一转成 MatchMiss，让 resolver 可以把它当作普通未命中处理。
            miss(result.issues.map(issue => issue.message).join(', '))
          }
          return result.value
        },
      }
    : parser
}

/**
 * Extracts the param type from Param Parsers or StandardSchema validators.
 *
 * @internal
 */
export type ExtractParamParserType<PP> =
  PP extends ParamParser<infer T, any, any>
    ? T
    : PP extends StandardSchemaV1<unknown, infer T>
      ? T
      : unknown
