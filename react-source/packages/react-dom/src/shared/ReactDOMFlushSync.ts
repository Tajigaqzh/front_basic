/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { disableLegacyMode } from "shared/ReactFeatureFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DiscreteEventPriority } from "react-reconciler/src/ReactEventPriorities.js";

// @beginner: 进入 flushSyncImpl：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function flushSyncImpl<R>(fn?: () => R): R | undefined {
  // @beginner: 声明 previousTransition：保存当前步骤需要读取或更新的数据。
  const previousTransition = ReactSharedInternals.T;
  // @beginner: 声明 previousUpdatePriority：保存当前步骤需要读取或更新的数据。
  const previousUpdatePriority = ReactDOMSharedInternals.p;

  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // flushSync 内部的更新必须按离散事件优先级处理，并且不能继承外层 transition。
    ReactSharedInternals.T = null;
    ReactDOMSharedInternals.p = DiscreteEventPriority;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fn ? fn() : undefined;
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    ReactSharedInternals.T = previousTransition;
    ReactDOMSharedInternals.p = previousUpdatePriority;
    ReactDOMSharedInternals.d.f();
  }
}

// @beginner: 进入 flushSyncErrorInBuildsThatSupportLegacyMode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function flushSyncErrorInBuildsThatSupportLegacyMode(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Expected this build of React to not support legacy mode but it does. This is a bug in React.");
}

// @beginner: 声明 flushSync：保存当前步骤需要读取或更新的数据。
export const flushSync: typeof flushSyncImpl = disableLegacyMode
  ? flushSyncImpl
  : flushSyncErrorInBuildsThatSupportLegacyMode;
