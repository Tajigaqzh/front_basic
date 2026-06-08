/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_IdlePriority,
  unstable_LowPriority,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_getCurrentPriorityLevel,
  unstable_shouldYield,
  unstable_requestPaint,
  unstable_now,
  type Callback,
  type Task,
} from "./Scheduler.js";

// @beginner: 进入 throwNotImplemented：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function throwNotImplemented(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Not implemented.");
}

// @beginner: 声明 unstable_next：保存当前步骤需要读取或更新的数据。
export const unstable_next = throwNotImplemented;
// @beginner: 声明 unstable_runWithPriority：保存当前步骤需要读取或更新的数据。
export const unstable_runWithPriority = throwNotImplemented;
// @beginner: 声明 unstable_wrapCallback：保存当前步骤需要读取或更新的数据。
export const unstable_wrapCallback = throwNotImplemented;
// @beginner: 声明 unstable_forceFrameRate：保存当前步骤需要读取或更新的数据。
export const unstable_forceFrameRate = throwNotImplemented;
// @beginner: 声明 unstable_Profiling：保存当前步骤需要读取或更新的数据。
export const unstable_Profiling = null;
