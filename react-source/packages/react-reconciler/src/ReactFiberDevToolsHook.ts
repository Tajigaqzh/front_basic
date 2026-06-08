import type { ReactNode } from "shared";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";

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

type ProfilingHooks = Record<string, (...args: any[]) => void>;

let rendererID: number | null = null;
let injectedHook: DevToolsHook | null = null;
let injectedProfilingHooks: ProfilingHooks | null = null;

export const isDevToolsPresent =
  typeof (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined";

export function injectInternals(internals: object): boolean {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook === undefined) {
    return false;
  }
  if (hook.isDisabled === true) {
    return true;
  }
  if (hook.supportsFiber !== true || typeof hook.inject !== "function") {
    return true;
  }
  rendererID = hook.inject(internals);
  injectedHook = hook;
  return hook.checkDCE === true;
}

export function onScheduleRoot(root: FiberRoot, children: ReactNode): void {
  injectedHook?.onScheduleFiberRoot?.(rendererID, root, children);
}

export function onCommitRoot(root: FiberRoot, _eventPriority?: unknown): void {
  injectedHook?.onCommitFiberRoot?.(rendererID, root, undefined, false);
}

export function onPostCommitRoot(root: FiberRoot): void {
  injectedHook?.onPostCommitFiberRoot?.(rendererID, root);
}

export function onCommitUnmount(fiber: Fiber): void {
  injectedHook?.onCommitFiberUnmount?.(rendererID, fiber);
}

export function setIsStrictModeForDevtools(newIsStrictMode: boolean): void {
  injectedHook?.setStrictMode?.(rendererID, newIsStrictMode);
}

export function injectProfilingHooks(profilingHooks: ProfilingHooks): void {
  injectedProfilingHooks = profilingHooks;
}

export function markCommitStarted(lanes: Lanes): void {
  injectedProfilingHooks?.markCommitStarted?.(lanes);
}

export function markCommitStopped(): void {
  injectedProfilingHooks?.markCommitStopped?.();
}

export function markComponentRenderStarted(fiber: Fiber): void {
  injectedProfilingHooks?.markComponentRenderStarted?.(fiber);
}

export function markComponentRenderStopped(): void {
  injectedProfilingHooks?.markComponentRenderStopped?.();
}

export function markComponentErrored(fiber: Fiber, thrownValue: unknown, lanes: Lanes): void {
  injectedProfilingHooks?.markComponentErrored?.(fiber, thrownValue, lanes);
}

export function markStateUpdateScheduled(fiber: Fiber, lane: Lanes): void {
  injectedProfilingHooks?.markStateUpdateScheduled?.(fiber, lane);
}

export function markForceUpdateScheduled(fiber: Fiber, lane: Lanes): void {
  injectedProfilingHooks?.markForceUpdateScheduled?.(fiber, lane);
}
