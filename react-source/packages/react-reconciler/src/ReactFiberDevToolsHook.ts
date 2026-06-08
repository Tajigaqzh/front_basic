/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactNode } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";

// @beginner: 定义 DevToolsHook：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type DevToolsHook = {
  isDisabled?: boolean;
  supportsFiber?: boolean;
  inject?(internals: object): number;
  onScheduleFiberRoot?(rendererID: number | null, root: FiberRoot, children: ReactNode): void;
  onCommitFiberRoot?(rendererID: number | null, root: FiberRoot, priority?: unknown, didError?: boolean): void;
  onPostCommitFiberRoot?(rendererID: number | null, root: FiberRoot): void;
  onCommitFiberUnmount?(rendererID: number | null, fiber: Fiber): void;
  setStrictMode?(rendererID: number | null, isStrictMode: boolean): void;
  checkDCE?: boolean;
};

// @beginner: 定义 ProfilingHooks：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ProfilingHooks = Record<string, (...args: any[]) => void>;

// @beginner: 声明 rendererID：保存当前步骤需要读取或更新的数据。
let rendererID: number | null = null;
// @beginner: 声明 injectedHook：保存当前步骤需要读取或更新的数据。
let injectedHook: DevToolsHook | null = null;
// @beginner: 声明 injectedProfilingHooks：保存当前步骤需要读取或更新的数据。
let injectedProfilingHooks: ProfilingHooks | null = null;

// @beginner: 声明 isDevToolsPresent：保存当前步骤需要读取或更新的数据。
export const isDevToolsPresent =
  typeof (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined";

// @beginner: 进入 injectInternals：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function injectInternals(internals: object): boolean {
  // @beginner: 声明 hook：保存当前步骤需要读取或更新的数据。
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hook === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hook.isDisabled === true) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hook.supportsFiber !== true || typeof hook.inject !== "function") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  rendererID = hook.inject(internals);
  injectedHook = hook;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook.checkDCE === true;
}

// @beginner: 进入 onScheduleRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function onScheduleRoot(root: FiberRoot, children: ReactNode): void {
  injectedHook?.onScheduleFiberRoot?.(rendererID, root, children);
}

// @beginner: 进入 onCommitRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function onCommitRoot(root: FiberRoot, _eventPriority?: unknown): void {
  injectedHook?.onCommitFiberRoot?.(rendererID, root, undefined, false);
}

// @beginner: 进入 onPostCommitRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function onPostCommitRoot(root: FiberRoot): void {
  injectedHook?.onPostCommitFiberRoot?.(rendererID, root);
}

// @beginner: 进入 onCommitUnmount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function onCommitUnmount(fiber: Fiber): void {
  injectedHook?.onCommitFiberUnmount?.(rendererID, fiber);
}

// @beginner: 进入 setIsStrictModeForDevtools：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setIsStrictModeForDevtools(newIsStrictMode: boolean): void {
  injectedHook?.setStrictMode?.(rendererID, newIsStrictMode);
}

// @beginner: 进入 injectProfilingHooks：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function injectProfilingHooks(profilingHooks: ProfilingHooks): void {
  injectedProfilingHooks = profilingHooks;
}

// @beginner: 进入 markCommitStarted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markCommitStarted(lanes: Lanes): void {
  injectedProfilingHooks?.markCommitStarted?.(lanes);
}

// @beginner: 进入 markCommitStopped：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markCommitStopped(): void {
  injectedProfilingHooks?.markCommitStopped?.();
}

// @beginner: 进入 markComponentRenderStarted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markComponentRenderStarted(fiber: Fiber): void {
  injectedProfilingHooks?.markComponentRenderStarted?.(fiber);
}

// @beginner: 进入 markComponentRenderStopped：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markComponentRenderStopped(): void {
  injectedProfilingHooks?.markComponentRenderStopped?.();
}

// @beginner: 进入 markComponentErrored：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markComponentErrored(fiber: Fiber, thrownValue: unknown, lanes: Lanes): void {
  injectedProfilingHooks?.markComponentErrored?.(fiber, thrownValue, lanes);
}

// @beginner: 进入 markStateUpdateScheduled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markStateUpdateScheduled(fiber: Fiber, lane: Lanes): void {
  injectedProfilingHooks?.markStateUpdateScheduled?.(fiber, lane);
}

// @beginner: 进入 markForceUpdateScheduled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markForceUpdateScheduled(fiber: Fiber, lane: Lanes): void {
  injectedProfilingHooks?.markForceUpdateScheduled?.(fiber, lane);
}
