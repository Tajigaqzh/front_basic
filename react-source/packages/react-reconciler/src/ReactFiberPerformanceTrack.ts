/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

// @beginner: 定义 PerformanceTrackEvent：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PerformanceTrackEvent {
  type: string;
  name?: string | null;
  startTime?: number;
  endTime?: number;
  lanes?: Lanes;
  error?: unknown;
}

// @beginner: 声明 performanceTrackEvents：保存当前步骤需要读取或更新的数据。
export const performanceTrackEvents: PerformanceTrackEvent[] = [];

// @beginner: 声明 currentTrack：保存当前步骤需要读取或更新的数据。
let currentTrack = "Blocking";
// @beginner: 声明 isInsideDeepEquality：保存当前步骤需要读取或更新的数据。
let isInsideDeepEquality = false;

// @beginner: 进入 pushEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pushEvent(event: PerformanceTrackEvent): void {
  performanceTrackEvents.push(event);
}

// @beginner: 进入 setCurrentTrackFromLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setCurrentTrackFromLanes(lanes: Lanes): void {
  currentTrack = lanes === 0 ? "NoLane" : `Lane:${lanes}`;
}

// @beginner: 进入 markAllLanesInOrder：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markAllLanesInOrder(): void {
  pushEvent({ type: "markAllLanes", name: currentTrack });
}

// @beginner: 进入 logComponentMount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentMount(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "mount", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 logComponentUnmount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentUnmount(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "unmount", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 logComponentReappeared：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentReappeared(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "reappeared", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 logComponentDisappeared：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentDisappeared(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "disappeared", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 pushDeepEquality：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushDeepEquality(): boolean {
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = isInsideDeepEquality;
  isInsideDeepEquality = true;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return previous;
}

// @beginner: 进入 popDeepEquality：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popDeepEquality(previous: boolean): void {
  isInsideDeepEquality = previous;
}

// @beginner: 进入 logComponentRender：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentRender(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: isInsideDeepEquality ? "render:deep-equality" : "render", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 logComponentErrored：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentErrored(fiber: Fiber, error: CapturedValue<unknown>, startTime: number, endTime: number): void {
  pushEvent({ type: "component-error", name: getComponentNameFromFiber(fiber), startTime, endTime, error: error.value });
}

// @beginner: 进入 logComponentEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logComponentEffect(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "effect", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

// @beginner: 进入 logYieldTime：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "yield", startTime, endTime });
}

// @beginner: 进入 logSuspendedYieldTime：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logSuspendedYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "suspended-yield", startTime, endTime });
}

// @beginner: 进入 logActionYieldTime：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logActionYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "action-yield", startTime, endTime });
}

// @beginner: 进入 logBlockingStart：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logBlockingStart(name: string, startTime: number): void {
  pushEvent({ type: "blocking-start", name, startTime });
}

// @beginner: 进入 logGestureStart：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logGestureStart(name: string, startTime: number): void {
  pushEvent({ type: "gesture-start", name, startTime });
}

// @beginner: 进入 logTransitionStart：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logTransitionStart(name: string, startTime: number): void {
  pushEvent({ type: "transition-start", name, startTime });
}

// @beginner: 进入 phase：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function phase(type: string, startTime: number, endTime: number, lanes?: Lanes): void {
  pushEvent({ type, startTime, endTime, lanes });
}

// @beginner: 定义 logRenderPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("render-phase", startTime, endTime, lanes);
// @beginner: 定义 logInterruptedRenderPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logInterruptedRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("interrupted-render-phase", startTime, endTime, lanes);
// @beginner: 定义 logSuspendedRenderPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logSuspendedRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-render-phase", startTime, endTime, lanes);
// @beginner: 定义 logSuspendedWithDelayPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logSuspendedWithDelayPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-delay-phase", startTime, endTime, lanes);
// @beginner: 定义 logRecoveredRenderPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logRecoveredRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("recovered-render-phase", startTime, endTime, lanes);
// @beginner: 定义 logErroredRenderPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logErroredRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("errored-render-phase", startTime, endTime, lanes);
// @beginner: 定义 logInconsistentRender：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logInconsistentRender = (startTime: number, endTime: number, lanes?: Lanes) => phase("inconsistent-render", startTime, endTime, lanes);
// @beginner: 定义 logSuspendedCommitPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logSuspendedCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-commit-phase", startTime, endTime, lanes);
// @beginner: 定义 logSuspendedViewTransitionPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logSuspendedViewTransitionPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-view-transition-phase", startTime, endTime, lanes);
// @beginner: 定义 logCommitErrored：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logCommitErrored = (startTime: number, endTime: number, lanes?: Lanes) => phase("commit-errored", startTime, endTime, lanes);
// @beginner: 定义 logCommitPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("commit-phase", startTime, endTime, lanes);
// @beginner: 定义 logPaintYieldPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logPaintYieldPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("paint-yield-phase", startTime, endTime, lanes);
// @beginner: 定义 logApplyGesturePhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logApplyGesturePhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("apply-gesture-phase", startTime, endTime, lanes);
// @beginner: 定义 logStartViewTransitionYieldPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logStartViewTransitionYieldPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("start-view-transition-yield-phase", startTime, endTime, lanes);
// @beginner: 定义 logAnimatingPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logAnimatingPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("animating-phase", startTime, endTime, lanes);
// @beginner: 定义 logPassiveCommitPhase：这里保存一个可调用函数，后续代码会在需要时执行它。
export const logPassiveCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("passive-commit-phase", startTime, endTime, lanes);
