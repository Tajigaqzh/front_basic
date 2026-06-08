/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getFiberCurrentPropsFromNode,
  getInstanceFromNode,
} from "../client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { restoreControlledState } from "../client/ReactDOMComponent.js";

// @beginner: 声明 restoreTarget：保存当前步骤需要读取或更新的数据。
let restoreTarget: Node | null = null;
// @beginner: 声明 restoreQueue：保存当前步骤需要读取或更新的数据。
let restoreQueue: Node[] | null = null;

// @beginner: 进入 enqueueStateRestore：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueStateRestore(target: Node | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (target === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (restoreTarget !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (restoreQueue !== null) {
      restoreQueue.push(target);
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      restoreQueue = [target];
    }
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    restoreTarget = target;
  }
}

// @beginner: 进入 needsStateRestore：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function needsStateRestore(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return restoreTarget !== null || restoreQueue !== null;
}

// @beginner: 进入 restoreStateIfNeeded：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreStateIfNeeded(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (restoreTarget === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 target：保存当前步骤需要读取或更新的数据。
  const target = restoreTarget;
  // @beginner: 声明 queuedTargets：保存当前步骤需要读取或更新的数据。
  const queuedTargets = restoreQueue;
  restoreTarget = null;
  restoreQueue = null;

  restoreStateOfTarget(target);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queuedTargets !== null) {
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = 0; i < queuedTargets.length; i += 1) {
      restoreStateOfTarget(queuedTargets[i]);
    }
  }
}

// @beginner: 进入 restoreStateOfTarget：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function restoreStateOfTarget(target: Node): void {
  // 事件结束后再取一次 DOM -> Fiber，保证拿到当前树上的实例。
  // @beginner: 声明 internalInstance：保存当前步骤需要读取或更新的数据。
  const internalInstance = getInstanceFromNode(target);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (internalInstance === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 stateNode：保存当前步骤需要读取或更新的数据。
  const stateNode = internalInstance.stateNode;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (stateNode !== null && typeof stateNode === "object") {
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = getFiberCurrentPropsFromNode(stateNode as Node);
    restoreControlledState(stateNode as Element, String(internalInstance.type), props);
  }
}
