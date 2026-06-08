/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getNextSiblingHostFiber } from "react-reconciler/src/ReactFiberTreeReflection.js";

// @beginner: 定义 ComparablePublicInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ComparablePublicInstance = {
  compareDocumentPosition(other: unknown): number;
};

/**
 * 空 Fragment 没有自己的 DOM 节点，只能借助父节点和下一个 host sibling 推断
 * `compareDocumentPosition`。官方 DOM/Fabric host config 共用这段逻辑。
 */
// @beginner: 进入 compareDocumentPositionForEmptyFragment：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function compareDocumentPositionForEmptyFragment<TPublicInstance extends ComparablePublicInstance>(
  fragmentFiber: Fiber,
  parentHostInstance: TPublicInstance,
  otherNode: TPublicInstance,
  getPublicInstance: (fiber: Fiber) => TPublicInstance,
): number {
  // @beginner: 声明 parentResult：保存当前步骤需要读取或更新的数据。
  const parentResult = parentHostInstance.compareDocumentPosition(otherNode);
  // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
  let result = parentResult;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (parentHostInstance === otherNode) {
    result = Node.DOCUMENT_POSITION_CONTAINS;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (parentResult & Node.DOCUMENT_POSITION_CONTAINED_BY) {
    // @beginner: 声明 nextSiblingFiber：保存当前步骤需要读取或更新的数据。
    const nextSiblingFiber = getNextSiblingHostFiber(fragmentFiber);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nextSiblingFiber === null) {
      result = Node.DOCUMENT_POSITION_PRECEDING;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 声明 nextSiblingInstance：保存当前步骤需要读取或更新的数据。
      const nextSiblingInstance = getPublicInstance(nextSiblingFiber);
      // @beginner: 声明 nextSiblingResult：保存当前步骤需要读取或更新的数据。
      const nextSiblingResult = nextSiblingInstance.compareDocumentPosition(otherNode);
      result =
        nextSiblingResult === 0 || nextSiblingResult & Node.DOCUMENT_POSITION_FOLLOWING
          ? Node.DOCUMENT_POSITION_FOLLOWING
          : Node.DOCUMENT_POSITION_PRECEDING;
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return result | Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
}
