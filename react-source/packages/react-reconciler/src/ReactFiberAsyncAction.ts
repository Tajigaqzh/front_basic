/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Thenable } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import noop from "shared/noop.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import reportGlobalError from "shared/reportGlobalError.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  enableComponentPerformanceTrack,
  enableDefaultTransitionIndicator,
  enableProfilerTimer,
} from "shared/ReactFeatureFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoLane } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ensureScheduleIsScheduled,
  requestTransitionLane,
} from "./ReactFiberRootScheduler.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  clearAsyncTransitionTimer,
  hasScheduledTransitionWork,
} from "./ReactProfilerTimer.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { clearEntangledAsyncTransitionTypes } from "./ReactFiberTransitionTypes.js";

// @beginner: 定义 Transition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Transition = { name?: string | null; types?: string[] | null } | null;
// @beginner: 定义 Listener：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Listener = () => void;

// @beginner: 声明 currentEntangledListeners：保存当前步骤需要读取或更新的数据。
let currentEntangledListeners: Listener[] | null = null;
// @beginner: 声明 currentEntangledPendingCount：保存当前步骤需要读取或更新的数据。
let currentEntangledPendingCount = 0;
// @beginner: 声明 currentEntangledLane：保存当前步骤需要读取或更新的数据。
let currentEntangledLane: Lane = NoLane;
// @beginner: 声明 currentEntangledActionThenable：保存当前步骤需要读取或更新的数据。
let currentEntangledActionThenable: Thenable<void> | null = null;

// @beginner: 声明 isomorphicDefaultTransitionIndicator：保存当前步骤需要读取或更新的数据。
let isomorphicDefaultTransitionIndicator: undefined | null | (() => void | (() => void)) = undefined;
// @beginner: 声明 pendingIsomorphicIndicator：保存当前步骤需要读取或更新的数据。
let pendingIsomorphicIndicator: null | (() => void) = null;
// @beginner: 声明 pendingEntangledRoots：保存当前步骤需要读取或更新的数据。
let pendingEntangledRoots = 0;
// @beginner: 声明 needsIsomorphicIndicator：保存当前步骤需要读取或更新的数据。
let needsIsomorphicIndicator = false;

// @beginner: 进入 entangleAsyncAction：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function entangleAsyncAction<S>(transition: Transition, thenable: Thenable<S>): Thenable<S> {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentEntangledListeners === null) {
    // @beginner: 声明 entangledListeners：保存当前步骤需要读取或更新的数据。
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

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (enableDefaultTransitionIndicator) {
      needsIsomorphicIndicator = true;
      ensureScheduleIsScheduled();
    }
  }

  currentEntangledPendingCount += 1;
  thenable.then(pingEntangledActionScope, pingEntangledActionScope);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thenable;
}

// @beginner: 进入 pingEntangledActionScope：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pingEntangledActionScope(): void {
  currentEntangledPendingCount -= 1;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentEntangledPendingCount !== 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfilerTimer && enableComponentPerformanceTrack && !hasScheduledTransitionWork()) {
    clearAsyncTransitionTimer();
  }

  clearEntangledAsyncTransitionTypes();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingEntangledRoots === 0) {
    stopIsomorphicDefaultIndicator();
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentEntangledListeners !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (currentEntangledActionThenable !== null) {
      currentEntangledActionThenable.status = "fulfilled";
    }
    // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
    const listeners = currentEntangledListeners;
    currentEntangledListeners = null;
    currentEntangledLane = NoLane;
    currentEntangledActionThenable = null;
    needsIsomorphicIndicator = false;
    listeners.forEach((listener) => listener());
  }
}

// @beginner: 进入 chainThenableValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function chainThenableValue<T>(thenable: Thenable<T>, result: T): Thenable<T> {
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners: Array<(value: T) => void> = [];
  // @beginner: 声明 thenableWithOverride：保存当前步骤需要读取或更新的数据。
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

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thenableWithOverride;
}

// @beginner: 进入 peekEntangledActionLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function peekEntangledActionLane(): Lane {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentEntangledLane;
}

// @beginner: 进入 peekEntangledActionThenable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function peekEntangledActionThenable(): Thenable<void> | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentEntangledActionThenable;
}

// @beginner: 进入 registerDefaultIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerDefaultIndicator(onDefaultTransitionIndicator: () => void | (() => void)): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableDefaultTransitionIndicator) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isomorphicDefaultTransitionIndicator === undefined) {
    isomorphicDefaultTransitionIndicator = onDefaultTransitionIndicator;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (isomorphicDefaultTransitionIndicator !== onDefaultTransitionIndicator) {
    isomorphicDefaultTransitionIndicator = null;
    stopIsomorphicDefaultIndicator();
  }
}

// @beginner: 进入 startIsomorphicDefaultIndicatorIfNeeded：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startIsomorphicDefaultIndicatorIfNeeded(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableDefaultTransitionIndicator || !needsIsomorphicIndicator) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isomorphicDefaultTransitionIndicator !== null && pendingIsomorphicIndicator === null) {
    // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
    try {
      pendingIsomorphicIndicator = isomorphicDefaultTransitionIndicator?.() || noop;
    // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
    } catch (error) {
      pendingIsomorphicIndicator = noop;
      reportGlobalError(error);
    }
  }
}

// @beginner: 进入 stopIsomorphicDefaultIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function stopIsomorphicDefaultIndicator(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableDefaultTransitionIndicator) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingIsomorphicIndicator !== null) {
    // @beginner: 声明 cleanup：保存当前步骤需要读取或更新的数据。
    const cleanup = pendingIsomorphicIndicator;
    pendingIsomorphicIndicator = null;
    cleanup();
  }
}

// @beginner: 进入 releaseIsomorphicIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function releaseIsomorphicIndicator(): void {
  pendingEntangledRoots -= 1;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingEntangledRoots === 0) {
    stopIsomorphicDefaultIndicator();
  }
}

// @beginner: 进入 hasOngoingIsomorphicIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hasOngoingIsomorphicIndicator(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return pendingIsomorphicIndicator !== null;
}

// @beginner: 进入 retainIsomorphicIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function retainIsomorphicIndicator(): () => void {
  pendingEntangledRoots += 1;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return releaseIsomorphicIndicator;
}

// @beginner: 进入 markIsomorphicIndicatorHandled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markIsomorphicIndicatorHandled(): void {
  needsIsomorphicIndicator = false;
}
