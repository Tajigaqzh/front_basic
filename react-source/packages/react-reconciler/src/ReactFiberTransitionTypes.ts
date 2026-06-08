/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enableViewTransition } from "shared/ReactFeatureFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { includesTransitionLane } from "./ReactFiberLane.js";

// @beginner: 定义 TransitionType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TransitionType = string;
// @beginner: 定义 TransitionTypes：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TransitionTypes = TransitionType[];

// @beginner: 进入 queueTransitionTypes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function queueTransitionTypes(root: FiberRoot, transitionTypes: TransitionTypes): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableViewTransition || !includesTransitionLane(root.pendingLanes)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 queued：保存当前步骤需要读取或更新的数据。
  let queued = root.transitionTypes;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queued === null || queued === undefined) {
    queued = root.transitionTypes = [];
  }
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const transitionType of transitionTypes) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!queued.includes(transitionType)) {
      queued.push(transitionType);
    }
  }
}

// @beginner: 声明 entangledTransitionTypes：保存当前步骤需要读取或更新的数据。
export let entangledTransitionTypes: null | TransitionTypes = null;

// @beginner: 进入 entangleAsyncTransitionTypes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function entangleAsyncTransitionTypes(transitionTypes: TransitionTypes): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableViewTransition) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 queued：保存当前步骤需要读取或更新的数据。
  let queued = entangledTransitionTypes;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queued === null) {
    queued = entangledTransitionTypes = [];
  }
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const transitionType of transitionTypes) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!queued.includes(transitionType)) {
      queued.push(transitionType);
    }
  }
}

// @beginner: 进入 clearEntangledAsyncTransitionTypes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function clearEntangledAsyncTransitionTypes(): void {
  entangledTransitionTypes = null;
}

// @beginner: 进入 claimQueuedTransitionTypes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function claimQueuedTransitionTypes(root: FiberRoot): null | TransitionTypes {
  // @beginner: 声明 claimed：保存当前步骤需要读取或更新的数据。
  const claimed = root.transitionTypes ?? null;
  root.transitionTypes = null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return claimed;
}
