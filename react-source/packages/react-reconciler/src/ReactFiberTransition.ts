import ReactSharedInternals from "shared/ReactSharedInternals.js";
import {
  enableGestureTransition,
  enableTransitionTracing,
  enableViewTransition,
} from "shared/ReactFeatureFlags.js";
import type { Thenable } from "shared";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import { NoLane } from "./ReactFiberLane.js";
import type { StackCursor } from "./ReactFiberStack.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";
import { isPrimaryRenderer } from "./ReactFiberConfig.js";
import type { Cache, SpawnedCachePool } from "./ReactFiberCacheComponent.js";
import { CacheContext, createCache, retainCache } from "./ReactFiberCacheComponent.js";
import {
  getWorkInProgressRoot,
  getWorkInProgressTransitions,
  markTransitionStarted,
} from "./ReactFiberWorkLoop.js";
import {
  entangleAsyncTransitionTypes,
  entangledTransitionTypes,
  queueTransitionTypes,
  type TransitionTypes,
} from "./ReactFiberTransitionTypes.js";
import { entangleAsyncAction, peekEntangledActionLane } from "./ReactFiberAsyncAction.js";
import { startAsyncTransitionTimer } from "./ReactProfilerTimer.js";
import { firstScheduledRoot } from "./ReactFiberRootScheduler.js";

export type Transition = {
  name?: string | null;
  types?: TransitionTypes | null;
} | null;

export const NoTransition: Transition = null;

const prevOnStartTransitionFinish = ReactSharedInternals.S;
ReactSharedInternals.S = function onStartTransitionFinishForReconciler(
  transition: Transition,
  returnValue: unknown,
): void {
  markTransitionStarted();

  if (
    typeof returnValue === "object" &&
    returnValue !== null &&
    typeof (returnValue as { then?: unknown }).then === "function"
  ) {
    // async action 返回 thenable 时，把同一时间窗口内的 transition update 纠缠到同一个 lane。
    startAsyncTransitionTimer();
    entangleAsyncAction(transition, returnValue as Thenable<unknown>);
  }

  if (enableViewTransition) {
    if (entangledTransitionTypes !== null) {
      let root = firstScheduledRoot;
      while (root !== null) {
        queueTransitionTypes(root, entangledTransitionTypes);
        root = root.next;
      }
    }
    const transitionTypes = transition?.types ?? null;
    if (transitionTypes !== null) {
      let root = firstScheduledRoot;
      while (root !== null) {
        queueTransitionTypes(root, transitionTypes);
        root = root.next;
      }
      if (peekEntangledActionLane() !== NoLane) {
        entangleAsyncTransitionTypes(transitionTypes);
      }
    }
  }

  prevOnStartTransitionFinish?.(transition, returnValue);
};

if (enableGestureTransition) {
  const prevOnStartGestureTransitionFinish = ReactSharedInternals.G;
  ReactSharedInternals.G = function onStartGestureTransitionFinishForReconciler(
    transition: Transition,
    provider: unknown,
    options: unknown,
  ): () => void {
    const previousCancel = prevOnStartGestureTransitionFinish?.(transition, provider, options);
    return previousCancel ?? (() => {});
  };
}

export function requestCurrentTransition(): Transition {
  return ReactSharedInternals.T;
}

const resumedCache: StackCursor<Cache | null> = createCursor(null);
const transitionStack: StackCursor<Array<Transition> | null> = createCursor(null);

function peekCacheFromPool(): Cache | null {
  const cacheResumedFromPreviousRender = resumedCache.current;
  if (cacheResumedFromPreviousRender !== null) {
    return cacheResumedFromPreviousRender;
  }

  const root = getWorkInProgressRoot() as (FiberRoot & { pooledCache?: Cache | null }) | null;
  return root?.pooledCache ?? null;
}

export function requestCacheFromPool(renderLanes: Lanes): Cache {
  const cacheFromPool = peekCacheFromPool();
  if (cacheFromPool !== null) {
    return cacheFromPool;
  }

  const root = getWorkInProgressRoot() as (FiberRoot & {
    pooledCache?: Cache | null;
    pooledCacheLanes?: Lanes;
  }) | null;
  const freshCache = createCache();
  if (root !== null) {
    root.pooledCache = freshCache;
    root.pooledCacheLanes = (root.pooledCacheLanes ?? 0) | renderLanes;
  }
  retainCache(freshCache);
  return freshCache;
}

export function pushRootTransition(workInProgress: Fiber, _root: FiberRoot, _renderLanes: Lanes): void {
  if (enableTransitionTracing) {
    push(transitionStack, getWorkInProgressTransitions() as Array<Transition> | null, workInProgress);
  }
}

export function popRootTransition(workInProgress: Fiber, _root: FiberRoot, _renderLanes: Lanes): void {
  if (enableTransitionTracing) {
    pop(transitionStack, workInProgress);
  }
}

export function pushTransition(
  offscreenWorkInProgress: Fiber,
  prevCachePool: SpawnedCachePool | null,
  newTransitions: Array<Transition> | null,
): void {
  push(resumedCache, prevCachePool === null ? resumedCache.current : prevCachePool.pool, offscreenWorkInProgress);

  if (enableTransitionTracing) {
    if (transitionStack.current === null) {
      push(transitionStack, newTransitions, offscreenWorkInProgress);
    } else if (newTransitions === null) {
      push(transitionStack, transitionStack.current, offscreenWorkInProgress);
    } else {
      push(transitionStack, transitionStack.current.concat(newTransitions), offscreenWorkInProgress);
    }
  }
}

export function popTransition(workInProgress: Fiber, current: Fiber | null): void {
  if (current !== null) {
    if (enableTransitionTracing) {
      pop(transitionStack, workInProgress);
    }
    pop(resumedCache, workInProgress);
  }
}

export function getPendingTransitions(): Array<Transition> | null {
  return enableTransitionTracing ? transitionStack.current : null;
}

export function getSuspendedCache(): SpawnedCachePool | null {
  const cacheFromPool = peekCacheFromPool();
  if (cacheFromPool === null) {
    return null;
  }
  return {
    parent: isPrimaryRenderer ? CacheContext._currentValue : CacheContext._currentValue2,
    pool: cacheFromPool,
  };
}

export function getOffscreenDeferredCache(): SpawnedCachePool | null {
  return getSuspendedCache();
}
