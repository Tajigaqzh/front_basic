import { decode, encodeQueryKey, encodeQueryValue, PLUS_RE } from './encoding'
import { isArray } from './utils'

/**
 * Possible values in normalized {@link LocationQuery}. `null` renders the query
 * param but without an `=`.
 *
 * @example
 * ```
 * ?isNull&isEmpty=&other=other
 * gives
 * `{ isNull: null, isEmpty: '', other: 'other' }`.
 * ```
 *
 * @internal
 */
export type LocationQueryValue = string | null

/**
 * Possible values when defining a query. `undefined` allows to remove a value.
 *
 * @internal
 */
export type LocationQueryValueRaw = LocationQueryValue | number | undefined

/**
 * Normalized query object that appears in {@link RouteLocationNormalized}
 *
 * @public
 */
export type LocationQuery = Record<
  string,
  LocationQueryValue | LocationQueryValue[]
>
/**
 * Loose {@link LocationQuery} object that can be passed to functions like
 * {@link Router.push} and {@link Router.replace} or anywhere when creating a
 * {@link RouteLocationRaw}
 *
 * @public
 */
export type LocationQueryRaw = Record<
  string | number,
  LocationQueryValueRaw | LocationQueryValueRaw[]
>

/**
 * Transforms a queryString into a {@link LocationQuery} object. Accept both, a
 * version with the leading `?` and without Should work as URLSearchParams

 * @internal
 *
 * @param search - search string to parse
 * @returns a query object
 */
export function parseQuery(search: string): LocationQuery {
  // query 层只关心 ? 后面的键值结构，不关心 path/hash。
  // 同名 key 会被收集成数组，以兼容 ?a=1&a=2 这种形式。
  // TODO: in next major, use Object.create(null) and remove src/experimental/location.ts
  const query: LocationQuery = {}
  // avoid creating an object with an empty key and empty value
  // because of split('&')
  if (search === '' || search === '?') return query
  const searchParams = (search[0] === '?' ? search.slice(1) : search).split('&')
  for (let i = 0; i < searchParams.length; ++i) {
    // pre decode the + into space
    const searchParam = searchParams[i].replace(PLUS_RE, ' ')
    // allow the = character
    const eqPos = searchParam.indexOf('=')
    const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos))
    const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1))

    if (key in query) {
      // an extra variable for ts types
      let currentValue = query[key]
      if (!isArray(currentValue)) {
        currentValue = query[key] = [currentValue]
      }
      // we force the modification
      ;(currentValue as LocationQueryValue[]).push(value)
    } else {
      query[key] = value
    }
  }
  return query
}

/**
 * Stringifies a {@link LocationQueryRaw} object. Like `URLSearchParams`, it
 * doesn't prepend a `?`
 *
 * @internal
 *
 * @param query - query object to stringify
 * @returns string version of the query without the leading `?`
 */
export function stringifyQuery(query: LocationQueryRaw | undefined): string {
  // stringify 时不会自动补 ?，因为这一步只负责把对象转成 query 片段。
  // ? 的拼接由 stringifyURL/location 层统一处理。
  let search = ''
  for (let key in query) {
    const value = query[key]
    key = encodeQueryKey(key)
    if (value == null) {
      // only null adds the value
      if (value !== undefined) {
        search += (search.length ? '&' : '') + key
      }
      continue
    }
    // keep null values
    const values: LocationQueryValueRaw[] = isArray(value)
      ? value.map(v => v && encodeQueryValue(v))
      : [value && encodeQueryValue(value)]

    values.forEach(value => {
      // skip undefined values in arrays as if they were not present
      // smaller code than using filter
      if (value !== undefined) {
        // only append & with non-empty search
        search += (search.length ? '&' : '') + key
        if (value != null) search += '=' + value
      }
    })
  }

  return search
}

/**
 * Transforms a {@link LocationQueryRaw} into a {@link LocationQuery} by casting
 * numbers into strings, removing keys with an undefined value and replacing
 * undefined with null in arrays
 *
 * @param query - query object to normalize
 * @returns a normalized query object
 */
export function normalizeQuery(
  query: LocationQueryRaw | undefined
): LocationQuery {
  // normalizeQuery 的目标是把“用户输入”收敛成 router 内部稳定形态：
  // number -> string，undefined -> 删除，数组里的 undefined -> null。
  // TODO: in next major, use Object.create(null) and remove src/experimental/location.ts
  const normalizedQuery: LocationQuery = {}

  for (const key in query) {
    const value = query[key]
    if (value !== undefined) {
      normalizedQuery[key] = isArray(value)
        ? value.map(v => (v == null ? null : '' + v))
        : value == null
          ? value
          : '' + value
    }
  }

  return normalizedQuery
}
