/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";

// @beginner: 定义 SuspenseInfo：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SuspenseInfo = { name: string | null };
// @beginner: 定义 Transition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Transition = { name?: string | null; startTime?: number };
// @beginner: 定义 PendingBoundaries：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type PendingBoundaries = Map<unknown, SuspenseInfo>;

// @beginner: 定义 PendingTransitionCallbacks：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PendingTransitionCallbacks {
  transitionStart: Transition[] | null;
  transitionProgress: Map<Transition, PendingBoundaries> | null;
  transitionComplete: Transition[] | null;
  markerProgress: Map<string, { pendingBoundaries: PendingBoundaries; transitions: Set<Transition> }> | null;
  markerIncomplete: Map<string, { aborts: TransitionAbort[]; transitions: Set<Transition> }> | null;
  markerComplete: Map<string, Set<Transition>> | null;
}

// @beginner: 定义 TracingMarkerInstance：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface TracingMarkerInstance {
  tag?: TracingMarkerTag;
  transitions: Set<Transition> | null;
  pendingBoundaries: PendingBoundaries | null;
  aborts: TransitionAbort[] | null;
  name: string | null;
}

// @beginner: 定义 TransitionAbort：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface TransitionAbort {
  reason: "error" | "unknown" | "marker" | "suspense";
  name?: string | null;
}

// @beginner: 声明 TransitionRoot：保存当前步骤需要读取或更新的数据。
export const TransitionRoot = 0;
// @beginner: 声明 TransitionTracingMarker：保存当前步骤需要读取或更新的数据。
export const TransitionTracingMarker = 1;
// @beginner: 定义 TracingMarkerTag：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TracingMarkerTag = typeof TransitionRoot | typeof TransitionTracingMarker;

// @beginner: 定义 TransitionTracingCallbacks：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface TransitionTracingCallbacks {
  onTransitionStart?: (transitionName: string, startTime: number | undefined) => void;
  onTransitionProgress?: (
    transitionName: string,
    startTime: number | undefined,
    endTime: number,
    pending: SuspenseInfo[],
  ) => void;
  onTransitionComplete?: (transitionName: string, startTime: number | undefined, endTime: number) => void;
  onMarkerProgress?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    endTime: number,
    pending: SuspenseInfo[],
  ) => void;
  onMarkerComplete?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    endTime: number,
  ) => void;
  onMarkerIncomplete?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    aborts: Array<{ type: string; name?: string | null; endTime: number }>,
  ) => void;
}

// @beginner: 声明 markerInstancesCursor：保存当前步骤需要读取或更新的数据。
const markerInstancesCursor: StackCursor<TracingMarkerInstance[] | null> = createCursor(null);

// @beginner: 进入 processTransitionCallbacks：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function processTransitionCallbacks(
  pendingTransitions: PendingTransitionCallbacks,
  endTime: number,
  callbacks: TransitionTracingCallbacks,
): void {
  pendingTransitions.transitionStart?.forEach((transition) => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transition.name != null) {
      callbacks.onTransitionStart?.(transition.name, transition.startTime);
    }
  });

  pendingTransitions.transitionProgress?.forEach((pending, transition) => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transition.name != null) {
      callbacks.onTransitionProgress?.(transition.name, transition.startTime, endTime, Array.from(pending.values()));
    }
  });

  pendingTransitions.transitionComplete?.forEach((transition) => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transition.name != null) {
      callbacks.onTransitionComplete?.(transition.name, transition.startTime, endTime);
    }
  });

  pendingTransitions.markerProgress?.forEach((marker, markerName) => {
    marker.transitions.forEach((transition) => {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (transition.name != null) {
        callbacks.onMarkerProgress?.(
          transition.name,
          markerName,
          transition.startTime,
          endTime,
          Array.from(marker.pendingBoundaries.values()),
        );
      }
    });
  });

  pendingTransitions.markerComplete?.forEach((transitions, markerName) => {
    transitions.forEach((transition) => {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (transition.name != null) {
        callbacks.onMarkerComplete?.(transition.name, markerName, transition.startTime, endTime);
      }
    });
  });

  pendingTransitions.markerIncomplete?.forEach(({ transitions, aborts }, markerName) => {
    transitions.forEach((transition) => {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (transition.name != null) {
        callbacks.onMarkerIncomplete?.(
          transition.name,
          markerName,
          transition.startTime,
          aborts.map((abort) => ({ type: abort.reason, name: abort.name, endTime })),
        );
      }
    });
  });
}

// @beginner: 进入 createMarker：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createMarker(name: string | null, tag: TracingMarkerTag): TracingMarkerInstance {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    tag,
    transitions: null,
    pendingBoundaries: null,
    aborts: null,
    name,
  };
}

// @beginner: 进入 pushRootMarkerInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushRootMarkerInstance(workInProgress: Fiber): void {
  push(markerInstancesCursor, [createMarker(null, TransitionRoot)], workInProgress);
}

// @beginner: 进入 popRootMarkerInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popRootMarkerInstance(workInProgress: Fiber): void {
  pop(markerInstancesCursor, workInProgress);
}

// @beginner: 进入 pushMarkerInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushMarkerInstance(workInProgress: Fiber, markerInstance: TracingMarkerInstance | string): void {
  // @beginner: 声明 marker：保存当前步骤需要读取或更新的数据。
  const marker =
    typeof markerInstance === "string"
      ? createMarker(markerInstance, TransitionTracingMarker)
      : markerInstance;
  // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
  const current = markerInstancesCursor.current;
  push(markerInstancesCursor, current === null ? [marker] : current.concat(marker), workInProgress);
}

// @beginner: 进入 popMarkerInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popMarkerInstance(workInProgress: Fiber): void {
  pop(markerInstancesCursor, workInProgress);
}

// @beginner: 进入 getMarkerInstances：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getMarkerInstances(): TracingMarkerInstance[] | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return markerInstancesCursor.current;
}
