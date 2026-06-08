import type { Fiber } from "./ReactInternalTypes.js";
import type { ViewTransitionState } from "./ReactFiberViewTransitionComponent.js";

export let shouldStartViewTransition = false;
export let appearingViewTransitions: Map<string, ViewTransitionState> | null = null;
export let viewTransitionCancelableChildren: null | Array<Fiber | null> = null;

export interface ViewTransitionRecord {
  type: string;
  fiber: Fiber;
  name?: string | null;
}

export const committedViewTransitions: ViewTransitionRecord[] = [];
export const measuredViewTransitions: ViewTransitionRecord[] = [];

function record(type: string, fiber: Fiber, name?: string | null): void {
  shouldStartViewTransition = true;
  committedViewTransitions.push({ type, fiber, name });
}

function keyName(fiber: Fiber): string | null {
  return fiber.key === null ? null : String(fiber.key);
}

export function resetShouldStartViewTransition(): void {
  shouldStartViewTransition = false;
}

export function resetAppearingViewTransitions(): void {
  appearingViewTransitions = null;
}

export function trackAppearingViewTransition(name: string, state: ViewTransitionState): void {
  if (appearingViewTransitions === null) {
    appearingViewTransitions = new Map();
  }
  appearingViewTransitions.set(name, state);
  shouldStartViewTransition = true;
}

export function trackEnterViewTransitions(placement: Fiber): void {
  record("enter", placement);
}

export function pushViewTransitionCancelableScope(): null | Array<Fiber | null> {
  const previous = viewTransitionCancelableChildren;
  viewTransitionCancelableChildren = [];
  return previous;
}

export function popViewTransitionCancelableScope(previous: null | Array<Fiber | null>): void {
  viewTransitionCancelableChildren = previous;
}

export function commitEnterViewTransitions(finishedWork: Fiber): void {
  record("commit-enter", finishedWork);
}

export function commitExitViewTransitions(deletion: Fiber): void {
  record("commit-exit", deletion);
}

export function commitBeforeUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  record("before-update", finishedWork, keyName(current));
}

export function commitNestedViewTransitions(changedParent: Fiber): void {
  record("nested", changedParent);
}

export function restoreEnterOrExitViewTransitions(fiber: Fiber): void {
  record("restore-enter-exit", fiber);
}

export function restoreUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  record("restore-update", finishedWork, keyName(current));
}

export function restoreUpdateViewTransitionForGesture(current: Fiber, finishedWork: Fiber): void {
  record("restore-update-gesture", finishedWork, keyName(current));
}

export function restoreNestedViewTransitions(changedParent: Fiber): void {
  record("restore-nested", changedParent);
}

export function measureViewTransitionHostInstances(fiber: Fiber): void {
  measuredViewTransitions.push({ type: "measure-host", fiber });
}

export function measureUpdateViewTransition(current: Fiber, finishedWork: Fiber): void {
  measuredViewTransitions.push({ type: "measure-update", fiber: finishedWork, name: keyName(current) });
}

export function measureNestedViewTransitions(changedParent: Fiber): void {
  measuredViewTransitions.push({ type: "measure-nested", fiber: changedParent });
}
