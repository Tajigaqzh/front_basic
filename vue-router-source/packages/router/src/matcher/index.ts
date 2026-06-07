import type {
  RouteRecordRaw,
  MatcherLocationRaw,
  MatcherLocation,
} from '../types'
import { isRouteName } from '../types'
import type { MatcherError } from '../errors'
import { createRouterError, ErrorTypes } from '../errors'
import type { RouteRecordMatcher } from './pathMatcher'
import { createRouteRecordMatcher } from './pathMatcher'
import type { RouteRecordNormalized } from './types'

import type {
  PathParams,
  PathParserOptions,
  _PathParserOptions,
} from './pathParserRanker'

import {
  comparePathParserScore,
  PATH_PARSER_OPTIONS_DEFAULTS,
} from './pathParserRanker'

import { warn } from '../warning'
import { assign, mergeOptions, noop } from '../utils'
import type { RouteRecordNameGeneric, _RouteRecordProps } from '../typed-routes'

/**
 * Internal RouterMatcher
 *
 * @internal
 */
export interface RouterMatcher {
  addRoute: (record: RouteRecordRaw, parent?: RouteRecordMatcher) => () => void
  removeRoute(matcher: RouteRecordMatcher): void
  removeRoute(name: NonNullable<RouteRecordNameGeneric>): void
  clearRoutes: () => void
  getRoutes: () => RouteRecordMatcher[]
  getRecordMatcher: (
    name: NonNullable<RouteRecordNameGeneric>
  ) => RouteRecordMatcher | undefined

  /**
   * Resolves a location. Gives access to the route record that corresponds to the actual path as well as filling the corresponding params objects
   *
   * @param location - MatcherLocationRaw to resolve to a url
   * @param currentLocation - MatcherLocation of the current location
   */
  resolve: (
    location: MatcherLocationRaw,
    currentLocation: MatcherLocation
  ) => MatcherLocation
}

/**
 * Creates a Router Matcher.
 *
 * @internal
 * @param routes - array of initial routes
 * @param globalOptions - global route options
 */
