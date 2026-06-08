/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  enableGestureTransition,
  enableTransitionTracing,
  enableViewTransition,
} from "shared/ReactFeatureFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import noop from "shared/noop.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import reportGlobalError from "shared/reportGlobalError.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TransitionTypes } from "./ReactTransitionType.js";

// @beginner: 定义 StartTransitionOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface StartTransitionOptions {
  name?: string;
}

// @beginner: 定义 Transition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Transition = {
  types?: null | TransitionTypes;
  gesture?: null | unknown;
  name?: null | string;
  startTime?: number;
  _updatedFibers?: Set<unknown>;
};

// @beginner: 定义 ThenableLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ThenableLike = {
  then(onFulfill: () => void, onReject: (error: unknown) => void): unknown;
};

// @beginner: 进入 isThenable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isThenable(value: unknown): value is ThenableLike {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

// @beginner: 进入 releaseAsyncTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function releaseAsyncTransition(): void {
  ReactSharedInternals.asyncTransitions -= 1;
}

// @beginner: 进入 warnAboutTransitionSubscriptions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function warnAboutTransitionSubscriptions(
  prevTransition: Transition | null,
  currentTransition: Transition,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prevTransition === null && currentTransition._updatedFibers !== undefined) {
    // @beginner: 声明 updatedFibersCount：保存当前步骤需要读取或更新的数据。
    const updatedFibersCount = currentTransition._updatedFibers.size;
    currentTransition._updatedFibers.clear();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (updatedFibersCount > 10) {
      console.warn(
        "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.",
      );
    }
  }
}

// @beginner: 进入 startTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startTransition(scope: () => unknown, options?: StartTransitionOptions): void {
  // @beginner: 声明 prevTransition：保存当前步骤需要读取或更新的数据。
  const prevTransition = ReactSharedInternals.T as Transition | null;
  // @beginner: 声明 currentTransition：保存当前步骤需要读取或更新的数据。
  const currentTransition: Transition = {};

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableViewTransition) {
    currentTransition.types = prevTransition !== null ? prevTransition.types ?? null : null;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableGestureTransition) {
    currentTransition.gesture = null;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableTransitionTracing) {
    currentTransition.name = options?.name ?? null;
    currentTransition.startTime = -1;
  }
  currentTransition._updatedFibers = new Set();
  ReactSharedInternals.T = currentTransition;

  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 returnValue：保存当前步骤需要读取或更新的数据。
    const returnValue = scope();
    ReactSharedInternals.S?.(currentTransition, returnValue);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (isThenable(returnValue)) {
      ReactSharedInternals.asyncTransitions += 1;
      returnValue.then(releaseAsyncTransition, releaseAsyncTransition);
      returnValue.then(noop, reportGlobalError);
    }
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    reportGlobalError(error);
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    warnAboutTransitionSubscriptions(prevTransition, currentTransition);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (prevTransition !== null && currentTransition.types !== null && currentTransition.types !== undefined) {
      prevTransition.types = currentTransition.types;
    }
    ReactSharedInternals.T = prevTransition;
  }
}
