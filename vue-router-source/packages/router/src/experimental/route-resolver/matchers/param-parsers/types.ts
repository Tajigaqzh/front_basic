import type {
  MatcherQueryParamsValue,
  // @ts-ignore: actually used in jsdoc, sometimes works in TS, sometimes doesn't...
  MatcherPattern,
} from '../matcher-pattern'

/**
 * Defines a parser that can read a param from the url (string-based) and
 * transform it into a more complex type, or vice versa.
 *
 * @param TParam - the type of the param after parsing as exposed in
 * `route.params`
 *
 * @param TUrlParam - this is the most permissive type that can be passed to
 * get and returned by set. By default it's the type of query path params
 * (stricter as they do not allow `null` within an array or `undefined`). By
 * default it allows undefined because that represents a value that can be
 * omitted and is different from null in query params
 *
 * @param TParamRaw - the type that can be passed as a location when
 * navigating: `router.push({ params: {}})` it's sometimes more permissive than
 * TParam, for example allowing nullish values
 *
 * @see {MatcherPattern}
 */
export interface ParamParser<
  // the final type in route.params
  TParam = MatcherQueryParamsValue,
  // what gets passed to `get`
  TUrlParam = MatcherQueryParamsValue,
  // a potentially more permissive type
  TParamRaw = TParam,
> {
  // get 负责把 URL 里的原始值转成业务类型。
  get?: (value: NoInfer<TUrlParam>) => TParam
  // set 则把业务类型重新序列化成 URL 能承载的值。
  set?: (value: TParamRaw) => TUrlParam
}

/**
 * Generic type for a param parser that can handle both single and repeatable params.
 *
 * @see ParamParser
 */
export type ParamParser_Generic =
  // 这里只描述最常见的单值/多值 path 解析器轮廓，故意不覆盖所有 query 细节。
  | ParamParser<any, string>
  | ParamParser<any, string[]>
