import type { FiberRoot } from "./ReactInternalTypes.js";
import type { TransitionTypes } from "./ReactFiberTransitionTypes.js";

export interface ScheduledGesture {
  provider: unknown;
  options: unknown;
  types: TransitionTypes | null;
  count: number;
  pending: boolean;
  cancelled: boolean;
}

const gesturesByRoot = new WeakMap<FiberRoot, ScheduledGesture[]>();

function getGestures(root: FiberRoot): ScheduledGesture[] {
  let gestures = gesturesByRoot.get(root);
  if (gestures === undefined) {
    gestures = [];
    gesturesByRoot.set(root, gestures);
  }
  return gestures;
}

export function scheduleGesture(
  root: FiberRoot,
  provider: unknown,
  options: unknown = null,
  types: TransitionTypes | null = null,
): ScheduledGesture {
  const gesture: ScheduledGesture = {
    provider,
    options,
    types,
    count: 0,
    pending: true,
    cancelled: false,
  };
  getGestures(root).push(gesture);
  return gesture;
}

export function startScheduledGesture(
  root: FiberRoot,
  provider: unknown,
  options: unknown = null,
  types: TransitionTypes | null = null,
): ScheduledGesture | null {
  const existing = getGestures(root).find((gesture) => gesture.provider === provider && !gesture.cancelled);
  if (existing !== undefined) {
    existing.count += 1;
    existing.options = options;
    existing.types = types;
    existing.pending = false;
    return existing;
  }
  const gesture = scheduleGesture(root, provider, options, types);
  gesture.count = 1;
  gesture.pending = false;
  return gesture;
}

export function cancelScheduledGesture(root: FiberRoot, scheduledGesture: ScheduledGesture): void {
  scheduledGesture.count = Math.max(0, scheduledGesture.count - 1);
  if (scheduledGesture.count === 0) {
    scheduledGesture.cancelled = true;
    const gestures = getGestures(root);
    const index = gestures.indexOf(scheduledGesture);
    if (index >= 0) {
      gestures.splice(index, 1);
    }
  }
}

export function stopCommittedGesture(root: FiberRoot): void {
  gesturesByRoot.set(
    root,
    getGestures(root).filter((gesture) => gesture.pending),
  );
}

export function scheduleGestureCommit(root: FiberRoot): void {
  getGestures(root).forEach((gesture) => {
    gesture.pending = false;
  });
}

export function getScheduledGestures(root: FiberRoot): ScheduledGesture[] {
  return getGestures(root);
}
