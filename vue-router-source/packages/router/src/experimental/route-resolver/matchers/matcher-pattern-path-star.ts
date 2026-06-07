import { miss } from './errors'
import type { MatcherPatternPath } from './matcher-pattern'

/**
 * Allows matching a static path folllowed by anything.
 *
 * @example
 *
 * ```ts
 * const matcher = new MatcherPatternPathStar('/team')
 * matcher.match('/team/123') // { pathMatch: '/123' }
 * matcher.match('/team/123/more') // { pathMatch: '/123/more' }
 * matcher.match('/team-123') // { pathMatch: '-123' }
 * matcher.match('/team') // { pathMatch: '' }
 * matcher.build({ pathMatch: '/123' }) // '/team/123'
 * ```
 */
export class MatcherPatternPathStar implements MatcherPatternPath<{
  pathMatch: string
}> {
  private path: string
  constructor(path: string = '') {
    // 内部统一用小写前缀做 startsWith，比每次重新 lowerCase 更便宜。
    this.path = path.toLowerCase()
  }

  match(path: string): { pathMatch: string } {
    if (!path.toLowerCase().startsWith(this.path)) {
      miss()
    }
    return {
      pathMatch: path.slice(this.path.length),
    }
  }

  build(params: { pathMatch: string }): string {
    // 这里不做额外编码，调用方应保证 `pathMatch` 已是可拼接的路径片段。
    return this.path + params.pathMatch
  }
}
