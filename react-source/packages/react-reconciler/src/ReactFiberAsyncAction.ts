import type { Thenable } from "shared";
import noop from "shared/noop.js";
import reportGlobalError from "shared/reportGlobalError.js";
import {
  enableComponentPerformanceTrack,
  enableDefaultTransitionIndicator,
  enableProfilerTimer,
} from "shared/ReactFeatureFlags.js";
import type { Lane } from "./ReactFiberLane.js";
import { NoLane } from "./ReactFiberLane.js";
import {
  ensureScheduleIsScheduled,
  requestTransitionLane,
} from "./ReactFiberRootScheduler.js";
import {
  clearAsyncTransitionTimer,
  hasScheduledTransitionWork,
} from "./ReactProfilerTimer.js";
import { clearEntangledAsyncTransitionTypes } from "./ReactFiberTransitionTypes.js";

type Transition = { name?: string | null; types?: string[] | null } | null;
type Listener = () => void;

let currentEntangledListeners: Listener[] | null = null;
let currentEntangledPendingCount = 0;
let currentEntangledLane: Lane = NoLane;
let currentEntangledActionThenable: Thenable<void> | null = null;

let isomorphicDefaultTransitionIndicator: undefined | null | (() => void | (() => void)) = undefined;
let pendingIsomorphicIndicator: null | (() => void) = null;
let pendingEntangledRoots = 0;
let needsIsomorphicIndicator = false;

export function entangleAsyncAction<S>(transition: Transition, thenable: Thenable<S>): Thenable<S> {
  if (currentEntangledListeners === null) {
    const entangledListeners: Listener[] = [];
    currentEntangledListeners = entangledListeners;
    currentEntangledPendingCount = 0;
    currentEntangledLane = requestTransitionLane(transition);
    currentEntangledActionThenable = {
      status: "pending",
      value: undefined,
      then(resolve: () => void) {
        entangledListeners.push(resolve);
      },
    };

    if (enableDefaultTransitionIndicator) {
      needsIsomorphicIndicator = true;
      ensureScheduleIsScheduled();
    }
  }

  currentEntangledPendingCount += 1;
  thenable.then(pingEntangledActionScope, pingEntangledActionScope);
  return thenable;
}

function pingEntangledActionScope(): void {
  currentEntangledPendingCount -= 1;
  if (currentEntangledPendingCount !== 0) {
    return;
  }

  if (enableProfilerTimer && enableComponentPerformanceTrack && !hasScheduledTransitionWork()) {
    clearAsyncTransitionTimer();
  }

  clearEntangledAsyncTransitionTypes();
  if (pendingEntangledRoots === 0) {
    stopIsomorphicDefaultIndicator();
  }

  if (currentEntangledListeners !== null) {
    if (currentEntangledActionThenable !== null) {
      currentEntangledActionThenable.status = "fulfilled";
    }
    const listeners = currentEntangledListeners;
    currentEntangledListeners = null;
    currentEntangledLane = NoLane;
    currentEntangledActionThenable = null;
    needsIsomorphicIndicator = false;
    listeners.forEach((listener) => listener());
  }
}

export function chainThenableValue<T>(thenable: Thenable<T>, result: T): Thenable<T> {
  const listeners: Array<(value: T) => void> = [];
  const thenableWithOverride: Thenable<T> = {
    status: "pending",
    value: undefined,
    reason: null,
    then(resolve: (value: T) => void) {
      listeners.push(resolve);
    },
  };

  thenable.then(
    () => {
      thenableWithOverride.status = "fulfilled";
      thenableWithOverride.value = result;
      listeners.forEach((listener) => listener(result));
    },
    (error) => {
      thenableWithOverride.status = "rejected";
      thenableWithOverride.reason = error;
      listeners.forEach((listener) => listener(undefined as T));
    },
  );

  return thenableWithOverride;
}

export function peekEntangledActionLane(): Lane {
  return currentEntangledLane;
}

export function peekEntangledActionThenable(): Thenable<void> | null {
  return currentEntangledActionThenable;
}

export function registerDefaultIndicator(onDefaultTransitionIndicator: () => void | (() => void)): void {
  if (!enableDefaultTransitionIndicator) {
    return;
  }
  if (isomorphicDefaultTransitionIndicator === undefined) {
    isomorphicDefaultTransitionIndicator = onDefaultTransitionIndicator;
  } else if (isomorphicDefaultTransitionIndicator !== onDefaultTransitionIndicator) {
    isomorphicDefaultTransitionIndicator = null;
    stopIsomorphicDefaultIndicator();
  }
}

export function startIsomorphicDefaultIndicatorIfNeeded(): void {
  if (!enableDefaultTransitionIndicator || !needsIsomorphicIndicator) {
    return;
  }
  if (isomorphicDefaultTransitionIndicator !== null && pendingIsomorphicIndicator === null) {
    try {
      pendingIsomorphicIndicator = isomorphicDefaultTransitionIndicator?.() || noop;
    } catch (error) {
      pendingIsomorphicIndicator = noop;
      reportGlobalError(error);
    }
  }
}

function stopIsomorphicDefaultIndicator(): void {
  if (!enableDefaultTransitionIndicator) {
    return;
  }
  if (pendingIsomorphicIndicator !== null) {
    const cleanup = pendingIsomorphicIndicator;
    pendingIsomorphicIndicator = null;
    cleanup();
  }
}

function releaseIsomorphicIndicator(): void {
  pendingEntangledRoots -= 1;
  if (pendingEntangledRoots === 0) {
    stopIsomorphicDefaultIndicator();
  }
}

export function hasOngoingIsomorphicIndicator(): boolean {
  return pendingIsomorphicIndicator !== null;
}

export function retainIsomorphicIndicator(): () => void {
  pendingEntangledRoots += 1;
  return releaseIsomorphicIndicator;
}

export function markIsomorphicIndicatorHandled(): void {
  needsIsomorphicIndicator = false;
}