export function createRouterMatcher(
  routes: Readonly<RouteRecordRaw[]>,
  globalOptions: PathParserOptions
): RouterMatcher {
  // matchers 是已经按优先级排好序的线性表，resolve(path) 时会按这个顺序命中。
  // 它适合“按 path 扫描”的场景。
  const matchers: RouteRecordMatcher[] = []
  const matcherMap = new Map<
    NonNullable<RouteRecordNameGeneric>,
    RouteRecordMatcher
  >()
  // matcherMap 适合“按 name 直达”的场景，两者共同构成 matcher 的读模型。
  globalOptions = mergeOptions<PathParserOptions>(
    PATH_PARSER_OPTIONS_DEFAULTS,
    globalOptions
  )

  function getRecordMatcher(name: NonNullable<RouteRecordNameGeneric>) {
    return matcherMap.get(name)
  }

  function addRoute(
    record: RouteRecordRaw,
    parent?: RouteRecordMatcher,
    originalRecord?: RouteRecordMatcher
  ) {
    // addRoute 是 matcher 的“编译入口”：
    // RouteRecordRaw -> normalize -> alias 展开 -> RouteRecordMatcher -> 插入有序表
    // originalRecord 用于标记“当前是不是 alias 的派生记录”，
    // 这样 removeRoute 时可以把 alias 和 children 一并清掉。
    // used later on to remove by name
    const isRootAdd = !originalRecord
    const mainNormalizedRecord = normalizeRouteRecord(record)
    if (__DEV__) {
      checkChildMissingNameWithEmptyPath(mainNormalizedRecord, parent)
    }
    // we might be the child of an alias
    mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record
    const options: PathParserOptions = mergeOptions(globalOptions, record)
    // generate an array of records to correctly handle aliases
    const normalizedRecords: RouteRecordNormalized[] = [mainNormalizedRecord]
    if ('alias' in record) {
      // alias 会被展开为“多个并列 matcher”，而不是运行时再做字符串替换。
      const aliases =
        typeof record.alias === 'string' ? [record.alias] : record.alias!
      for (const alias of aliases) {
        normalizedRecords.push(
          // we need to normalize again to ensure the `mods` property
          // being non enumerable
          normalizeRouteRecord(
            assign({}, mainNormalizedRecord, {
              // this allows us to hold a copy of the `components` option
              // so that async components cache is hold on the original record
              components: originalRecord
                ? originalRecord.record.components
                : mainNormalizedRecord.components,
              path: alias,
              // we might be the child of an alias
              aliasOf: originalRecord
                ? originalRecord.record
                : mainNormalizedRecord,
              // the aliases are always of the same kind as the original since they
              // are defined on the same record
            })
          )
        )
      }
    }

    let matcher: RouteRecordMatcher
    let originalMatcher: RouteRecordMatcher | undefined

    for (const normalizedRecord of normalizedRecords) {
      const { path } = normalizedRecord
      // Build up the path for nested routes if the child isn't an absolute
      // route. Only add the / delimiter if the child path isn't empty and if the
      // parent path doesn't have a trailing slash
      if (parent && path[0] !== '/') {
        const parentPath = parent.record.path
        const connectingSlash =
          parentPath[parentPath.length - 1] === '/' ? '' : '/'
        normalizedRecord.path =
          parent.record.path + (path && connectingSlash + path)
      }

      if (__DEV__ && normalizedRecord.path === '*') {
        throw new Error(
          'Catch all routes ("*") must now be defined using a param with a custom regexp.\n' +
            'See more at https://router.vuejs.org/guide/migration/#Removed-star-or-catch-all-routes.'
        )
      }

      // create the object beforehand, so it can be passed to children
      matcher = createRouteRecordMatcher(normalizedRecord, parent, options)

      if (__DEV__ && parent && path[0] === '/')
        checkMissingParamsInAbsolutePath(matcher, parent)

      // if we are an alias we must tell the original record that we exist,
      // so we can be removed
      if (originalRecord) {
        // 当前 matcher 是 alias 派生节点时，需要挂回原记录，方便统一删除。
        originalRecord.alias.push(matcher)
        if (__DEV__) {
          checkSameParams(originalRecord, matcher)
        }
      } else {
        // otherwise, the first record is the original and others are aliases
        originalMatcher = originalMatcher || matcher
        if (originalMatcher !== matcher) originalMatcher.alias.push(matcher)

        // remove the route if named and only for the top record (avoid in nested calls)
        // this works because the original record is the first one
        if (isRootAdd && record.name && !isAliasRecord(matcher)) {
          if (__DEV__) {
            checkSameNameAsAncestor(record, parent)
          }
          removeRoute(record.name)
        }
      }

      // Avoid adding a record that doesn't display anything. This allows passing through records without a component to
      // not be reached and pass through the catch all route
      if (isMatchable(matcher)) {
        // 插入时会按 path score 做二分定位，保证后续 resolve 命中顺序稳定。
        insertMatcher(matcher)
      }

      if (mainNormalizedRecord.children) {
        // children 会基于“当前 alias/原始节点”分别递归展开，
        // 所以 alias 的 children 也会形成一整套平行匹配链。
        const children = mainNormalizedRecord.children
        for (let i = 0; i < children.length; i++) {
          addRoute(
            children[i],
            matcher,
            originalRecord && originalRecord.children[i]
          )
        }
      }

      // if there was no original record, then the first one was not an alias and all
      // other aliases (if any) need to reference this record when adding children
      originalRecord = originalRecord || matcher

      // TODO: add normalized records for more flexibility
      // if (parent && isAliasRecord(originalRecord)) {
      //   parent.children.push(originalRecord)
      // }
    }

    return originalMatcher
      ? () => {
          // since other matchers are aliases, they should be removed by the original matcher
          removeRoute(originalMatcher!)
        }
      : noop
  }

  function removeRoute(
    matcherRef: NonNullable<RouteRecordNameGeneric> | RouteRecordMatcher
  ) {
    // 删除不是只删当前一项，而是要把它的 children 和 alias 一起级联清理。
    if (isRouteName(matcherRef)) {
      const matcher = matcherMap.get(matcherRef)
      if (matcher) {
        matcherMap.delete(matcherRef)
        matchers.splice(matchers.indexOf(matcher), 1)
        matcher.children.forEach(removeRoute)
        matcher.alias.forEach(removeRoute)
      }
    } else {
      const index = matchers.indexOf(matcherRef)
      if (index > -1) {
        matchers.splice(index, 1)
        if (matcherRef.record.name) matcherMap.delete(matcherRef.record.name)
        matcherRef.children.forEach(removeRoute)
        matcherRef.alias.forEach(removeRoute)
      }
    }
  }

  function getRoutes() {
    return matchers
  }

  function insertMatcher(matcher: RouteRecordMatcher) {
    const index = findInsertionIndex(matcher, matchers)
    matchers.splice(index, 0, matcher)
    // only add the original record to the name map
    if (matcher.record.name && !isAliasRecord(matcher))
      matcherMap.set(matcher.record.name, matcher)
  }

  function resolve(
    location: Readonly<MatcherLocationRaw>,
    currentLocation: Readonly<MatcherLocation>
  ): MatcherLocation {
    // resolve 有三条主分支：
    // 1. 按 name 解析，并重新整理 params
    // 2. 按 path 直接正则匹配
    // 3. 相对导航，基于 currentLocation 做补全
    let matcher: RouteRecordMatcher | undefined
    let params: PathParams = {}
    let path: MatcherLocation['path']
    let name: MatcherLocation['name']

    if ('name' in location && location.name) {
      // name 导航的关键不是“重新匹配 path”，而是：
      // 先锁定 matcher，再筛选/继承 params，最后通过 stringify 反推 path。
      matcher = matcherMap.get(location.name)

      if (!matcher)
        throw createRouterError<MatcherError>(ErrorTypes.MATCHER_NOT_FOUND, {
          location,
        })

      // warn if the user is passing invalid params so they can debug it better when they get removed
      if (__DEV__) {
        const invalidParams: string[] = Object.keys(
          location.params || {}
        ).filter(paramName => !matcher!.keys.find(k => k.name === paramName))

        if (invalidParams.length) {
          // when the invalid params are inherited from the current location
          // (e.g. `pathMatch` from a catch-all redirecting to a named route),
          // suggest the `params: {}` workaround
          const isInherited =
            !matcher!.keys.length &&
            invalidParams.some(name => name in currentLocation.params)
          warn(
            `Discarded invalid param(s) "${invalidParams.join(
              '", "'
            )}" when navigating.` +
              (isInherited
                ? ` If you are using a catch-all route with a named redirect, pass an empty \`params\` object: \`redirect: { name: '...', params: {} }\`.`
                : '') +
              ` See https://github.com/vuejs/router/blob/main/packages/router/CHANGELOG.md#414-2022-08-22 for more details.`
          )
        }
      }

      name = matcher.record.name
      params = assign(
        // paramsFromLocation is a new object
        pickParams(
          currentLocation.params,
          // only keep params that exist in the resolved location
          // only keep optional params coming from a parent record
          matcher.keys
            .filter(k => !k.optional)
            .concat(
              matcher.parent ? matcher.parent.keys.filter(k => k.optional) : []
            )
            .map(k => k.name)
        ),
        // discard any existing params in the current location that do not exist here
        // #1497 this ensures better active/exact matching
        location.params &&
          pickParams(
            location.params,
            matcher.keys.map(k => k.name)
          )
      )
      // throws if cannot be stringified
      path = matcher.stringify(params)
    } else if (location.path != null) {
      // no need to resolve the path with the matcher as it was provided
      // this also allows the user to control the encoding
      path = location.path

      if (__DEV__ && !path.startsWith('/')) {
        warn(
          `The Matcher cannot resolve relative paths but received "${path}". Unless you directly called \`matcher.resolve("${path}")\`, this is probably a bug in vue-router. Please open an issue at https://github.com/vuejs/router/issues/new/choose.`
        )
      }

      matcher = matchers.find(m => m.re.test(path))
      // 这里依赖 matchers 已经提前按 score 排序，
      // 所以 find 命中的第一个就是“最合适”的那条规则。
      // matcher should have a value after the loop

      if (matcher) {
        // we know the matcher works because we tested the regexp
        params = matcher.parse(path)!
        name = matcher.record.name

        // delete all optional params that have falsy values
        // noramlizes '', null, and undefined into deleting the key
        matcher.keys.forEach(key => {
          if (key.optional && !params[key.name]) {
            delete params[key.name]
          }
        })
      }
      // location is a relative path
    } else {
      // match by name or path of current route
      // 相对导航分支复用当前 matcher，并只对 params 做增量合并。
      matcher = currentLocation.name
        ? matcherMap.get(currentLocation.name)
        : matchers.find(m => m.re.test(currentLocation.path))
      if (!matcher)
        throw createRouterError<MatcherError>(ErrorTypes.MATCHER_NOT_FOUND, {
          location,
          currentLocation,
        })
      name = matcher.record.name
      // since we are navigating to the same location, we don't need to pick the
      // params like when `name` is provided
      params = assign({}, currentLocation.params, location.params)
      path = matcher.stringify(params)
    }

    // matched 会从当前记录一路回溯 parent，最终得到从根到叶子的渲染链。
    const matched: MatcherLocation['matched'] = []
    let parentMatcher: RouteRecordMatcher | undefined = matcher
    while (parentMatcher) {
      // reversed order so parents are at the beginning

      matched.unshift(parentMatcher.record)
      parentMatcher = parentMatcher.parent
    }

    return {
      name,
      path,
      params,
      matched,
      meta: mergeMetaFields(matched),
    }
  }

  // add initial routes
  routes.forEach(route => addRoute(route))

  function clearRoutes() {
    matchers.length = 0
    matcherMap.clear()
  }

  return {
    addRoute,
    resolve,
    removeRoute,
    clearRoutes,
    getRoutes,
    getRecordMatcher,
  }
}

