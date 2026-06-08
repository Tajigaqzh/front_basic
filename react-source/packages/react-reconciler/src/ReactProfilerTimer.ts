import { unstable_now } from "scheduler";
import type { Fiber } from "./ReactInternalTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import type { CapturedValue } from "./ReactCapturedValue.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

export const REGULAR_UPDATE = 0;
export const SPAWNED_UPDATE = 1;
export const PINGED_UPDATE = 2;
export type UpdateType = typeof REGULAR_UPDATE | typeof SPAWNED_UPDATE | typeof PINGED_UPDATE;

export let renderStartTime = -0;
export let commitStartTime = -0;
export let commitEndTime = -0;
export let commitErrors: Array<CapturedValue<unknown>> | null = null;
export let profilerStartTime = -1.1;
export let profilerEffectDuration = -0;
export let componentEffectDuration = -0;
export let componentEffectStartTime = -1.1;
export let componentEffectEndTime = -1.1;
export let componentEffectErrors: Array<CapturedValue<unknown>> | null = null;
export let componentEffectSpawnedUpdate = false;

export let blockingUpdateTime = -1.1;
export let blockingUpdateType: UpdateType = REGULAR_UPDATE;
export let blockingUpdateMethodName: string | null = null;
export let blockingUpdateComponentName: string | null = null;
export let transitionStartTime = -1.1;
export let transitionUpdateTime = -1.1;
export let transitionUpdateType: UpdateType = REGULAR_UPDATE;
export let transitionUpdateMethodName: string | null = null;
export let transitionUpdateComponentName: string | null = null;
export let retryClampTime = -0;
export let idleClampTime = -0;
export let animatingLanes: Lanes = 0;
export let yieldReason = 0;
export let yieldStartTime = -1.1;

let scheduledTransitionWork = false;

export function startYieldTimer(reason: number): void {
  yieldStartTime = unstable_now();
  yieldReason = reason;
}

export function startUpdateTimerByLane(_lane: Lane, method: string, fiber: Fiber | null): void {
  blockingUpdateTime = unstable_now();
  blockingUpdateMethodName = method;
  blockingUpdateComponentName = fiber === null ? null : getComponentNameFromFiber(fiber);
}

export function startPingTimerByLanes(_lanes: Lanes): void {
  retryClampTime = unstable_now();
  blockingUpdateType = PINGED_UPDATE;
}

export function startAsyncTransitionTimer(): void {
  transitionStartTime = unstable_now();
  scheduledTransitionWork = false;
}

export function clearAsyncTransitionTimer(): void {
  transitionStartTime = -1.1;
  scheduledTransitionWork = false;
}

export function markScheduledTransitionWork(): void {
  scheduledTransitionWork = true;
}

export function hasScheduledTransitionWork(): boolean {
  return scheduledTransitionWork;
}

export function startCommitTimer(): void {
  commitStartTime = unstable_now();
}

export function stopCommitTimer(): void {
  commitEndTime = unstable_now();
}

export function startProfilerTimer(_fiber: Fiber): void {
  profilerStartTime = unstable_now();
}

export function stopProfilerTimerIfRunningAndRecordDuration(_fiber: Fiber): void {
  if (profilerStartTime >= 0) {
    profilerEffectDuration += unstable_now() - profilerStartTime;
    profilerStartTime = -1.1;
  }
}

export function transferActualDuration(_fiber: Fiber): void {}

export function resetNestedUpdateFlag(): void {
  componentEffectSpawnedUpdate = false;
}

export function syncNestedUpdateFlag(): void {}
