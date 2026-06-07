import type { RouteRecord } from './types'
import type { PathParser, PathParserOptions } from './pathParserRanker'
import { tokensToParser } from './pathParserRanker'
import { tokenizePath } from './pathTokenizer'
import { warn } from '../warning'
import { assign } from '../utils'

export interface RouteRecordMatcher extends PathParser {
  record: RouteRecord
  parent: RouteRecordMatcher | undefined
  children: RouteRecordMatcher[]
  // aliases that must be removed when removing this record
  alias: RouteRecordMatcher[]
}

export function createRouteRecordMatcher(
  record: Readonly<RouteRecord>,
  parent: RouteRecordMatcher | undefined,
  options?: PathParserOptions
): RouteRecordMatcher {
  // 一条 route record 会先经历：
  // path 字符串 -> tokenizePath() -> tokensToParser() -> RouteRecordMatcher
  // 最终产物同时具备：
  // 1. 路径匹配能力
  // 2. params 解析/回填能力
  // 3. 在 matcher 树中的父子关系
  const parser = tokensToParser(tokenizePath(record.path), options)

  // warn against params with the same name
  if (__DEV__) {
    const existingKeys = new Set<string>()
    for (const key of parser.keys) {
      if (existingKeys.has(key.name))
        warn(
          `Found duplicated params with name "${key.name}" for path "${record.path}". Only the last one will be available on "$route.params".`
        )
      existingKeys.add(key.name)
    }
  }

  const matcher: RouteRecordMatcher = assign(parser, {
    record,
    parent,
    // these needs to be populated by the parent
    children: [],
    alias: [],
  })

  if (parent) {
    // 只有 alias 层级一致时才挂入 parent.children，
    // 这样 addRoute/removeRoute 处理 alias 时不会把原始链路和别名链路混在一起。
    // both are aliases or both are not aliases
    // we don't want to mix them because the order is used when
    // passing originalRecord in Matcher.addRoute
    if (!matcher.record.aliasOf === !parent.record.aliasOf)
      parent.children.push(matcher)
  }

  return matcher
}
