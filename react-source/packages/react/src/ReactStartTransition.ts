import {
  enableGestureTransition,
  enableTransitionTracing,
  enableViewTransition,
} from "shared/ReactFeatureFlags.js";
import ReactSharedInternals from "shared/ReactSharedInternals.js";
import noop from "shared/noop.js";
import reportGlobalError from "shared/reportGlobalError.js";
import type { TransitionTypes } from "./ReactTransitionType.js";

export interface StartTransitionOptions {
  name?: string;
}

export type Transition = {
  types?: null | TransitionTypes;
  gesture?: null | unknown;
  name?: null | string;
  startTime?: number;
  _updatedFibers?: Set<unknown>;
};

type ThenableLike = {
  then(onFulfill: () => void, onReject: (error: unknown) => void): unknown;
};

function isThenable(value: unknown): value is ThenableLike {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function releaseAsyncTransition(): void {
  ReactSharedInternals.asyncTransitions -= 1;
}

function warnAboutTransitionSubscriptions(
  prevTransition: Transition | null,
  currentTransition: Transition,
): void {
  if (prevTransition === null && currentTransition._updatedFibers !== undefined) {
    const updatedFibersCount = currentTransition._updatedFibers.size;
    currentTransition._updatedFibers.clear();
    if (updatedFibersCount > 10) {
      console.warn(
        "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.",
      );
    }
  }
}

export function startTransition(scope: () => unknown, options?: StartTransitionOptions): void {
  const prevTransition = ReactSharedInternals.T as Transition | null;
  const currentTransition: Transition = {};

  if (enableViewTransition) {
    currentTransition.types = prevTransition !== null ? prevTransition.types ?? null : null;
  }
  if (enableGestureTransition) {
    currentTransition.gesture = null;
  }
  if (enableTransitionTracing) {
    currentTransition.name = options?.name ?? null;
    currentTransition.startTime = -1;
  }
  currentTransition._updatedFibers = new Set();
  ReactSharedInternals.T = currentTransition;

  try {
    const returnValue = scope();
    ReactSharedInternals.S?.(currentTransition, returnValue);
    if (isThenable(returnValue)) {
      ReactSharedInternals.asyncTransitions += 1;
      returnValue.then(releaseAsyncTransition, releaseAsyncTransition);
      returnValue.then(noop, reportGlobalError);
    }
  } catch (error) {
    reportGlobalError(error);
  } finally {
    warnAboutTransitionSubscriptions(prevTransition, currentTransition);
    if (prevTransition !== null && currentTransition.types !== null && currentTransition.types !== undefined) {
      prevTransition.types = currentTransition.types;
    }
    ReactSharedInternals.T = prevTransition;
  }
}
