import type { Fiber } from "./ReactInternalTypes.js";
import type { CapturedValue } from "./ReactCapturedValue.js";
import type { TreeContext } from "./ReactFiberTreeContext.js";
import { createCapturedValueAtFiber } from "./ReactCapturedValue.js";
import { ForceClientRender } from "./ReactFiberFlags.js";
import { restoreSuspendedTreeContext } from "./ReactFiberTreeContext.js";

export type HydratableInstance = Node;
export type ActivityInstance = Element;
export type SuspenseInstance = Comment;

let hydrationParentFiber: Fiber | null = null;
let nextHydratableInstance: HydratableInstance | null = null;
let isHydrating = false;
let didSuspendOrErrorDEV = false;
let hydrationErrors: Array<CapturedValue<unknown>> | null = null;

function warnIfHydrating(): void {
  if (isHydrating) {
    return;
  }
}

export function markDidThrowWhileHydratingDEV(): void {
  didSuspendOrErrorDEV = true;
}

function enterHydrationState(fiber: Fiber): boolean {
  const root = fiber.stateNode as { containerInfo?: ParentNode } | null;
  const container = root?.containerInfo;

  hydrationParentFiber = fiber;
  nextHydratableInstance = container?.firstChild ?? null;
  isHydrating = true;
  didSuspendOrErrorDEV = false;
  hydrationErrors = null;
  return nextHydratableInstance !== null;
}

function reenterHydrationStateFromDehydratedActivityInstance(
  fiber: Fiber,
  activityInstance: ActivityInstance,
  treeContext: TreeContext | null,
): boolean {
  hydrationParentFiber = fiber;
  nextHydratableInstance = activityInstance.firstChild;
  isHydrating = true;
  didSuspendOrErrorDEV = false;
  hydrationErrors = null;
  if (treeContext !== null) {
    restoreSuspendedTreeContext(fiber, treeContext);
  }
  return nextHydratableInstance !== null;
}

function reenterHydrationStateFromDehydratedSuspenseInstance(
  fiber: Fiber,
  suspenseInstance: SuspenseInstance,
  treeContext: TreeContext | null,
): boolean {
  hydrationParentFiber = fiber;
  nextHydratableInstance = suspenseInstance.nextSibling;
  isHydrating = true;
  didSuspendOrErrorDEV = false;
  hydrationErrors = null;
  if (treeContext !== null) {
    restoreSuspendedTreeContext(fiber, treeContext);
  }
  return nextHydratableInstance !== null;
}

function throwOnHydrationMismatch(fiber: Fiber): never {
  const error = new Error("Hydration failed because the initial UI does not match what was rendered on the server.");
  queueHydrationError(createCapturedValueAtFiber(error, fiber));
  fiber.flags |= ForceClientRender;
  throw error;
}

function claimHydratableSingleton(_fiber: Fiber): void {
  // 当前 DOM renderer 未实现 singleton hydration，保留官方入口。
}

function tryToClaimNextHydratableInstance(fiber: Fiber): void {
  if (!isHydrating) {
    return;
  }
  if (nextHydratableInstance === null) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  hydrationParentFiber = fiber;
  nextHydratableInstance = nextHydratableInstance.firstChild;
}

function tryToClaimNextHydratableTextInstance(fiber: Fiber): void {
  if (!isHydrating) {
    return;
  }
  if (nextHydratableInstance === null || nextHydratableInstance.nodeType !== Node.TEXT_NODE) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  nextHydratableInstance = nextHydratableInstance.nextSibling;
}

function claimNextHydratableActivityInstance(fiber: Fiber): ActivityInstance {
  tryToClaimNextHydratableInstance(fiber);
  return fiber.stateNode as ActivityInstance;
}

function claimNextHydratableSuspenseInstance(fiber: Fiber): SuspenseInstance {
  if (!isHydrating || nextHydratableInstance === null || nextHydratableInstance.nodeType !== Node.COMMENT_NODE) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  nextHydratableInstance = nextHydratableInstance.nextSibling;
  return fiber.stateNode as SuspenseInstance;
}

export function tryToClaimNextHydratableFormMarkerInstance(_fiber: Fiber): boolean {
  return false;
}

function prepareToHydrateHostInstance(_fiber: Fiber): void {}

function prepareToHydrateHostTextInstance(_fiber: Fiber): void {}

function prepareToHydrateHostActivityInstance(_fiber: Fiber): void {}

function prepareToHydrateHostSuspenseInstance(_fiber: Fiber): void {}

function popToNextHostParent(fiber: Fiber): void {
  let parent = fiber.return;
  while (parent !== null && parent.stateNode === null) {
    parent = parent.return;
  }
  hydrationParentFiber = parent;
}

function popHydrationState(fiber: Fiber): boolean {
  if (fiber !== hydrationParentFiber) {
    return false;
  }
  if (!isHydrating) {
    popToNextHostParent(fiber);
    isHydrating = true;
    return false;
  }

  popToNextHostParent(fiber);
  nextHydratableInstance = fiber.stateNode instanceof Node ? fiber.stateNode.nextSibling : null;
  return true;
}

function resetHydrationState(): void {
  hydrationParentFiber = null;
  nextHydratableInstance = null;
  isHydrating = false;
  didSuspendOrErrorDEV = false;
}

function popHydrationStateOnInterruptedWork(fiber: Fiber): void {
  if (fiber !== hydrationParentFiber) {
    return;
  }
  popToNextHostParent(fiber);
  if (fiber.stateNode instanceof Node) {
    nextHydratableInstance = fiber.stateNode;
  }
}

export function upgradeHydrationErrorsToRecoverable(): Array<CapturedValue<unknown>> | null {
  const queuedErrors = hydrationErrors;
  hydrationErrors = null;
  return queuedErrors;
}

function getIsHydrating(): boolean {
  return isHydrating;
}

export function queueHydrationError(error: CapturedValue<unknown>): void {
  if (hydrationErrors === null) {
    hydrationErrors = [error];
  } else {
    hydrationErrors.push(error);
  }
}

export function emitPendingHydrationWarnings(): void {
  // DEV hydration diff 输出依赖官方 SSR diff 结构；当前 client-only 复刻不输出额外 warning。
}

export function getDidSuspendOrErrorDEV(): boolean {
  return didSuspendOrErrorDEV;
}

export {
  warnIfHydrating,
  enterHydrationState,
  getIsHydrating,
  reenterHydrationStateFromDehydratedActivityInstance,
  reenterHydrationStateFromDehydratedSuspenseInstance,
  resetHydrationState,
  popHydrationStateOnInterruptedWork,
  claimHydratableSingleton,
  tryToClaimNextHydratableInstance,
  tryToClaimNextHydratableTextInstance,
  claimNextHydratableActivityInstance,
  claimNextHydratableSuspenseInstance,
  prepareToHydrateHostInstance,
  prepareToHydrateHostTextInstance,
  prepareToHydrateHostActivityInstance,
  prepareToHydrateHostSuspenseInstance,
  popHydrationState,
};
