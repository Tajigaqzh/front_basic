/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props } from "shared";

// @beginner: 声明 internalInstanceKey：保存当前步骤需要读取或更新的数据。
const internalInstanceKey = "__reactFiber$frontSource";
// @beginner: 声明 internalPropsKey：保存当前步骤需要读取或更新的数据。
const internalPropsKey = "__reactProps$frontSource";
// @beginner: 声明 internalContainerKey：保存当前步骤需要读取或更新的数据。
const internalContainerKey = "__reactContainer$frontSource";
// @beginner: 声明 internalScrollTimerKey：保存当前步骤需要读取或更新的数据。
const internalScrollTimerKey = "__reactScrollEndTimer$frontSource";

// @beginner: 定义 NodeWithReactInternals：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type NodeWithReactInternals = Node & {
  [internalInstanceKey]?: Fiber;
  [internalPropsKey]?: Props;
  [internalContainerKey]?: true;
  [internalScrollTimerKey]?: ReturnType<typeof setTimeout> | null;
};

// @beginner: 进入 precacheFiberNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function precacheFiberNode(hostInst: Fiber, node: Node): void {
  (node as NodeWithReactInternals)[internalInstanceKey] = hostInst;
}

// @beginner: 进入 getClosestInstanceFromNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getClosestInstanceFromNode(targetNode: Node): Fiber | null {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Node | null = targetNode;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 声明 inst：保存当前步骤需要读取或更新的数据。
    const inst = (node as NodeWithReactInternals)[internalInstanceKey];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (inst !== undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return inst;
    }
    node = node.parentNode;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 getInstanceFromNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getInstanceFromNode(node: Node): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (node as NodeWithReactInternals)[internalInstanceKey] ?? null;
}

// @beginner: 进入 getNodeFromInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getNodeFromInstance(inst: Fiber): Node {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return inst.stateNode as Node;
}

// @beginner: 进入 updateFiberProps：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateFiberProps(node: Node, props: Props): void {
  (node as NodeWithReactInternals)[internalPropsKey] = props;
}

// @beginner: 进入 getFiberCurrentPropsFromNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getFiberCurrentPropsFromNode(node: Node): Props | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (node as NodeWithReactInternals)[internalPropsKey] ?? null;
}

// @beginner: 进入 markContainerAsRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markContainerAsRoot(_hostRoot: Fiber, node: Node): void {
  (node as NodeWithReactInternals)[internalContainerKey] = true;
}

// @beginner: 进入 unmarkContainerAsRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unmarkContainerAsRoot(node: Node): void {
  delete (node as NodeWithReactInternals)[internalContainerKey];
}

// @beginner: 进入 isContainerMarkedAsRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isContainerMarkedAsRoot(node: Node): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (node as NodeWithReactInternals)[internalContainerKey] === true;
}

// @beginner: 进入 getScrollEndTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getScrollEndTimer(target: EventTarget): ReturnType<typeof setTimeout> | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (target as NodeWithReactInternals)[internalScrollTimerKey] ?? null;
}

// @beginner: 进入 setScrollEndTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setScrollEndTimer(
  target: EventTarget,
  timer: ReturnType<typeof setTimeout>,
): void {
  (target as NodeWithReactInternals)[internalScrollTimerKey] = timer;
}

// @beginner: 进入 clearScrollEndTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function clearScrollEndTimer(target: EventTarget): void {
  // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
  const current = getScrollEndTimer(target);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    clearTimeout(current);
  }
  (target as NodeWithReactInternals)[internalScrollTimerKey] = null;
}
