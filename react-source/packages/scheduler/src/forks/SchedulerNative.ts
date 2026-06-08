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

function throwNotImplemented(): never {
  throw new Error("Not implemented.");
}

export const unstable_next = throwNotImplemented;
export const unstable_runWithPriority = throwNotImplemented;
export const unstable_wrapCallback = throwNotImplemented;
export const unstable_forceFrameRate = throwNotImplemented;
export const unstable_Profiling = null;
