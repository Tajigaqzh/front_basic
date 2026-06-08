import { peek, pop, push, type HeapNode } from "../SchedulerMinHeap.js";
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
  timeoutForPriority,
  type PriorityLevel,
} from "../SchedulerPriorities.js";
import { frameYieldMs } from "../SchedulerFeatureFlags.js";
import * as Profiling from "../SchedulerProfiling.js";

export type Callback = (didTimeout?: boolean) => Callback | void | null;

export interface Task extends HeapNode {
  callback: Callback;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  isCanceled: boolean;
}

const taskQueue: Task[] = [];
let taskIdCounter = 1;
let isHostCallbackScheduled = false;
let currentPriorityLevel: PriorityLevel = NormalPriority;
let deadline = 0;
let needsPaint = false;

export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
};

export function unstable_now(): number {
  return performance.now();
}

export function unstable_scheduleCallback(
  priorityLevel: PriorityLevel = NormalPriority,
  callback: Callback,
): Task {
  const currentTime = unstable_now();
  const timeout = timeoutForPriority(priorityLevel);
  const expirationTime = currentTime + timeout;
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
  return newTask;
}

export function unstable_cancelCallback(task: Task): void {
  task.isCanceled = true;
  task.callback = () => null;
  Profiling.markTaskCanceled(task, unstable_now());
}

export function unstable_shouldYield(): boolean {
  return needsPaint || unstable_now() >= deadline;
}

export function unstable_requestPaint(): void {
  needsPaint = true;
}

export function unstable_getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

export function unstable_runWithPriority<T>(priorityLevel: PriorityLevel, callback: () => T): T {
  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    return callback();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

export function unstable_next<T>(callback: () => T): T {
  const priorityLevel =
    currentPriorityLevel === ImmediatePriority ||
    currentPriorityLevel === UserBlockingPriority ||
    currentPriorityLevel === NormalPriority
      ? NormalPriority
      : currentPriorityLevel;
  return unstable_runWithPriority(priorityLevel, callback);
}

export function unstable_wrapCallback<T>(callback: () => T): () => T {
  const parentPriorityLevel = currentPriorityLevel;
  return () => unstable_runWithPriority(parentPriorityLevel, callback);
}

export function unstable_forceFrameRate(_fps?: number): void {}

function requestHostCallback(): void {
  if (isHostCallbackScheduled) {
    return;
  }

  isHostCallbackScheduled = true;
  queueMicrotask(flushWork);
}

function flushWork(): void {
  isHostCallbackScheduled = false;
  needsPaint = false;
  deadline = unstable_now() + frameYieldMs;
  let currentTask = peek(taskQueue);

  while (currentTask !== null) {
    pop(taskQueue);
    if (!currentTask.isCanceled) {
      const previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = currentTask.priorityLevel;
      Profiling.markTaskRun(currentTask, unstable_now());
      try {
        let continuation = currentTask.callback(currentTask.expirationTime <= unstable_now());
        while (typeof continuation === "function") {
          if (unstable_shouldYield()) {
            currentTask.callback = continuation;
            currentTask.sortIndex = currentTask.expirationTime;
            push(taskQueue, currentTask);
            Profiling.markTaskYield(currentTask, unstable_now());
            requestHostCallback();
            return;
          }
          continuation = continuation(false);
        }
        Profiling.markTaskCompleted(currentTask, unstable_now());
      } catch (error) {
        Profiling.markTaskErrored(currentTask, unstable_now());
        throw error;
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    }
    currentTask = peek(taskQueue);
  }
}

export const unstable_Profiling = Profiling;
