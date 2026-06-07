import { collectDuplicatedRouteNodes, type PrefixTree } from '../core/tree'

/**
 * Generates runtime warnings for `_parent` conflicts.
 *
 * @param tree - prefix tree to scan
 *
 * @internal
 */
export function generateDuplicatedRoutesWarnings(tree: PrefixTree): string {
  const conflicts = collectDuplicatedRouteNodes(tree)
  if (!conflicts.length) return ''

  return conflicts
    .flatMap(
      // 每个冲突组对应一个 fullPath，把所有来源文件列出来方便定位。
      conflicts =>
        `console.warn('[vue-router] Conflicting files found for route "${conflicts.at(0)!.node.fullPath}":\\n${conflicts.map(({ filePath }) => `- ${filePath}`).join('\\n')}')`
    )
    .join('\n')
}
