import { DefaultEventPriority, type EventPriority } from "react-reconciler/src/ReactEventPriorities.js";

let currentUpdatePriority: EventPriority = DefaultEventPriority;

export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority;
}

export function setCurrentUpdatePriority(newPriority: EventPriority): void {
  currentUpdatePriority = newPriority;
}

export function runWithPriority<T>(priority: EventPriority, fn: () => T): T {
  const previousPriority = currentUpdatePriority;
  currentUpdatePriority = priority;
  try {
    return fn();
  } finally {
    currentUpdatePriority = previousPriority;
  }
}
