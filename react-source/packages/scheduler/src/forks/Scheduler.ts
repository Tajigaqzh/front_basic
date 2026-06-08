/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { peek, pop, push, type HeapNode } from "../SchedulerMinHeap.js";
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
import { frameYieldMs } from "../SchedulerFeatureFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as Profiling from "../SchedulerProfiling.js";

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
// @beginner: 声明 taskIdCounter：保存当前步骤需要读取或更新的数据。
let taskIdCounter = 1;
// @beginner: 声明 isHostCallbackScheduled：保存当前步骤需要读取或更新的数据。
let isHostCallbackScheduled = false;
// @beginner: 声明 currentPriorityLevel：保存当前步骤需要读取或更新的数据。
let currentPriorityLevel: PriorityLevel = NormalPriority;
// @beginner: 声明 deadline：保存当前步骤需要读取或更新的数据。
let deadline = 0;
// @beginner: 声明 needsPaint：保存当前步骤需要读取或更新的数据。
let needsPaint = false;

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
};

// @beginner: 进入 unstable_now：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_now(): number {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return performance.now();
}

// @beginner: 进入 unstable_scheduleCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_scheduleCallback(
  priorityLevel: PriorityLevel = NormalPriority,
  callback: Callback,
): Task {
  // @beginner: 声明 currentTime：保存当前步骤需要读取或更新的数据。
  const currentTime = unstable_now();
  // @beginner: 声明 timeout：保存当前步骤需要读取或更新的数据。
  const timeout = timeoutForPriority(priorityLevel);
  // @beginner: 声明 expirationTime：保存当前步骤需要读取或更新的数据。
  const expirationTime = currentTime + timeout;
  // @beginner: 声明 newTask：保存当前步骤需要读取或更新的数据。
  const newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime: currentTime,
    expirationTime,
    sortIndex: expirationTime,
    isCanceled: false,
  };

  push(taskQueue, newTask);
  Profiling.markTaskStart(newTask, currentTime);
  requestHostCallback();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return newTask;
}

// @beginner: 进入 unstable_cancelCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_cancelCallback(task: Task): void {
  task.isCanceled = true;
  task.callback = () => null;
  Profiling.markTaskCanceled(task, unstable_now());
}

// @beginner: 进入 unstable_shouldYield：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_shouldYield(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return needsPaint || unstable_now() >= deadline;
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

// @beginner: 进入 requestHostCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function requestHostCallback(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isHostCallbackScheduled) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  isHostCallbackScheduled = true;
  queueMicrotask(flushWork);
}

// @beginner: 进入 flushWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function flushWork(): void {
  isHostCallbackScheduled = false;
  needsPaint = false;
  deadline = unstable_now() + frameYieldMs;
  // @beginner: 声明 currentTask：保存当前步骤需要读取或更新的数据。
  let currentTask = peek(taskQueue);

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (currentTask !== null) {
    pop(taskQueue);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!currentTask.isCanceled) {
      // @beginner: 声明 previousPriorityLevel：保存当前步骤需要读取或更新的数据。
      const previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = currentTask.priorityLevel;
      Profiling.markTaskRun(currentTask, unstable_now());
      // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
      try {
        // @beginner: 声明 continuation：保存当前步骤需要读取或更新的数据。
        let continuation = currentTask.callback(currentTask.expirationTime <= unstable_now());
        // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
        while (typeof continuation === "function") {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (unstable_shouldYield()) {
            currentTask.callback = continuation;
            currentTask.sortIndex = currentTask.expirationTime;
            push(taskQueue, currentTask);
            Profiling.markTaskYield(currentTask, unstable_now());
            requestHostCallback();
            // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
            return;
          }
          continuation = continuation(false);
        }
        Profiling.markTaskCompleted(currentTask, unstable_now());
      // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
      } catch (error) {
        Profiling.markTaskErrored(currentTask, unstable_now());
        // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
        throw error;
      // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    }
    currentTask = peek(taskQueue);
  }
}

// @beginner: 声明 unstable_Profiling：保存当前步骤需要读取或更新的数据。
export const unstable_Profiling = Profiling;