/**
 * Picks an object param to contain only specified keys.
 *
 * @param params - params object to pick from
 * @param keys - keys to pick
 */
function pickParams(
  params: MatcherLocation['params'],
  keys: string[]
): MatcherLocation['params'] {
  const newParams = {} as MatcherLocation['params']

  for (const key of keys) {
    if (key in params) newParams[key] = params[key]
  }

  return newParams
}

/**
 * Normalizes a RouteRecordRaw. Creates a copy
 *
 * @param record
 * @returns the normalized version
 */
export function normalizeRouteRecord(
  record: RouteRecordRaw & { aliasOf?: RouteRecordNormalized }
): RouteRecordNormalized {
  // normalize 的目标是把各种用户写法统一成内部稳定结构：
  // component/components、props、children、guards 容器、instances 容器等。
  const normalized: Omit<RouteRecordNormalized, 'mods'> = {
    path: record.path,
    redirect: record.redirect,
    name: record.name,
    meta: record.meta || {},
    aliasOf: record.aliasOf,
    beforeEnter: record.beforeEnter,
    props: normalizeRecordProps(record),
    children: record.children || [],
    instances: {},
    leaveGuards: new Set(),
    updateGuards: new Set(),
    enterCallbacks: {},
    // must be declared afterwards
    // mods: {},
    components:
      'components' in record
        ? record.components || null
        : record.component && { default: record.component },
  }

  // mods contain modules and shouldn't be copied,
  // logged or anything. It's just used for internal
  // advanced use cases like data loaders
  Object.defineProperty(normalized, 'mods', {
    value: {},
  })

  return normalized as RouteRecordNormalized
}

