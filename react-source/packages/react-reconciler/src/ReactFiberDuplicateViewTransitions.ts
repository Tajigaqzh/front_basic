/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";

// @beginner: 声明 namedViewTransitions：保存当前步骤需要读取或更新的数据。
const namedViewTransitions = new Map<string, Set<Fiber>>();

// @beginner: 进入 getName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getName(fiber: Fiber): string | null {
  // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
  const props = fiber.memoizedProps ?? fiber.pendingProps;
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = props?.name;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof name === "string" && name !== "" ? name : null;
}

// @beginner: 进入 trackNamedViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackNamedViewTransition(fiber: Fiber): void {
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = getName(fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (name === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 声明 set：保存当前步骤需要读取或更新的数据。
  let set = namedViewTransitions.get(name);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (set === undefined) {
    set = new Set();
    namedViewTransitions.set(name, set);
  }
  set.add(fiber);
}

// @beginner: 进入 untrackNamedViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function untrackNamedViewTransition(fiber: Fiber): void {
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = getName(fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (name === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 声明 set：保存当前步骤需要读取或更新的数据。
  const set = namedViewTransitions.get(name);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (set === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  set.delete(fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (set.size === 0) {
    namedViewTransitions.delete(name);
  }
}

// @beginner: 进入 getViewTransitionNameCount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getViewTransitionNameCount(name: string): number {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return namedViewTransitions.get(name)?.size ?? 0;
}
