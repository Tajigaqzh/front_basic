import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import { getNextSiblingHostFiber } from "react-reconciler/src/ReactFiberTreeReflection.js";

type ComparablePublicInstance = {
  compareDocumentPosition(other: unknown): number;
};

/**
 * 空 Fragment 没有自己的 DOM 节点，只能借助父节点和下一个 host sibling 推断
 * `compareDocumentPosition`。官方 DOM/Fabric host config 共用这段逻辑。
 */
export function compareDocumentPositionForEmptyFragment<TPublicInstance extends ComparablePublicInstance>(
  fragmentFiber: Fiber,
  parentHostInstance: TPublicInstance,
  otherNode: TPublicInstance,
  getPublicInstance: (fiber: Fiber) => TPublicInstance,
): number {
  const parentResult = parentHostInstance.compareDocumentPosition(otherNode);
  let result = parentResult;

  if (parentHostInstance === otherNode) {
    result = Node.DOCUMENT_POSITION_CONTAINS;
  } else if (parentResult & Node.DOCUMENT_POSITION_CONTAINED_BY) {
    const nextSiblingFiber = getNextSiblingHostFiber(fragmentFiber);
    if (nextSiblingFiber === null) {
      result = Node.DOCUMENT_POSITION_PRECEDING;
    } else {
      const nextSiblingInstance = getPublicInstance(nextSiblingFiber);
      const nextSiblingResult = nextSiblingInstance.compareDocumentPosition(otherNode);
      result =
        nextSiblingResult === 0 || nextSiblingResult & Node.DOCUMENT_POSITION_FOLLOWING
          ? Node.DOCUMENT_POSITION_FOLLOWING
          : Node.DOCUMENT_POSITION_PRECEDING;
    }
  }

  return result | Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
}