/**
 * Normalize the optional `props` in a record to always be an object similar to
 * components. Also accept a boolean for components.
 * @param record
 */
export function normalizeRecordProps(
  record: RouteRecordRaw
): Record<string, _RouteRecordProps> {
  // 对外 props 可以是 boolean / object / 多视图对象，
  // 对内统一成“按 view name 索引”的对象结构。
  const propsObject = {} as Record<string, _RouteRecordProps>
  // props does not exist on redirect records, but we can set false directly
  const props = record.props || false
  if ('component' in record) {
    propsObject.default = props
  } else {
    // NOTE: we could also allow a function to be applied to every component.
    // Would need user feedback for use cases
    for (const name in record.components)
      propsObject[name] = typeof props === 'object' ? props[name] : props
  }

  return propsObject
}

/**
 * Checks if a record or any of its parent is an alias
 * @param record
 */
function isAliasRecord(record: RouteRecordMatcher | undefined): boolean {
  while (record) {
    if (record.record.aliasOf) return true
    record = record.parent
  }

  return false
}

/**
 * Merge meta fields of an array of records
 *
 * @param matched - array of matched records
 */
function mergeMetaFields(matched: MatcherLocation['matched']) {
  // meta 采用从父到子的浅合并，子路由同名字段会覆盖父路由。
  return matched.reduce(
    (meta, record) => assign(meta, record.meta),
    {} as MatcherLocation['meta']
  )
}

type ParamKey = RouteRecordMatcher['keys'][number]

function isSameParam(a: ParamKey, b: ParamKey): boolean {
  return (
    a.name === b.name &&
    a.optional === b.optional &&
    a.repeatable === b.repeatable
  )
}

/**
 * Check if a path and its alias have the same required params
 *
 * @param a - original record
 * @param b - alias record
 */
