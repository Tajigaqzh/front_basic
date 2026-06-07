import type { EmptyParams } from './matcher-pattern'
import type { MatcherPatternPath, MatcherPatternHash } from './matcher-pattern'
import type { MatcherPatternQuery } from './matcher-pattern-query'
import { miss } from './errors'

// 这一组 matcher 主要服务于单元测试，提供最小可复用的命中/构造样板。
export const ANY_PATH_PATTERN_MATCHER: MatcherPatternPath<{
  pathMatch: string
}> = {
  match(path) {
    return { pathMatch: path }
  },
  build({ pathMatch }) {
    return pathMatch
  },
}

export const EMPTY_PATH_PATTERN_MATCHER: MatcherPatternPath<EmptyParams> = {
  match: path => {
    // 只接受根路径，用来验证“完全空参数”的场景。
    if (path !== '/') {
      miss()
    }
    return {}
  },
  build: () => '/',
}

export const USER_ID_PATH_PATTERN_MATCHER: MatcherPatternPath<{ id: number }> =
  {
    match(value) {
      // 这里故意不用更复杂的 parser，测试里只关心 resolver 对动态 path 的处理。
      const match = value.match(/^\/users\/(\d+)$/)
      if (!match?.[1]) {
        miss()
      }
      const id = Number(match[1])
      if (Number.isNaN(id)) {
        miss(`Invalid number: ${String(match[1])}`)
      }
      return { id }
    },
    build({ id }) {
      return `/users/${id}`
    },
  }

export const PAGE_QUERY_PATTERN_MATCHER: MatcherPatternQuery<{ page: number }> =
  {
    match: query => {
      const page = Number(query.page)
      return {
        // 非法页码时默认回退到 1，方便测试 query 默认值分支。
        page: Number.isNaN(page) ? 1 : page,
      }
    },
    build: params => ({ page: String(params.page) }),
  }

export const ANY_HASH_PATTERN_MATCHER: MatcherPatternHash<// hash could be named anything, in this case it creates a param named hash
{ hash: string | null }> = {
  // hash matcher 会去掉开头的 #，build 时再补回去。
  match: hash => ({ hash: hash ? hash.slice(1) : null }),
  build: ({ hash }) => (hash ? `#${hash}` : ''),
}
