/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
  timeoutForPriority,
  type PriorityLevel,
} from "../SchedulerPriorities.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { peek, pop, push, type HeapNode } from "../SchedulerMinHeap.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as Profiling from "../SchedulerProfiling.js";

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
};

// @beginner: 定义 Callback：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Callback = (didTimeout?: boolean) => Callback | void | null;

// @beginner: 定义 Task：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Task extends HeapNode {
  callback: Callback;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  isCanceled: boolean;
}

// @beginner: 声明 taskQueue：保存当前步骤需要读取或更新的数据。
const taskQueue: Task[] = [];
// @beginner: 声明 yieldedValues：保存当前步骤需要读取或更新的数据。
const yieldedValues: unknown[] = [];
// @beginner: 声明 currentMockTime：保存当前步骤需要读取或更新的数据。
let currentMockTime = 0;
// @beginner: 声明 taskIdCounter：保存当前步骤需要读取或更新的数据。
let taskIdCounter = 1;
// @beginner: 声明 currentPriorityLevel：保存当前步骤需要读取或更新的数据。
let currentPriorityLevel: PriorityLevel = NormalPriority;
// @beginner: 声明 disableYieldValue：保存当前步骤需要读取或更新的数据。
let disableYieldValue = false;
// @beginner: 声明 needsPaint：保存当前步骤需要读取或更新的数据。
let needsPaint = false;

// @beginner: 进入 unstable_now：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_now(): number {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentMockTime;
}

// @beginner: 进入 unstable_scheduleCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_scheduleCallback(
  priorityLevel: PriorityLevel = NormalPriority,
  callback: Callback,
  options?: { delay?: number },
): Task {
  // @beginner: 声明 startTime：保存当前步骤需要读取或更新的数据。
  const startTime = currentMockTime + (options?.delay ?? 0);
  // @beginner: 声明 expirationTime：保存当前步骤需要读取或更新的数据。
  const expirationTime = startTime + timeoutForPriority(priorityLevel);
  // @beginner: 声明 task：保存当前步骤需要读取或更新的数据。
  const task: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: expirationTime,
    isCanceled: false,
  };
  push(taskQueue, task);
  Profiling.markTaskStart(task, currentMockTime);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return task;
}

// @beginner: 进入 unstable_cancelCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_cancelCallback(task: Task): void {
  task.isCanceled = true;
  task.callback = () => null;
  Profiling.markTaskCanceled(task, currentMockTime);
}

// @beginner: 进入 flushOneTask：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function flushOneTask(): boolean {
  // @beginner: 声明 task：保存当前步骤需要读取或更新的数据。
  const task = peek(taskQueue);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (task === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  pop(taskQueue);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (task.isCanceled) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 声明 previousPriorityLevel：保存当前步骤需要读取或更新的数据。
  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = task.priorityLevel;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    Profiling.markTaskRun(task, currentMockTime);
    // @beginner: 声明 continuation：保存当前步骤需要读取或更新的数据。
    let continuation = task.callback(task.expirationTime <= currentMockTime);
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (typeof continuation === "function") {
      continuation = continuation(false);
    }
    Profiling.markTaskCompleted(task, currentMockTime);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    Profiling.markTaskErrored(task, currentMockTime);
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw error;
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 unstable_flushAllWithoutAsserting：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_flushAllWithoutAsserting(): boolean {
  // @beginner: 声明 didFlush：保存当前步骤需要读取或更新的数据。
  let didFlush = false;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (flushOneTask()) {
    didFlush = true;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return didFlush;
}

// @beginner: 进入 unstable_flushAll：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_flushAll(): void {
  unstable_flushAllWithoutAsserting();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (yieldedValues.length > 0) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Log is not empty. Call unstable_clearLog() first.");
  }
}

// @beginner: 进入 unstable_flushNumberOfYields：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_flushNumberOfYields(count: number): unknown[] {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (yieldedValues.length < count && flushOneTask()) {}
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return unstable_clearLog();
}

// @beginner: 进入 unstable_flushExpired：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_flushExpired(): void {
  // @beginner: 声明 task：保存当前步骤需要读取或更新的数据。
  let task = peek(taskQueue);
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (task !== null && task.expirationTime <= currentMockTime) {
    flushOneTask();
    task = peek(taskQueue);
  }
}

// @beginner: 进入 unstable_flushUntilNextPaint：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_flushUntilNextPaint(): unknown[] {
  needsPaint = false;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (!needsPaint && flushOneTask()) {}
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return unstable_clearLog();
}

// @beginner: 进入 unstable_hasPendingWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_hasPendingWork(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return peek(taskQueue) !== null;
}

// @beginner: 进入 log：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function log(value: unknown): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!disableYieldValue) {
    yieldedValues.push(value);
  }
}

// @beginner: 进入 unstable_clearLog：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_clearLog(): unknown[] {
  // @beginner: 声明 values：保存当前步骤需要读取或更新的数据。
  const values = yieldedValues.slice();
  yieldedValues.length = 0;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return values;
}

// @beginner: 进入 unstable_advanceTime：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_advanceTime(ms: number): void {
  currentMockTime += ms;
}

// @beginner: 进入 reset：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reset(): void {
  taskQueue.length = 0;
  yieldedValues.length = 0;
  currentMockTime = 0;
  taskIdCounter = 1;
  currentPriorityLevel = NormalPriority;
  needsPaint = false;
}

// @beginner: 进入 unstable_setDisableYieldValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_setDisableYieldValue(newValue: boolean): void {
  disableYieldValue = newValue;
}

// @beginner: 进入 unstable_shouldYield：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_shouldYield(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return needsPaint;
}

// @beginner: 进入 unstable_requestPaint：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_requestPaint(): void {
  needsPaint = true;
}

// @beginner: 进入 unstable_getCurrentPriorityLevel：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_getCurrentPriorityLevel(): PriorityLevel {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentPriorityLevel;
}

// @beginner: 进入 unstable_runWithPriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_runWithPriority<T>(priorityLevel: PriorityLevel, callback: () => T): T {
  // @beginner: 声明 previousPriorityLevel：保存当前步骤需要读取或更新的数据。
  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return callback();
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

// @beginner: 进入 unstable_next：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_next<T>(callback: () => T): T {
  // @beginner: 声明 priorityLevel：保存当前步骤需要读取或更新的数据。
  const priorityLevel =
    currentPriorityLevel === ImmediatePriority ||
    currentPriorityLevel === UserBlockingPriority ||
    currentPriorityLevel === NormalPriority
      ? NormalPriority
      : currentPriorityLevel;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return unstable_runWithPriority(priorityLevel, callback);
}

// @beginner: 进入 unstable_wrapCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_wrapCallback<T>(callback: () => T): () => T {
  // @beginner: 声明 parentPriorityLevel：保存当前步骤需要读取或更新的数据。
  const parentPriorityLevel = currentPriorityLevel;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => unstable_runWithPriority(parentPriorityLevel, callback);
}

// @beginner: 进入 unstable_forceFrameRate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_forceFrameRate(_fps?: number): void {}

// @beginner: 声明 unstable_Profiling：保存当前步骤需要读取或更新的数据。
export const unstable_Profiling = Profiling;