function checkSameParams(a: RouteRecordMatcher, b: RouteRecordMatcher) {
  for (const key of a.keys) {
    if (!key.optional && !b.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
  for (const key of b.keys) {
    if (!key.optional && !a.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
}

/**
 * A route with a name and a child with an empty path without a name should warn when adding the route
 *
 * @param mainNormalizedRecord - RouteRecordNormalized
 * @param parent - RouteRecordMatcher
 */
export function checkChildMissingNameWithEmptyPath(
  mainNormalizedRecord: RouteRecordNormalized,
  parent?: RouteRecordMatcher
) {
  if (
    parent &&
    parent.record.name &&
    !mainNormalizedRecord.name &&
    !mainNormalizedRecord.path &&
    mainNormalizedRecord.children.length === 0
  ) {
    warn(
      `The route named "${String(
        parent.record.name
      )}" has a child without a name, an empty path, and no children. This is probably a mistake: using that name won't render the empty path child so you probably want to move the name to the child instead. If this is intentional, add a name to the child route to silence the warning.`
    )
  }
}

function checkSameNameAsAncestor(
  record: RouteRecordRaw,
  parent?: RouteRecordMatcher
) {
  for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.record.name === record.name) {
      throw new Error(
        `A route named "${String(record.name)}" has been added as a ${
          parent === ancestor ? 'child' : 'descendant'
        } of a route with the same name. Route names must be unique and a nested route cannot use the same name as an ancestor.`
      )
    }
  }
}

function checkMissingParamsInAbsolutePath(
  record: RouteRecordMatcher,
  parent: RouteRecordMatcher
) {
  for (const key of parent.keys) {
    if (!record.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Absolute path "${record.record.path}" must have the exact same param named "${key.name}" as its parent "${parent.record.path}".`
      )
  }
}

/**
 * Performs a binary search to find the correct insertion index for a new matcher.
 *
 * Matchers are primarily sorted by their score. If scores are tied then we also consider parent/child relationships,
 * with descendants coming before ancestors. If there's still a tie, new routes are inserted after existing routes.
 *
 * @param matcher - new matcher to be inserted
 * @param matchers - existing matchers
 */
function findInsertionIndex(
  matcher: RouteRecordMatcher,
  matchers: RouteRecordMatcher[]
) {
  // path rank 越高，越应该排在前面。这里使用二分查找降低大路由表下的插入成本。
  // First phase: binary search based on score
  let lower = 0
  let upper = matchers.length

  while (lower !== upper) {
    const mid = (lower + upper) >> 1
    const sortOrder = comparePathParserScore(matcher, matchers[mid])

    if (sortOrder < 0) {
      upper = mid
    } else {
      lower = mid + 1
    }
  }

  // Second phase: check for an ancestor with the same score
  // 如果分数相同，还要保证“子路由排在祖先附近且顺序稳定”，
  // 否则同分场景下 matched 链和命中优先级会出现反直觉结果。
  const insertionAncestor = getInsertionAncestor(matcher)

  if (insertionAncestor) {
    upper = matchers.lastIndexOf(insertionAncestor, upper - 1)

    if (__DEV__ && upper < 0) {
      // This should never happen
      warn(
        `Finding ancestor route "${insertionAncestor.record.path}" failed for "${matcher.record.path}"`
      )
    }
  }

  return upper
}

function getInsertionAncestor(matcher: RouteRecordMatcher) {
  // 只有“可命中”的祖先才参与这个 tie-break。
  let ancestor: RouteRecordMatcher | undefined = matcher

  while ((ancestor = ancestor.parent)) {
    if (
      isMatchable(ancestor) &&
      comparePathParserScore(matcher, ancestor) === 0
    ) {
      return ancestor
    }
  }

  return
}

/**
 * Checks if a matcher can be reachable. This means if it's possible to reach it as a route. For example, routes without
 * a component, or name, or redirect, are just used to group other routes.
 * @param matcher
 * @param matcher.record record of the matcher
 * @returns
 */
function isMatchable({ record }: RouteRecordMatcher): boolean {
  // 没有 component / name / redirect 的纯分组节点仍然能出现在树里，
  // 但不会直接参与 path 命中扫描。
  return !!(
    record.name ||
    (record.components && Object.keys(record.components).length) ||
    record.redirect
  )
}

export type { PathParserOptions, _PathParserOptions }
