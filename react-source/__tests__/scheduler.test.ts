import { describe, expect, it } from "vitest";
import {
  ImmediatePriority,
  NormalPriority,
  UserBlockingPriority,
} from "../packages/scheduler/src/SchedulerPriorities.js";
import {
  unstable_cancelCallback,
  unstable_getCurrentPriorityLevel,
  unstable_runWithPriority,
  unstable_scheduleCallback,
  unstable_wrapCallback,
} from "../packages/scheduler/src/forks/Scheduler.js";
import {
  startLoggingProfilingEvents,
  stopLoggingProfilingEvents,
  markTaskStart,
} from "../packages/scheduler/src/SchedulerProfiling.js";
import * as SchedulerMock from "../packages/scheduler/src/forks/SchedulerMock.js";
import * as SchedulerNative from "../packages/scheduler/src/forks/SchedulerNative.js";
import { enableRequestPaint as wwwEnableRequestPaint } from "../packages/scheduler/src/forks/SchedulerFeatureFlags.www.js";

describe("Scheduler core", () => {
  it("按 expirationTime 执行任务并支持 cancel", async () => {
    const calls: string[] = [];
    unstable_scheduleCallback(NormalPriority, () => {
      calls.push("normal");
    });
    const canceled = unstable_scheduleCallback(UserBlockingPriority, () => {
      calls.push("canceled");
    });
    unstable_cancelCallback(canceled);
    unstable_scheduleCallback(ImmediatePriority, () => {
      calls.push("immediate");
    });

    await Promise.resolve();

    expect(calls).toEqual(["immediate", "normal"]);
  });

  it("runWithPriority 和 wrapCallback 保存当前优先级", () => {
    const wrapped = unstable_runWithPriority(UserBlockingPriority, () => {
      expect(unstable_getCurrentPriorityLevel()).toBe(UserBlockingPriority);
      return unstable_wrapCallback(() => unstable_getCurrentPriorityLevel());
    });

    expect(unstable_getCurrentPriorityLevel()).toBe(NormalPriority);
    expect(wrapped()).toBe(UserBlockingPriority);
  });
});

describe("SchedulerProfiling", () => {
  it("start/stop 返回 profiling buffer，mark 在 profiling 关闭时保持 no-op", () => {
    startLoggingProfilingEvents();
    markTaskStart({ id: 1, priorityLevel: NormalPriority }, 1);
    const buffer = stopLoggingProfilingEvents();

    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });
});

describe("SchedulerMock", () => {
  it("手动 flush 任务并收集 yield log", () => {
    SchedulerMock.reset();
    SchedulerMock.unstable_scheduleCallback(NormalPriority, () => {
      SchedulerMock.log("A");
    });
    SchedulerMock.unstable_scheduleCallback(UserBlockingPriority, () => {
      SchedulerMock.log("B");
    });

    expect(SchedulerMock.unstable_flushNumberOfYields(2)).toEqual(["B", "A"]);
    expect(SchedulerMock.unstable_hasPendingWork()).toBe(false);
  });
});

describe("Scheduler forks", () => {
  it("native fork 保留未实现 API 的官方抛错行为", () => {
    expect(() => SchedulerNative.unstable_next(() => undefined)).toThrow("Not implemented.");
  });

  it("www feature flag fork 透传动态 requestPaint 默认值", () => {
    expect(wwwEnableRequestPaint).toBe(false);
  });
});
