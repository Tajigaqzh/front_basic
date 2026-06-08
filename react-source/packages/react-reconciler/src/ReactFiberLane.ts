export type Lane = number;
export type Lanes = number;

export const NoLane = 0b0000;
export const NoLanes = 0b0000;
export const SyncLane = 0b0001;
export const DefaultLane = 0b0010;
export const TransitionLane = 0b0100;
export const TransitionLane2 = 0b1000;
export const TransitionLanes = TransitionLane | TransitionLane2;
export const RetryLane = 0b1_0000;
export const OffscreenLane = 0b10_0000;

export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

export function includesSomeLane(a: Lanes, b: Lanes): boolean {
  return (a & b) !== NoLanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  return (set & subset) === subset;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function getNextLanes(root: { pendingLanes: Lanes; entangledLanes?: Lanes }): Lanes {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane === NoLane) {
    return NoLanes;
  }

  const entangledLanes = root.entangledLanes ?? NoLanes;
  if (includesSomeLane(nextLane, entangledLanes)) {
    return mergeLanes(nextLane, root.pendingLanes & entangledLanes);
  }

  return nextLane;
}

export function includesSyncLane(lanes: Lanes): boolean {
  return includesSomeLane(lanes, SyncLane);
}

export function includesTransitionLane(lanes: Lanes): boolean {
  return includesSomeLane(lanes, TransitionLanes);
}

export function removeLanes(set: Lanes, subset: Lanes): Lanes {
  return set & ~subset;
}

export function intersectLanes(a: Lanes, b: Lanes): Lanes {
  return a & b;
}

export function isTransitionLane(lane: Lane): boolean {
  return includesSomeLane(lane, TransitionLanes);
}

export function getBumpedLaneForHydration(
  root: { suspendedLanes?: Lanes },
  renderLanes: Lanes,
): Lane {
  const renderLane = getHighestPriorityLane(removeLanes(renderLanes, OffscreenLane));
  const bumpedLane = getBumpedLaneForHydrationByLane(renderLane);
  const suspendedLanes = root.suspendedLanes ?? NoLanes;

  if (bumpedLane === NoLane || includesSomeLane(bumpedLane, renderLanes | suspendedLanes)) {
    return NoLane;
  }

  return bumpedLane;
}

export function getBumpedLaneForHydrationByLane(lane: Lane): Lane {
  switch (lane) {
    case SyncLane:
      return DefaultLane;
    case DefaultLane:
    case TransitionLane:
    case TransitionLane2:
      return RetryLane;
    default:
      return NoLane;
  }
}
