/**
 * This file only contain types and is used for the generated d.ts to avoid polluting the global namespace.
 * https://github.com/posva/unplugin-vue-router/issues/136
 */
// 单独拆一个纯类型出口，是为了让生成的 d.ts 不把实现细节一起卷进全局命名空间。

// TODO: remove these file, it's no longer needed after the merge of unplugin-vue-router into vue-router

export type { Options } from './options'
export type { TreeNode } from './core/tree'
export type {
  TreeNodeValue,
  TreeNodeValueStatic,
  TreeNodeValueParam,
  TreeNodeValueGroup,
} from './core/treeNodeValue'
export type { EditableTreeNode } from './core/extendRoutes'
