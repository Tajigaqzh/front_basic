function shim(): never {
  throw new Error(
    "The current renderer does not support view transitions. This error is likely caused by a bug in React.",
  );
}

export const applyViewTransitionName = shim;
export const restoreViewTransitionName = shim;
export const cancelViewTransitionName = shim;
export const cancelRootViewTransitionName = shim;
export const restoreRootViewTransitionName = shim;
export const cloneRootViewTransitionContainer = shim;
export const removeRootViewTransitionClone = shim;

export type InstanceMeasurement = unknown;
export const measureInstance = shim;
export const measureClonedInstance = shim;
export const wasInstanceInViewport = shim;
export const hasInstanceChanged = shim;
export const hasInstanceAffectedParent = shim;

export type RunningViewTransition = unknown;
export const startViewTransition = shim;
export const startGestureTransition = shim;
export const stopViewTransition = shim;
export const addViewTransitionFinishedListener = shim;

export type ViewTransitionInstance = unknown;
export const createViewTransitionInstance = shim;
