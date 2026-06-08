/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { COMMENT_NODE, DOCUMENT_NODE, DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE } from "./HTMLNodeType.js";

// @beginner: 进入 isValidContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isValidContainer(node: unknown): node is Element | Document | DocumentFragment | Comment {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node === null || typeof node !== "object") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 声明 nodeType：保存当前步骤需要读取或更新的数据。
  const nodeType = (node as { nodeType?: number }).nodeType;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    nodeType === ELEMENT_NODE ||
    nodeType === DOCUMENT_NODE ||
    nodeType === DOCUMENT_FRAGMENT_NODE ||
    nodeType === COMMENT_NODE
  );
}
