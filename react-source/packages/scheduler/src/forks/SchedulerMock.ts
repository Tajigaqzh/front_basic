import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
  timeoutForPriority,
  type PriorityLevel,
} from "../SchedulerPriorities.js";
import { peek, pop, push, type HeapNode } from "../SchedulerMinHeap.js";
import * as Profiling from "../SchedulerProfiling.js";

export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
};

export type Callback = (didTimeout?: boolean) => Callback | void | null;

export interface Task extends HeapNode {
  callback: Callback;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  isCanceled: boolean;
}

const taskQueue: Task[] = [];
const yieldedValues: unknown[] = [];
let currentMockTime = 0;
let taskIdCounter = 1;
let currentPriorityLevel: PriorityLevel = NormalPriority;
let disableYieldValue = false;
let needsPaint = false;

export function unstable_now(): number {
  return currentMockTime;
}

export function unstable_scheduleCallback(
  priorityLevel: PriorityLevel = NormalPriority,
  callback: Callback,
  options?: { delay?: number },
): Task {
  const startTime = currentMockTime + (options?.delay ?? 0);
  const expirationTime = startTime + timeoutForPriority(priorityLevel);
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
  return task;
}

export function unstable_cancelCallback(task: Task): void {
  task.isCanceled = true;
  task.callback = () => null;
  Profiling.markTaskCanceled(task, currentMockTime);
}

function flushOneTask(): boolean {
  const task = peek(taskQueue);
  if (task === null) {
    return false;
  }
  pop(taskQueue);
  if (task.isCanceled) {
    return true;
  }
  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = task.priorityLevel;
  try {
    Profiling.markTaskRun(task, currentMockTime);
    let continuation = task.callback(task.expirationTime <= currentMockTime);
    while (typeof continuation === "function") {
      continuation = continuation(false);
    }
    Profiling.markTaskCompleted(task, currentMockTime);
  } catch (error) {
    Profiling.markTaskErrored(task, currentMockTime);
    throw error;
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
  return true;
}

export function unstable_flushAllWithoutAsserting(): boolean {
  let didFlush = false;
  while (flushOneTask()) {
    didFlush = true;
  }
  return didFlush;
}

export function unstable_flushAll(): void {
  unstable_flushAllWithoutAsserting();
  if (yieldedValues.length > 0) {
    throw new Error("Log is not empty. Call unstable_clearLog() first.");
  }
}

export function unstable_flushNumberOfYields(count: number): unknown[] {
  while (yieldedValues.length < count && flushOneTask()) {}
  return unstable_clearLog();
}

export function unstable_flushExpired(): void {
  let task = peek(taskQueue);
  while (task !== null && task.expirationTime <= currentMockTime) {
    flushOneTask();
    task = peek(taskQueue);
  }
}

export function unstable_flushUntilNextPaint(): unknown[] {
  needsPaint = false;
  while (!needsPaint && flushOneTask()) {}
  return unstable_clearLog();
}

export function unstable_hasPendingWork(): boolean {
  return peek(taskQueue) !== null;
}

export function log(value: unknown): void {
  if (!disableYieldValue) {
    yieldedValues.push(value);
  }
}

export function unstable_clearLog(): unknown[] {
  const values = yieldedValues.slice();
  yieldedValues.length = 0;
  return values;
}

export function unstable_advanceTime(ms: number): void {
  currentMockTime += ms;
}

export function reset(): void {
  taskQueue.length = 0;
  yieldedValues.length = 0;
  currentMockTime = 0;
  taskIdCounter = 1;
  currentPriorityLevel = NormalPriority;
  needsPaint = false;
}

export function unstable_setDisableYieldValue(newValue: boolean): void {
  disableYieldValue = newValue;
}

export function unstable_shouldYield(): boolean {
  return needsPaint;
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

export const unstable_Profiling = Profiling;
