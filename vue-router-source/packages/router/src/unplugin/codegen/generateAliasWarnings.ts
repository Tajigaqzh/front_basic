import type { PrefixTree } from '../core/tree'

/**
 * Generates runtime warnings for aliases that are not absolute paths.
 *
 * @param tree - prefix tree to scan
 *
 * @internal
 */
export function generateAliasWarnings(tree: PrefixTree): string {
  const warnings: string[] = []

  for (const node of tree.getChildrenDeepSorted()) {
    for (const alias of node.value.alias) {
      // 文件路由模式下 alias 必须是绝对路径，否则运行时无法稳定拼接层级关系。
      if (!alias.startsWith('/')) {
        warnings.push(
          `console.warn('[vue-router] Alias "${alias}" for route "${node.value.fullPath}" must be absolute (start with "/"). Relative aliases are not supported in file-based routing.')`
        )
      }
    }
  }

  // 返回待注入代码字符串，真正执行时由生成后的模块在开发环境里打印。
  return warnings.join('\n')
}
