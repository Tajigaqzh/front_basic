import { decode, PLUS_RE } from '../encoding'
import { isArray } from '../utils'

/**
 * NOTE: some types here are duplicated from ../query.ts
 * because they will change to always have (string | null)[] values
 */
// experimental query 是对正式 query 层的试验版分支：
// 一方面保留现有行为，另一方面尝试更安全/更一致的内部数据结构。

/**
 * Possible values in normalized {@link LocationQuery}. `null` renders the query
 * param but without an `=`.
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
 * version with the leading `?` and without. Uses `Object.create(null)` so the
 * returned object cannot be exploited via prototype pollution.
 *
 * @internal
 *
 * @param search - search string to parse
 * @returns a query object
 */
export function experimental_parseQuery(search: string): LocationQuery {
  // 和正式 parseQuery 一样支持 ?a=1&a=2 这种数组语义，
  // 但返回对象使用 null-prototype，避免用户输入污染原型。
  const query: LocationQuery = Object.create(null)
  if (search === '' || search === '?') return query
  const searchParams = (search[0] === '?' ? search.slice(1) : search).split('&')
  for (let i = 0; i < searchParams.length; ++i) {
    const searchParam = searchParams[i].replace(PLUS_RE, ' ')
    const eqPos = searchParam.indexOf('=')
    const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos))
    const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1))

    if (key in query) {
      let currentValue = query[key]
      if (!isArray(currentValue)) {
        currentValue = query[key] = [currentValue]
      }
      ;(currentValue as LocationQueryValue[]).push(value)
    } else {
      query[key] = value
    }
  }
  return query
}

/**
 * Transforms a {@link LocationQueryRaw} into a {@link LocationQuery} by casting
 * numbers into strings, removing keys with an undefined value and replacing
 * undefined with null in arrays. Uses `Object.create(null)` so the returned
 * object cannot be exploited via prototype pollution.
 *
 * @param query - query object to normalize
 * @returns a normalized query object
 */
export function experimental_normalizeQuery(
  query: LocationQueryRaw | undefined
): LocationQuery {
  // 归一化规则与正式版一致：number -> string，undefined -> 删除。
  const normalizedQuery: LocationQuery = Object.create(null)

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
