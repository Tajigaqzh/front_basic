import type { ReactNode, Wakeable } from "shared";
import type { Lanes } from "./ReactFiberLane.js";
import type { SpawnedCachePool } from "./ReactFiberCacheComponent.js";
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";

export type OffscreenMode = "hidden" | "unstable-defer-without-hiding" | "visible";

export interface LegacyHiddenProps {
  mode?: OffscreenMode | null;
  children?: ReactNode;
}

export interface OffscreenProps {
  mode?: OffscreenMode | null;
  children?: ReactNode;
}

export interface OffscreenState {
  baseLanes: Lanes;
  cachePool: SpawnedCachePool | null;
}

export interface OffscreenQueue {
  transitions: unknown[] | null;
  markerInstances: unknown[] | null;
  retryQueue: RetryQueue | null;
}

export type OffscreenVisibility = number;

export const OffscreenVisible = 0b001;
export const OffscreenPassiveEffectsConnected = 0b010;

export interface OffscreenInstance {
  _visibility: OffscreenVisibility;
  _pendingMarkers: Set<unknown> | null;
  _transitions: Set<unknown> | null;
  _retryCache: WeakSet<Wakeable> | Set<Wakeable> | null;
}

export function createOffscreenInstance(visible = true): OffscreenInstance {
  return {
    _visibility: visible ? OffscreenVisible : 0,
    _pendingMarkers: null,
    _transitions: null,
    _retryCache: null,
  };
}

export function isOffscreenVisible(instance: OffscreenInstance): boolean {
  return (instance._visibility & OffscreenVisible) !== 0;
}
