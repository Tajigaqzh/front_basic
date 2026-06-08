import type { CapturedValue } from "./ReactCapturedValue.js";
import type { Fiber } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

export interface PerformanceTrackEvent {
  type: string;
  name?: string | null;
  startTime?: number;
  endTime?: number;
  lanes?: Lanes;
  error?: unknown;
}

export const performanceTrackEvents: PerformanceTrackEvent[] = [];

let currentTrack = "Blocking";
let isInsideDeepEquality = false;

function pushEvent(event: PerformanceTrackEvent): void {
  performanceTrackEvents.push(event);
}

export function setCurrentTrackFromLanes(lanes: Lanes): void {
  currentTrack = lanes === 0 ? "NoLane" : `Lane:${lanes}`;
}

export function markAllLanesInOrder(): void {
  pushEvent({ type: "markAllLanes", name: currentTrack });
}

export function logComponentMount(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "mount", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function logComponentUnmount(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "unmount", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function logComponentReappeared(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "reappeared", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function logComponentDisappeared(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "disappeared", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function pushDeepEquality(): boolean {
  const previous = isInsideDeepEquality;
  isInsideDeepEquality = true;
  return previous;
}

export function popDeepEquality(previous: boolean): void {
  isInsideDeepEquality = previous;
}

export function logComponentRender(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: isInsideDeepEquality ? "render:deep-equality" : "render", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function logComponentErrored(fiber: Fiber, error: CapturedValue<unknown>, startTime: number, endTime: number): void {
  pushEvent({ type: "component-error", name: getComponentNameFromFiber(fiber), startTime, endTime, error: error.value });
}

export function logComponentEffect(fiber: Fiber, startTime: number, endTime: number): void {
  pushEvent({ type: "effect", name: getComponentNameFromFiber(fiber), startTime, endTime });
}

export function logYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "yield", startTime, endTime });
}

export function logSuspendedYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "suspended-yield", startTime, endTime });
}

export function logActionYieldTime(startTime: number, endTime: number): void {
  pushEvent({ type: "action-yield", startTime, endTime });
}

export function logBlockingStart(name: string, startTime: number): void {
  pushEvent({ type: "blocking-start", name, startTime });
}

export function logGestureStart(name: string, startTime: number): void {
  pushEvent({ type: "gesture-start", name, startTime });
}

export function logTransitionStart(name: string, startTime: number): void {
  pushEvent({ type: "transition-start", name, startTime });
}

function phase(type: string, startTime: number, endTime: number, lanes?: Lanes): void {
  pushEvent({ type, startTime, endTime, lanes });
}

export const logRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("render-phase", startTime, endTime, lanes);
export const logInterruptedRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("interrupted-render-phase", startTime, endTime, lanes);
export const logSuspendedRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-render-phase", startTime, endTime, lanes);
export const logSuspendedWithDelayPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-delay-phase", startTime, endTime, lanes);
export const logRecoveredRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("recovered-render-phase", startTime, endTime, lanes);
export const logErroredRenderPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("errored-render-phase", startTime, endTime, lanes);
export const logInconsistentRender = (startTime: number, endTime: number, lanes?: Lanes) => phase("inconsistent-render", startTime, endTime, lanes);
export const logSuspendedCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-commit-phase", startTime, endTime, lanes);
export const logSuspendedViewTransitionPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("suspended-view-transition-phase", startTime, endTime, lanes);
export const logCommitErrored = (startTime: number, endTime: number, lanes?: Lanes) => phase("commit-errored", startTime, endTime, lanes);
export const logCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("commit-phase", startTime, endTime, lanes);
export const logPaintYieldPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("paint-yield-phase", startTime, endTime, lanes);
export const logApplyGesturePhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("apply-gesture-phase", startTime, endTime, lanes);
export const logStartViewTransitionYieldPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("start-view-transition-yield-phase", startTime, endTime, lanes);
export const logAnimatingPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("animating-phase", startTime, endTime, lanes);
export const logPassiveCommitPhase = (startTime: number, endTime: number, lanes?: Lanes) => phase("passive-commit-phase", startTime, endTime, lanes);
