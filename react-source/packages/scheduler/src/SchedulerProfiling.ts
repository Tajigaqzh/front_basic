import type { PriorityLevel } from "./SchedulerPriorities.js";
import { enableProfiling } from "./SchedulerFeatureFlags.js";

let runIdCounter = 0;
let mainThreadIdCounter = 0;

const INITIAL_EVENT_LOG_SIZE = 131072;
const MAX_EVENT_LOG_SIZE = 524288;

let eventLogSize = 0;
let eventLogBuffer: ArrayBuffer | null = null;
let eventLog: Int32Array | null = null;
let eventLogIndex = 0;

const TaskStartEvent = 1;
const TaskCompleteEvent = 2;
const TaskErrorEvent = 3;
const TaskCancelEvent = 4;
const TaskRunEvent = 5;
const TaskYieldEvent = 6;
const SchedulerSuspendEvent = 7;
const SchedulerResumeEvent = 8;

function logEvent(entries: Array<number | PriorityLevel>): void {
  if (eventLog === null) {
    return;
  }
  const offset = eventLogIndex;
  eventLogIndex += entries.length;
  if (eventLogIndex + 1 > eventLogSize) {
    eventLogSize *= 2;
    if (eventLogSize > MAX_EVENT_LOG_SIZE) {
      console.error("Scheduler Profiling: Event log exceeded maximum size.");
      stopLoggingProfilingEvents();
      return;
    }
    const newEventLog = new Int32Array(eventLogSize * 4);
    newEventLog.set(eventLog);
    eventLogBuffer = newEventLog.buffer;
    eventLog = newEventLog;
  }
  eventLog.set(entries, offset);
}

export function startLoggingProfilingEvents(): void {
  eventLogSize = INITIAL_EVENT_LOG_SIZE;
  eventLogBuffer = new ArrayBuffer(eventLogSize * 4);
  eventLog = new Int32Array(eventLogBuffer);
  eventLogIndex = 0;
}

export function stopLoggingProfilingEvents(): ArrayBuffer | null {
  const buffer = eventLogBuffer;
  eventLogSize = 0;
  eventLogBuffer = null;
  eventLog = null;
  eventLogIndex = 0;
  return buffer;
}

type ProfilingTask = {
  id: number;
  priorityLevel: PriorityLevel;
};

export function markTaskStart(task: ProfilingTask, ms: number): void {
  if (enableProfiling) {
    logEvent([TaskStartEvent, ms * 1000, task.id, task.priorityLevel]);
  }
}

export function markTaskCompleted(task: ProfilingTask, ms: number): void {
  if (enableProfiling) {
    logEvent([TaskCompleteEvent, ms * 1000, task.id]);
  }
}

export function markTaskCanceled(task: ProfilingTask, ms: number): void {
  if (enableProfiling) {
    logEvent([TaskCancelEvent, ms * 1000, task.id]);
  }
}

export function markTaskErrored(task: ProfilingTask, ms: number): void {
  if (enableProfiling) {
    logEvent([TaskErrorEvent, ms * 1000, task.id]);
  }
}

export function markTaskRun(task: ProfilingTask, ms: number): void {
  if (enableProfiling) {
    runIdCounter += 1;
    logEvent([TaskRunEvent, ms * 1000, task.id, runIdCounter]);
  }
}

export function markTaskYield(task: { id: number }, ms: number): void {
  if (enableProfiling) {
    logEvent([TaskYieldEvent, ms * 1000, task.id, runIdCounter]);
  }
}

export function markSchedulerSuspended(ms: number): void {
  if (enableProfiling) {
    mainThreadIdCounter += 1;
    logEvent([SchedulerSuspendEvent, ms * 1000, mainThreadIdCounter]);
  }
}

export function markSchedulerUnsuspended(ms: number): void {
  if (enableProfiling) {
    logEvent([SchedulerResumeEvent, ms * 1000, mainThreadIdCounter]);
  }
}
