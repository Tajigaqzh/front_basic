/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ImmediatePriority,
  NormalPriority,
  unstable_scheduleCallback,
} from "scheduler";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane, Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getNextLanes, includesSyncLane, NoLane, NoLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { TransitionLane, TransitionLane2 } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { performConcurrentWorkOnRoot, performSyncWorkOnRoot } from "./ReactFiberWorkLoop.js";

// @beginner: 声明 firstScheduledRoot：保存当前步骤需要读取或更新的数据。
export let firstScheduledRoot: FiberRoot | null = null;
// @beginner: 声明 lastScheduledRoot：保存当前步骤需要读取或更新的数据。
let lastScheduledRoot: FiberRoot | null = null;
// @beginner: 声明 didScheduleMicrotask：保存当前步骤需要读取或更新的数据。
let didScheduleMicrotask = false;
// @beginner: 声明 mightHavePendingSyncWork：保存当前步骤需要读取或更新的数据。
let mightHavePendingSyncWork = false;
// @beginner: 声明 transitionLaneMap：保存当前步骤需要读取或更新的数据。
const transitionLaneMap = new WeakMap<object, Lane>();
// @beginner: 声明 transitionLanePool：保存当前步骤需要读取或更新的数据。
const transitionLanePool = [TransitionLane, TransitionLane2] as const;
// @beginner: 声明 nextTransitionLaneIndex：保存当前步骤需要读取或更新的数据。
let nextTransitionLaneIndex = 0;

// @beginner: 进入 ensureRootIsScheduled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function ensureRootIsScheduled(root: FiberRoot): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (root !== lastScheduledRoot && root.next === null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      lastScheduledRoot.next = root;
      lastScheduledRoot = root;
    }
  }

  mightHavePendingSyncWork = true;
  ensureScheduleIsScheduled();
}

// @beginner: 进入 ensureScheduleIsScheduled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function ensureScheduleIsScheduled(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (didScheduleMicrotask) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  didScheduleMicrotask = true;
  queueMicrotask(processRootScheduleInMicrotask);
}

// @beginner: 进入 requestTransitionLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function requestTransitionLane(_transition: unknown): Lane {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof _transition === "object" && _transition !== null) {
    // @beginner: 声明 existingLane：保存当前步骤需要读取或更新的数据。
    const existingLane = transitionLaneMap.get(_transition);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (existingLane !== undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return existingLane;
    }
    // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
    const lane = claimNextTransitionLane();
    transitionLaneMap.set(_transition, lane);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return lane;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return claimNextTransitionLane();
}

// @beginner: 进入 claimNextTransitionLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function claimNextTransitionLane(): Lane {
  // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
  const lane = transitionLanePool[nextTransitionLaneIndex];
  nextTransitionLaneIndex = (nextTransitionLaneIndex + 1) % transitionLanePool.length;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return lane;
}

// @beginner: 进入 flushSyncWorkOnAllRoots：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function flushSyncWorkOnAllRoots(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!mightHavePendingSyncWork) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  let root = firstScheduledRoot;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (root !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (includesSyncLane(root.pendingLanes)) {
      performSyncWorkOnRoot(root);
    }
    root = root.next;
  }
  mightHavePendingSyncWork = false;
}

// @beginner: 进入 processRootScheduleInMicrotask：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function processRootScheduleInMicrotask(): void {
  didScheduleMicrotask = false;
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  let previous: FiberRoot | null = null;
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  let root = firstScheduledRoot;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (root !== null) {
    // @beginner: 声明 next：保存当前步骤需要读取或更新的数据。
    const next = root.next;
    // @beginner: 声明 nextLanes：保存当前步骤需要读取或更新的数据。
    const nextLanes = scheduleTaskForRootDuringMicrotask(root);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nextLanes === NoLanes) {
      root.next = null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (previous === null) {
        firstScheduledRoot = next;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        previous.next = next;
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (root === lastScheduledRoot) {
        lastScheduledRoot = previous;
      }
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      previous = root;
    }
    root = next;
  }
}

// @beginner: 进入 scheduleTaskForRootDuringMicrotask：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function scheduleTaskForRootDuringMicrotask(root: FiberRoot): Lanes {
  // @beginner: 声明 nextLanes：保存当前步骤需要读取或更新的数据。
  const nextLanes = getNextLanes(root);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextLanes === NoLanes) {
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return NoLanes;
  }

  // @beginner: 声明 newCallbackPriority：保存当前步骤需要读取或更新的数据。
  const newCallbackPriority = nextLanes;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (root.callbackNode !== null && root.callbackPriority === newCallbackPriority) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return nextLanes;
  }

  // @beginner: 声明 schedulerPriority：保存当前步骤需要读取或更新的数据。
  const schedulerPriority = includesSyncLane(nextLanes) ? ImmediatePriority : NormalPriority;
  root.callbackNode = unstable_scheduleCallback(schedulerPriority, () => {
    performConcurrentWorkOnRoot(root);
  });
  root.callbackPriority = newCallbackPriority as Lane;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextLanes;
}

// @beginner: 进入 getFirstScheduledRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getFirstScheduledRoot(): FiberRoot | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return firstScheduledRoot;
}
