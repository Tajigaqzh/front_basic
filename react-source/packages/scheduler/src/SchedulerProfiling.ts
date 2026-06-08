/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { PriorityLevel } from "./SchedulerPriorities.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enableProfiling } from "./SchedulerFeatureFlags.js";

// @beginner: 声明 runIdCounter：保存当前步骤需要读取或更新的数据。
let runIdCounter = 0;
// @beginner: 声明 mainThreadIdCounter：保存当前步骤需要读取或更新的数据。
let mainThreadIdCounter = 0;

// @beginner: 声明 INITIAL_EVENT_LOG_SIZE：保存当前步骤需要读取或更新的数据。
const INITIAL_EVENT_LOG_SIZE = 131072;
// @beginner: 声明 MAX_EVENT_LOG_SIZE：保存当前步骤需要读取或更新的数据。
const MAX_EVENT_LOG_SIZE = 524288;

// @beginner: 声明 eventLogSize：保存当前步骤需要读取或更新的数据。
let eventLogSize = 0;
// @beginner: 声明 eventLogBuffer：保存当前步骤需要读取或更新的数据。
let eventLogBuffer: ArrayBuffer | null = null;
// @beginner: 声明 eventLog：保存当前步骤需要读取或更新的数据。
let eventLog: Int32Array | null = null;
// @beginner: 声明 eventLogIndex：保存当前步骤需要读取或更新的数据。
let eventLogIndex = 0;

// @beginner: 声明 TaskStartEvent：保存当前步骤需要读取或更新的数据。
const TaskStartEvent = 1;
// @beginner: 声明 TaskCompleteEvent：保存当前步骤需要读取或更新的数据。
const TaskCompleteEvent = 2;
// @beginner: 声明 TaskErrorEvent：保存当前步骤需要读取或更新的数据。
const TaskErrorEvent = 3;
// @beginner: 声明 TaskCancelEvent：保存当前步骤需要读取或更新的数据。
const TaskCancelEvent = 4;
// @beginner: 声明 TaskRunEvent：保存当前步骤需要读取或更新的数据。
const TaskRunEvent = 5;
// @beginner: 声明 TaskYieldEvent：保存当前步骤需要读取或更新的数据。
const TaskYieldEvent = 6;
// @beginner: 声明 SchedulerSuspendEvent：保存当前步骤需要读取或更新的数据。
const SchedulerSuspendEvent = 7;
// @beginner: 声明 SchedulerResumeEvent：保存当前步骤需要读取或更新的数据。
const SchedulerResumeEvent = 8;

// @beginner: 进入 logEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function logEvent(entries: Array<number | PriorityLevel>): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (eventLog === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 声明 offset：保存当前步骤需要读取或更新的数据。
  const offset = eventLogIndex;
  eventLogIndex += entries.length;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (eventLogIndex + 1 > eventLogSize) {
    eventLogSize *= 2;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (eventLogSize > MAX_EVENT_LOG_SIZE) {
      console.error("Scheduler Profiling: Event log exceeded maximum size.");
      stopLoggingProfilingEvents();
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 newEventLog：保存当前步骤需要读取或更新的数据。
    const newEventLog = new Int32Array(eventLogSize * 4);
    newEventLog.set(eventLog);
    eventLogBuffer = newEventLog.buffer;
    eventLog = newEventLog;
  }
  eventLog.set(entries, offset);
}

// @beginner: 进入 startLoggingProfilingEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startLoggingProfilingEvents(): void {
  eventLogSize = INITIAL_EVENT_LOG_SIZE;
  eventLogBuffer = new ArrayBuffer(eventLogSize * 4);
  eventLog = new Int32Array(eventLogBuffer);
  eventLogIndex = 0;
}

// @beginner: 进入 stopLoggingProfilingEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function stopLoggingProfilingEvents(): ArrayBuffer | null {
  // @beginner: 声明 buffer：保存当前步骤需要读取或更新的数据。
  const buffer = eventLogBuffer;
  eventLogSize = 0;
  eventLogBuffer = null;
  eventLog = null;
  eventLogIndex = 0;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return buffer;
}

// @beginner: 定义 ProfilingTask：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ProfilingTask = {
  id: number;
  priorityLevel: PriorityLevel;
};

// @beginner: 进入 markTaskStart：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskStart(task: ProfilingTask, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([TaskStartEvent, ms * 1000, task.id, task.priorityLevel]);
  }
}

// @beginner: 进入 markTaskCompleted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskCompleted(task: ProfilingTask, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([TaskCompleteEvent, ms * 1000, task.id]);
  }
}

// @beginner: 进入 markTaskCanceled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskCanceled(task: ProfilingTask, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([TaskCancelEvent, ms * 1000, task.id]);
  }
}

// @beginner: 进入 markTaskErrored：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskErrored(task: ProfilingTask, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([TaskErrorEvent, ms * 1000, task.id]);
  }
}

// @beginner: 进入 markTaskRun：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskRun(task: ProfilingTask, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    runIdCounter += 1;
    logEvent([TaskRunEvent, ms * 1000, task.id, runIdCounter]);
  }
}

// @beginner: 进入 markTaskYield：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTaskYield(task: { id: number }, ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([TaskYieldEvent, ms * 1000, task.id, runIdCounter]);
  }
}

// @beginner: 进入 markSchedulerSuspended：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markSchedulerSuspended(ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    mainThreadIdCounter += 1;
    logEvent([SchedulerSuspendEvent, ms * 1000, mainThreadIdCounter]);
  }
}

// @beginner: 进入 markSchedulerUnsuspended：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markSchedulerUnsuspended(ms: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enableProfiling) {
    logEvent([SchedulerResumeEvent, ms * 1000, mainThreadIdCounter]);
  }
}
