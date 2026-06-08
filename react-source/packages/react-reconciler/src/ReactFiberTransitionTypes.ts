import { enableViewTransition } from "shared/ReactFeatureFlags.js";
import type { FiberRoot } from "./ReactInternalTypes.js";
import { includesTransitionLane } from "./ReactFiberLane.js";

export type TransitionType = string;
export type TransitionTypes = TransitionType[];

export function queueTransitionTypes(root: FiberRoot, transitionTypes: TransitionTypes): void {
  if (!enableViewTransition || !includesTransitionLane(root.pendingLanes)) {
    return;
  }

  let queued = root.transitionTypes;
  if (queued === null || queued === undefined) {
    queued = root.transitionTypes = [];
  }
  for (const transitionType of transitionTypes) {
    if (!queued.includes(transitionType)) {
      queued.push(transitionType);
    }
  }
}

export let entangledTransitionTypes: null | TransitionTypes = null;

export function entangleAsyncTransitionTypes(transitionTypes: TransitionTypes): void {
  if (!enableViewTransition) {
    return;
  }

  let queued = entangledTransitionTypes;
  if (queued === null) {
    queued = entangledTransitionTypes = [];
  }
  for (const transitionType of transitionTypes) {
    if (!queued.includes(transitionType)) {
      queued.push(transitionType);
    }
  }
}

export function clearEntangledAsyncTransitionTypes(): void {
  entangledTransitionTypes = null;
}

export function claimQueuedTransitionTypes(root: FiberRoot): null | TransitionTypes {
  const claimed = root.transitionTypes ?? null;
  root.transitionTypes = null;
  return claimed;
}
