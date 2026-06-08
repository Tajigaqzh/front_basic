import {
  ImmediatePriority,
  NormalPriority,
  unstable_scheduleCallback,
} from "scheduler";
import type { FiberRoot } from "./ReactInternalTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import { getNextLanes, includesSyncLane, NoLane, NoLanes } from "./ReactFiberLane.js";
import { TransitionLane, TransitionLane2 } from "./ReactFiberLane.js";
import { performConcurrentWorkOnRoot, performSyncWorkOnRoot } from "./ReactFiberWorkLoop.js";

export let firstScheduledRoot: FiberRoot | null = null;
let lastScheduledRoot: FiberRoot | null = null;
let didScheduleMicrotask = false;
let mightHavePendingSyncWork = false;
const transitionLaneMap = new WeakMap<object, Lane>();
const transitionLanePool = [TransitionLane, TransitionLane2] as const;
let nextTransitionLaneIndex = 0;

export function ensureRootIsScheduled(root: FiberRoot): void {
  if (root !== lastScheduledRoot && root.next === null) {
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
    } else {
      lastScheduledRoot.next = root;
      lastScheduledRoot = root;
    }
  }

  mightHavePendingSyncWork = true;
  ensureScheduleIsScheduled();
}

export function ensureScheduleIsScheduled(): void {
  if (didScheduleMicrotask) {
    return;
  }
  didScheduleMicrotask = true;
  queueMicrotask(processRootScheduleInMicrotask);
}

export function requestTransitionLane(_transition: unknown): Lane {
  if (typeof _transition === "object" && _transition !== null) {
    const existingLane = transitionLaneMap.get(_transition);
    if (existingLane !== undefined) {
      return existingLane;
    }
    const lane = claimNextTransitionLane();
    transitionLaneMap.set(_transition, lane);
    return lane;
  }

  return claimNextTransitionLane();
}

function claimNextTransitionLane(): Lane {
  const lane = transitionLanePool[nextTransitionLaneIndex];
  nextTransitionLaneIndex = (nextTransitionLaneIndex + 1) % transitionLanePool.length;
  return lane;
}

export function flushSyncWorkOnAllRoots(): void {
  if (!mightHavePendingSyncWork) {
    return;
  }

  let root = firstScheduledRoot;
  while (root !== null) {
    if (includesSyncLane(root.pendingLanes)) {
      performSyncWorkOnRoot(root);
    }
    root = root.next;
  }
  mightHavePendingSyncWork = false;
}

function processRootScheduleInMicrotask(): void {
  didScheduleMicrotask = false;
  let previous: FiberRoot | null = null;
  let root = firstScheduledRoot;

  while (root !== null) {
    const next = root.next;
    const nextLanes = scheduleTaskForRootDuringMicrotask(root);
    if (nextLanes === NoLanes) {
      root.next = null;
      if (previous === null) {
        firstScheduledRoot = next;
      } else {
        previous.next = next;
      }
      if (root === lastScheduledRoot) {
        lastScheduledRoot = previous;
      }
    } else {
      previous = root;
    }
    root = next;
  }
}

export function scheduleTaskForRootDuringMicrotask(root: FiberRoot): Lanes {
  const nextLanes = getNextLanes(root);
  if (nextLanes === NoLanes) {
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return NoLanes;
  }

  const newCallbackPriority = nextLanes;
  if (root.callbackNode !== null && root.callbackPriority === newCallbackPriority) {
    return nextLanes;
  }

  const schedulerPriority = includesSyncLane(nextLanes) ? ImmediatePriority : NormalPriority;
  root.callbackNode = unstable_scheduleCallback(schedulerPriority, () => {
    performConcurrentWorkOnRoot(root);
  });
  root.callbackPriority = newCallbackPriority as Lane;
  return nextLanes;
}

export function getFirstScheduledRoot(): FiberRoot | null {
  return firstScheduledRoot;
}
