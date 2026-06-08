/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  enableGestureTransition,
  enableTransitionTracing,
  enableViewTransition,
} from "shared/ReactFeatureFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Thenable } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoLane } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isPrimaryRenderer } from "./ReactFiberConfig.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Cache, SpawnedCachePool } from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { CacheContext, createCache, retainCache } from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getWorkInProgressRoot,
  getWorkInProgressTransitions,
  markTransitionStarted,
} from "./ReactFiberWorkLoop.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  entangleAsyncTransitionTypes,
  entangledTransitionTypes,
  queueTransitionTypes,
  type TransitionTypes,
} from "./ReactFiberTransitionTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { entangleAsyncAction, peekEntangledActionLane } from "./ReactFiberAsyncAction.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { startAsyncTransitionTimer } from "./ReactProfilerTimer.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { firstScheduledRoot } from "./ReactFiberRootScheduler.js";

// @beginner: 定义 Transition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Transition = {
  name?: string | null;
  types?: TransitionTypes | null;
} | null;

// @beginner: 声明 NoTransition：保存当前步骤需要读取或更新的数据。
export const NoTransition: Transition = null;

// @beginner: 声明 prevOnStartTransitionFinish：保存当前步骤需要读取或更新的数据。
const prevOnStartTransitionFinish = ReactSharedInternals.S;
ReactSharedInternals.S = function onStartTransitionFinishForReconciler(
  transition: Transition,
  returnValue: unknown,
): void {
  markTransitionStarted();

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (
    typeof returnValue === "object" &&
    returnValue !== null &&
    typeof (returnValue as { then?: unknown }).then === "function"
  ) {
    // async action 返回 thenable 时，把同一时间窗口内的 transition update 纠缠到同一个 lane。
    startAsyncTransitionTimer();
    entangleAsyncAction(transition, returnValue as Thenable<unknown>);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableViewTransition) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (entangledTransitionTypes !== null) {
      // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
      let root = firstScheduledRoot;
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (root !== null) {
        queueTransitionTypes(root, entangledTransitionTypes);
        root = root.next;
      }
    }
    // @beginner: 声明 transitionTypes：保存当前步骤需要读取或更新的数据。
    const transitionTypes = transition?.types ?? null;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transitionTypes !== null) {
      // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
      let root = firstScheduledRoot;
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (root !== null) {
        queueTransitionTypes(root, transitionTypes);
        root = root.next;
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (peekEntangledActionLane() !== NoLane) {
        entangleAsyncTransitionTypes(transitionTypes);
      }
    }
  }

  prevOnStartTransitionFinish?.(transition, returnValue);
};

// @beginner: 条件分支：根据当前值选择不同处理路径。
if (enableGestureTransition) {
  // @beginner: 声明 prevOnStartGestureTransitionFinish：保存当前步骤需要读取或更新的数据。
  const prevOnStartGestureTransitionFinish = ReactSharedInternals.G;
  ReactSharedInternals.G = function onStartGestureTransitionFinishForReconciler(
    transition: Transition,
    provider: unknown,
    options: unknown,
  ): () => void {
    // @beginner: 声明 previousCancel：保存当前步骤需要读取或更新的数据。
    const previousCancel = prevOnStartGestureTransitionFinish?.(transition, provider, options);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return previousCancel ?? (() => {});
  };
}

// @beginner: 进入 requestCurrentTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function requestCurrentTransition(): Transition {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return ReactSharedInternals.T;
}

// @beginner: 声明 resumedCache：保存当前步骤需要读取或更新的数据。
const resumedCache: StackCursor<Cache | null> = createCursor(null);
// @beginner: 声明 transitionStack：保存当前步骤需要读取或更新的数据。
const transitionStack: StackCursor<Array<Transition> | null> = createCursor(null);

// @beginner: 进入 peekCacheFromPool：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function peekCacheFromPool(): Cache | null {
  // @beginner: 声明 cacheResumedFromPreviousRender：保存当前步骤需要读取或更新的数据。
  const cacheResumedFromPreviousRender = resumedCache.current;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cacheResumedFromPreviousRender !== null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return cacheResumedFromPreviousRender;
  }

  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = getWorkInProgressRoot() as (FiberRoot & { pooledCache?: Cache | null }) | null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return root?.pooledCache ?? null;
}

// @beginner: 进入 requestCacheFromPool：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function requestCacheFromPool(renderLanes: Lanes): Cache {
  // @beginner: 声明 cacheFromPool：保存当前步骤需要读取或更新的数据。
  const cacheFromPool = peekCacheFromPool();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cacheFromPool !== null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return cacheFromPool;
  }

  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = getWorkInProgressRoot() as (FiberRoot & {
    pooledCache?: Cache | null;
    pooledCacheLanes?: Lanes;
  }) | null;
  // @beginner: 声明 freshCache：保存当前步骤需要读取或更新的数据。
  const freshCache = createCache();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (root !== null) {
    root.pooledCache = freshCache;
    root.pooledCacheLanes = (root.pooledCacheLanes ?? 0) | renderLanes;
  }
  retainCache(freshCache);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return freshCache;
}

// @beginner: 进入 pushRootTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushRootTransition(workInProgress: Fiber, _root: FiberRoot, _renderLanes: Lanes): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableTransitionTracing) {
    push(transitionStack, getWorkInProgressTransitions() as Array<Transition> | null, workInProgress);
  }
}

// @beginner: 进入 popRootTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popRootTransition(workInProgress: Fiber, _root: FiberRoot, _renderLanes: Lanes): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableTransitionTracing) {
    pop(transitionStack, workInProgress);
  }
}

// @beginner: 进入 pushTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushTransition(
  offscreenWorkInProgress: Fiber,
  prevCachePool: SpawnedCachePool | null,
  newTransitions: Array<Transition> | null,
): void {
  push(resumedCache, prevCachePool === null ? resumedCache.current : prevCachePool.pool, offscreenWorkInProgress);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableTransitionTracing) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transitionStack.current === null) {
      push(transitionStack, newTransitions, offscreenWorkInProgress);
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (newTransitions === null) {
      push(transitionStack, transitionStack.current, offscreenWorkInProgress);
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      push(transitionStack, transitionStack.current.concat(newTransitions), offscreenWorkInProgress);
    }
  }
}

// @beginner: 进入 popTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popTransition(workInProgress: Fiber, current: Fiber | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (enableTransitionTracing) {
      pop(transitionStack, workInProgress);
    }
    pop(resumedCache, workInProgress);
  }
}

// @beginner: 进入 getPendingTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getPendingTransitions(): Array<Transition> | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return enableTransitionTracing ? transitionStack.current : null;
}

// @beginner: 进入 getSuspendedCache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSuspendedCache(): SpawnedCachePool | null {
  // @beginner: 声明 cacheFromPool：保存当前步骤需要读取或更新的数据。
  const cacheFromPool = peekCacheFromPool();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cacheFromPool === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    parent: isPrimaryRenderer ? CacheContext._currentValue : CacheContext._currentValue2,
    pool: cacheFromPool,
  };
}

// @beginner: 进入 getOffscreenDeferredCache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getOffscreenDeferredCache(): SpawnedCachePool | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getSuspendedCache();
}
