import { DefaultLane, SyncLane, type Lane } from "./ReactFiberLane.js";

export type EventPriority = Lane;

export const DiscreteEventPriority = SyncLane;
export const ContinuousEventPriority = DefaultLane;
export const DefaultEventPriority = DefaultLane;
export const IdleEventPriority = 0b0100;

let currentUpdatePriority: EventPriority = DefaultEventPriority;

export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority;
}

export function setCurrentUpdatePriority(newPriority: EventPriority): void {
  currentUpdatePriority = newPriority;
}

export function higherEventPriority(a: EventPriority, b: EventPriority): EventPriority {
  return a !== 0 && a < b ? a : b;
}

export function lanesToEventPriority(lanes: Lane): EventPriority {
  return lanes & SyncLane ? DiscreteEventPriority : DefaultEventPriority;
}
