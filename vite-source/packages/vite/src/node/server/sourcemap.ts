import path from 'node:path'
import type { ResolvedConfig } from '../plugin.js'

export interface SourceMap {
  version: 3
  file?: string
  sources: string[]
  sourcesContent?: string[]
  names: string[]
  mappings: string
}

/**
 * 对齐官方 server/sourcemap.ts。
 *
 * 官方这里负责 sourcemap 合并、sourcesContent 注入、ignoreList 标记。
 * 阅读版实现最小可读版本：为单文件转换生成 identity-ish sourcemap，
 * 并提供 combine/inject/apply 这些同名职责函数。
 */
export function createSimpleSourcemap(
  id: string,
  code: string,
  root: string,
): SourceMap {
  return {
    version: 3,
    file: path.basename(id),
    sources: [path.relative(root, id) || id],
    sourcesContent: [code],
    names: [],
    mappings: ';'.repeat(Math.max(0, code.split('\n').length - 1)),
  }
}

export function injectSourcesContent(map: SourceMap, id: string, code: string): SourceMap {
  return {
    ...map,
    sources: map.sources.length ? map.sources : [id],
    sourcesContent: map.sourcesContent?.length ? map.sourcesContent : [code],
  }
}

export function combineSourcemaps(_filename: string, maps: Array<SourceMap | null | undefined>): SourceMap | null {
  const valid = maps.filter((map): map is SourceMap => Boolean(map))
  if (!valid.length) return null
  if (valid.length === 1) return valid[0]

  return {
    version: 3,
    file: valid[valid.length - 1].file,
    sources: [...new Set(valid.flatMap((map) => map.sources))],
    sourcesContent: valid.flatMap((map) => map.sourcesContent ?? []),
    names: [...new Set(valid.flatMap((map) => map.names))],
    mappings: valid[valid.length - 1].mappings,
  }
}

export function applySourcemapIgnoreList(
  _config: ResolvedConfig,
  map: SourceMap,
): SourceMap & { x_google_ignoreList?: number[] } {
  const ignoreList = map.sources
    .map((source, index) => (source.includes('node_modules') ? index : -1))
    .filter((index) => index >= 0)
  return ignoreList.length ? { ...map, x_google_ignoreList: ignoreList } : map
}
