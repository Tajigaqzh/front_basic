import type { FiberRoot } from "./ReactInternalTypes.js";
import type { ScheduledGesture } from "./ReactFiberGestureScheduler.js";

export interface GestureApplicationRecord {
  type: "insert-destination-clones" | "departure" | "animation";
  root?: FiberRoot;
  gesture?: ScheduledGesture;
}

export const gestureApplicationRecords: GestureApplicationRecord[] = [];

export function insertDestinationClones(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "insert-destination-clones", root, gesture });
}

export function applyDepartureTransitions(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "departure", root, gesture });
}

export function startGestureAnimations(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "animation", root, gesture });
}
