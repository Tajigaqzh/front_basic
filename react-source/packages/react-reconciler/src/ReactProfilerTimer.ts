/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { unstable_now } from "scheduler";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane, Lanes } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

// @beginner: 声明 REGULAR_UPDATE：保存当前步骤需要读取或更新的数据。
export const REGULAR_UPDATE = 0;
// @beginner: 声明 SPAWNED_UPDATE：保存当前步骤需要读取或更新的数据。
export const SPAWNED_UPDATE = 1;
// @beginner: 声明 PINGED_UPDATE：保存当前步骤需要读取或更新的数据。
export const PINGED_UPDATE = 2;
// @beginner: 定义 UpdateType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type UpdateType = typeof REGULAR_UPDATE | typeof SPAWNED_UPDATE | typeof PINGED_UPDATE;

// @beginner: 声明 renderStartTime：保存当前步骤需要读取或更新的数据。
export let renderStartTime = -0;
// @beginner: 声明 commitStartTime：保存当前步骤需要读取或更新的数据。
export let commitStartTime = -0;
// @beginner: 声明 commitEndTime：保存当前步骤需要读取或更新的数据。
export let commitEndTime = -0;
// @beginner: 声明 commitErrors：保存当前步骤需要读取或更新的数据。
export let commitErrors: Array<CapturedValue<unknown>> | null = null;
// @beginner: 声明 profilerStartTime：保存当前步骤需要读取或更新的数据。
export let profilerStartTime = -1.1;
// @beginner: 声明 profilerEffectDuration：保存当前步骤需要读取或更新的数据。
export let profilerEffectDuration = -0;
// @beginner: 声明 componentEffectDuration：保存当前步骤需要读取或更新的数据。
export let componentEffectDuration = -0;
// @beginner: 声明 componentEffectStartTime：保存当前步骤需要读取或更新的数据。
export let componentEffectStartTime = -1.1;
// @beginner: 声明 componentEffectEndTime：保存当前步骤需要读取或更新的数据。
export let componentEffectEndTime = -1.1;
// @beginner: 声明 componentEffectErrors：保存当前步骤需要读取或更新的数据。
export let componentEffectErrors: Array<CapturedValue<unknown>> | null = null;
// @beginner: 声明 componentEffectSpawnedUpdate：保存当前步骤需要读取或更新的数据。
export let componentEffectSpawnedUpdate = false;

// @beginner: 声明 blockingUpdateTime：保存当前步骤需要读取或更新的数据。
export let blockingUpdateTime = -1.1;
// @beginner: 声明 blockingUpdateType：保存当前步骤需要读取或更新的数据。
export let blockingUpdateType: UpdateType = REGULAR_UPDATE;
// @beginner: 声明 blockingUpdateMethodName：保存当前步骤需要读取或更新的数据。
export let blockingUpdateMethodName: string | null = null;
// @beginner: 声明 blockingUpdateComponentName：保存当前步骤需要读取或更新的数据。
export let blockingUpdateComponentName: string | null = null;
// @beginner: 声明 transitionStartTime：保存当前步骤需要读取或更新的数据。
export let transitionStartTime = -1.1;
// @beginner: 声明 transitionUpdateTime：保存当前步骤需要读取或更新的数据。
export let transitionUpdateTime = -1.1;
// @beginner: 声明 transitionUpdateType：保存当前步骤需要读取或更新的数据。
export let transitionUpdateType: UpdateType = REGULAR_UPDATE;
// @beginner: 声明 transitionUpdateMethodName：保存当前步骤需要读取或更新的数据。
export let transitionUpdateMethodName: string | null = null;
// @beginner: 声明 transitionUpdateComponentName：保存当前步骤需要读取或更新的数据。
export let transitionUpdateComponentName: string | null = null;
// @beginner: 声明 retryClampTime：保存当前步骤需要读取或更新的数据。
export let retryClampTime = -0;
// @beginner: 声明 idleClampTime：保存当前步骤需要读取或更新的数据。
export let idleClampTime = -0;
// @beginner: 声明 animatingLanes：保存当前步骤需要读取或更新的数据。
export let animatingLanes: Lanes = 0;
// @beginner: 声明 yieldReason：保存当前步骤需要读取或更新的数据。
export let yieldReason = 0;
// @beginner: 声明 yieldStartTime：保存当前步骤需要读取或更新的数据。
export let yieldStartTime = -1.1;

// @beginner: 声明 scheduledTransitionWork：保存当前步骤需要读取或更新的数据。
let scheduledTransitionWork = false;

// @beginner: 进入 startYieldTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startYieldTimer(reason: number): void {
  yieldStartTime = unstable_now();
  yieldReason = reason;
}

// @beginner: 进入 startUpdateTimerByLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startUpdateTimerByLane(_lane: Lane, method: string, fiber: Fiber | null): void {
  blockingUpdateTime = unstable_now();
  blockingUpdateMethodName = method;
  blockingUpdateComponentName = fiber === null ? null : getComponentNameFromFiber(fiber);
}

// @beginner: 进入 startPingTimerByLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startPingTimerByLanes(_lanes: Lanes): void {
  retryClampTime = unstable_now();
  blockingUpdateType = PINGED_UPDATE;
}

// @beginner: 进入 startAsyncTransitionTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startAsyncTransitionTimer(): void {
  transitionStartTime = unstable_now();
  scheduledTransitionWork = false;
}

// @beginner: 进入 clearAsyncTransitionTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function clearAsyncTransitionTimer(): void {
  transitionStartTime = -1.1;
  scheduledTransitionWork = false;
}

// @beginner: 进入 markScheduledTransitionWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markScheduledTransitionWork(): void {
  scheduledTransitionWork = true;
}

// @beginner: 进入 hasScheduledTransitionWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hasScheduledTransitionWork(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return scheduledTransitionWork;
}

// @beginner: 进入 startCommitTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startCommitTimer(): void {
  commitStartTime = unstable_now();
}

// @beginner: 进入 stopCommitTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function stopCommitTimer(): void {
  commitEndTime = unstable_now();
}

// @beginner: 进入 startProfilerTimer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startProfilerTimer(_fiber: Fiber): void {
  profilerStartTime = unstable_now();
}

// @beginner: 进入 stopProfilerTimerIfRunningAndRecordDuration：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function stopProfilerTimerIfRunningAndRecordDuration(_fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (profilerStartTime >= 0) {
    profilerEffectDuration += unstable_now() - profilerStartTime;
    profilerStartTime = -1.1;
  }
}

// @beginner: 进入 transferActualDuration：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function transferActualDuration(_fiber: Fiber): void {}

// @beginner: 进入 resetNestedUpdateFlag：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetNestedUpdateFlag(): void {
  componentEffectSpawnedUpdate = false;
}

// @beginner: 进入 syncNestedUpdateFlag：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function syncNestedUpdateFlag(): void {}
