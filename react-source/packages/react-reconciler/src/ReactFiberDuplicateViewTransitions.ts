import type { Fiber } from "./ReactInternalTypes.js";

const namedViewTransitions = new Map<string, Set<Fiber>>();

function getName(fiber: Fiber): string | null {
  const props = fiber.memoizedProps ?? fiber.pendingProps;
  const name = props?.name;
  return typeof name === "string" && name !== "" ? name : null;
}

export function trackNamedViewTransition(fiber: Fiber): void {
  const name = getName(fiber);
  if (name === null) {
    return;
  }
  let set = namedViewTransitions.get(name);
  if (set === undefined) {
    set = new Set();
    namedViewTransitions.set(name, set);
  }
  set.add(fiber);
}

export function untrackNamedViewTransition(fiber: Fiber): void {
  const name = getName(fiber);
  if (name === null) {
    return;
  }
  const set = namedViewTransitions.get(name);
  if (set === undefined) {
    return;
  }
  set.delete(fiber);
  if (set.size === 0) {
    namedViewTransitions.delete(name);
  }
}

export function getViewTransitionNameCount(name: string): number {
  return namedViewTransitions.get(name)?.size ?? 0;
}
