/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ViewTransitionState } from "./ReactFiberViewTransitionComponent.js";

// @beginner: 声明 shouldStartViewTransition：保存当前步骤需要读取或更新的数据。
export let shouldStartViewTransition = false;
// @beginner: 声明 appearingViewTransitions：保存当前步骤需要读取或更新的数据。
export let appearingViewTransitions: Map<string, ViewTransitionState> | null = null;
// @beginner: 声明 viewTransitionCancelableChildren：保存当前步骤需要读取或更新的数据。
export let viewTransitionCancelableChildren: null | Array<Fiber | null> = null;

// @beginner: 定义 ViewTransitionRecord：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ViewTransitionRecord {
  type: string;
  fiber: Fiber;
  name?: string | null;
}

// @beginner: 声明 committedViewTransitions：保存当前步骤需要读取或更新的数据。
export const committedViewTransitions: ViewTransitionRecord[] = [];
// @beginner: 声明 measuredViewTransitions：保存当前步骤需要读取或更新的数据。
export const measuredViewTransitions: ViewTransitionRecord[] = [];

// @beginner: 进入 record：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function record(type: string, fiber: Fiber, name?: string | null): void {
  shouldStartViewTransition = true;
  committedViewTransitions.push({ type, fiber, name });
}

// @beginner: 进入 keyName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function keyName(fiber: Fiber): string | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber.key === null ? null : String(fiber.key);
}

// @beginner: 进入 resetShouldStartViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetShouldStartViewTransition(): void {
  shouldStartViewTransition = false;
}

// @beginner: 进入 resetAppearingViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetAppearingViewTransitions(): void {
  appearingViewTransitions = null;
}

// @beginner: 进入 trackAppearingViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackAppearingViewTransition(name: string, state: ViewTransitionState): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (appearingViewTransitions === null) {
    appearingViewTransitions = new Map();
  }
  appearingViewTransitions.set(name, state);
  shouldStartViewTransition = true;
}

// @beginner: 进入 trackEnterViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackEnterViewTransitions(placement: Fiber): void {
  record("enter", placement);
}

// @beginner: 进入 pushViewTransitionCancelableScope：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushViewTransitionCancelableScope(): null | Array<Fiber | null> {
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = viewTransitionCancelableChildren;
  viewTransitionCancelableChildren = [];
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return previous;
}

// @beginner: 进入 popViewTransitionCancelableScope：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popViewTransitionCancelableScope(previous: null | Array<Fiber | null>): void {
  viewTransitionCancelableChildren = previous;
}

// @beginner: 进入 commitEnterViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitEnterViewTransitions(finishedWork: Fiber): void {
  record("commit-enter", finishedWork);
}

// @beginner: 进入 commitExitViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitExitViewTransitions(deletion: Fiber): void {
  record("commit-exit", deletion);
}

// @beginner: 进入 commitBeforeUpdateViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitBeforeUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  record("before-update", finishedWork, keyName(current));
}

// @beginner: 进入 commitNestedViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitNestedViewTransitions(changedParent: Fiber): void {
  record("nested", changedParent);
}

// @beginner: 进入 restoreEnterOrExitViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreEnterOrExitViewTransitions(fiber: Fiber): void {
  record("restore-enter-exit", fiber);
}

// @beginner: 进入 restoreUpdateViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  record("restore-update", finishedWork, keyName(current));
}

// @beginner: 进入 restoreUpdateViewTransitionForGesture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreUpdateViewTransitionForGesture(current: Fiber, finishedWork: Fiber): void {
  record("restore-update-gesture", finishedWork, keyName(current));
}

// @beginner: 进入 restoreNestedViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreNestedViewTransitions(changedParent: Fiber): void {
  record("restore-nested", changedParent);
}

// @beginner: 进入 measureViewTransitionHostInstances：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function measureViewTransitionHostInstances(fiber: Fiber): void {
  measuredViewTransitions.push({ type: "measure-host", fiber });
}

// @beginner: 进入 measureUpdateViewTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function measureUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  measuredViewTransitions.push({ type: "measure-update", fiber: finishedWork, name: keyName(current) });
}

// @beginner: 进入 measureNestedViewTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function measureNestedViewTransitions(changedParent: Fiber): void {
  measuredViewTransitions.push({ type: "measure-nested", fiber: changedParent });
}
