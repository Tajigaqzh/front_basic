/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 getNodeForCharacterOffset：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getNodeForCharacterOffset(
  root: Node,
  offset: number,
): { node: Text; offset: number } | null {
  // @beginner: 声明 walker：保存当前步骤需要读取或更新的数据。
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT) ??
    document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // @beginner: 声明 currentOffset：保存当前步骤需要读取或更新的数据。
  let currentOffset = 0;
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = walker.nextNode() as Text | null;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 声明 nextOffset：保存当前步骤需要读取或更新的数据。
    const nextOffset = currentOffset + node.data.length;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (offset <= nextOffset) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return { node, offset: offset - currentOffset };
    }
    currentOffset = nextOffset;
    node = walker.nextNode() as Text | null;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}
