/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TreeContext } from "./ReactFiberTreeContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCapturedValueAtFiber } from "./ReactCapturedValue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ForceClientRender } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { restoreSuspendedTreeContext } from "./ReactFiberTreeContext.js";

// @beginner: 定义 HydratableInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type HydratableInstance = Node;
// @beginner: 定义 ActivityInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ActivityInstance = Element;
// @beginner: 定义 SuspenseInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SuspenseInstance = Comment;

// @beginner: 声明 hydrationParentFiber：保存当前步骤需要读取或更新的数据。
let hydrationParentFiber: Fiber | null = null;
// @beginner: 声明 nextHydratableInstance：保存当前步骤需要读取或更新的数据。
let nextHydratableInstance: HydratableInstance | null = null;
// @beginner: 声明 isHydrating：保存当前步骤需要读取或更新的数据。
let isHydrating = false;
// @beginner: 声明 didSuspendOrErrorDEV：保存当前步骤需要读取或更新的数据。
let didSuspendOrErrorDEV = false;
// @beginner: 声明 hydrationErrors：保存当前步骤需要读取或更新的数据。
let hydrationErrors: Array<CapturedValue<unknown>> | null = null;

// @beginner: 进入 warnIfHydrating：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function warnIfHydrating(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isHydrating) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
}

// @beginner: 进入 markDidThrowWhileHydratingDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markDidThrowWhileHydratingDEV(): void {
  didSuspendOrErrorDEV = true;
}

// @beginner: 进入 enterHydrationState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function enterHydrationState(fiber: Fiber): boolean {
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = fiber.stateNode as { containerInfo?: ParentNode } | null;
  // @beginner: 声明 container：保存当前步骤需要读取或更新的数据。
  const container = root?.containerInfo;

  hydrationParentFiber = fiber;
  nextHydratableInstance = container?.firstChild ?? null;
  isHydrating = true;
  didSuspendOrErrorDEV = false;
  hydrationErrors = null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextHydratableInstance !== null;
}

// @beginner: 进入 reenterHydrationStateFromDehydratedActivityInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
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
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (treeContext !== null) {
    restoreSuspendedTreeContext(fiber, treeContext);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextHydratableInstance !== null;
}

// @beginner: 进入 reenterHydrationStateFromDehydratedSuspenseInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
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
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (treeContext !== null) {
    restoreSuspendedTreeContext(fiber, treeContext);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextHydratableInstance !== null;
}

// @beginner: 进入 throwOnHydrationMismatch：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function throwOnHydrationMismatch(fiber: Fiber): never {
  // @beginner: 声明 error：保存当前步骤需要读取或更新的数据。
  const error = new Error("Hydration failed because the initial UI does not match what was rendered on the server.");
  queueHydrationError(createCapturedValueAtFiber(error, fiber));
  fiber.flags |= ForceClientRender;
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw error;
}

// @beginner: 进入 claimHydratableSingleton：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function claimHydratableSingleton(_fiber: Fiber): void {
  // 当前 DOM renderer 未实现 singleton hydration，保留官方入口。
}

// @beginner: 进入 tryToClaimNextHydratableInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function tryToClaimNextHydratableInstance(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isHydrating) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextHydratableInstance === null) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  hydrationParentFiber = fiber;
  nextHydratableInstance = nextHydratableInstance.firstChild;
}

// @beginner: 进入 tryToClaimNextHydratableTextInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function tryToClaimNextHydratableTextInstance(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isHydrating) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextHydratableInstance === null || nextHydratableInstance.nodeType !== Node.TEXT_NODE) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  nextHydratableInstance = nextHydratableInstance.nextSibling;
}

// @beginner: 进入 claimNextHydratableActivityInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function claimNextHydratableActivityInstance(fiber: Fiber): ActivityInstance {
  tryToClaimNextHydratableInstance(fiber);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber.stateNode as ActivityInstance;
}

// @beginner: 进入 claimNextHydratableSuspenseInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function claimNextHydratableSuspenseInstance(fiber: Fiber): SuspenseInstance {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isHydrating || nextHydratableInstance === null || nextHydratableInstance.nodeType !== Node.COMMENT_NODE) {
    throwOnHydrationMismatch(fiber);
  }
  fiber.stateNode = nextHydratableInstance;
  nextHydratableInstance = nextHydratableInstance.nextSibling;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber.stateNode as SuspenseInstance;
}

// @beginner: 进入 tryToClaimNextHydratableFormMarkerInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function tryToClaimNextHydratableFormMarkerInstance(_fiber: Fiber): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 prepareToHydrateHostInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareToHydrateHostInstance(_fiber: Fiber): void {}

// @beginner: 进入 prepareToHydrateHostTextInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareToHydrateHostTextInstance(_fiber: Fiber): void {}

// @beginner: 进入 prepareToHydrateHostActivityInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareToHydrateHostActivityInstance(_fiber: Fiber): void {}

// @beginner: 进入 prepareToHydrateHostSuspenseInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareToHydrateHostSuspenseInstance(_fiber: Fiber): void {}

// @beginner: 进入 popToNextHostParent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popToNextHostParent(fiber: Fiber): void {
  // @beginner: 声明 parent：保存当前步骤需要读取或更新的数据。
  let parent = fiber.return;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (parent !== null && parent.stateNode === null) {
    parent = parent.return;
  }
  hydrationParentFiber = parent;
}

// @beginner: 进入 popHydrationState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popHydrationState(fiber: Fiber): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber !== hydrationParentFiber) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isHydrating) {
    popToNextHostParent(fiber);
    isHydrating = true;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  popToNextHostParent(fiber);
  nextHydratableInstance = fiber.stateNode instanceof Node ? fiber.stateNode.nextSibling : null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 resetHydrationState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function resetHydrationState(): void {
  hydrationParentFiber = null;
  nextHydratableInstance = null;
  isHydrating = false;
  didSuspendOrErrorDEV = false;
}

// @beginner: 进入 popHydrationStateOnInterruptedWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popHydrationStateOnInterruptedWork(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber !== hydrationParentFiber) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  popToNextHostParent(fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.stateNode instanceof Node) {
    nextHydratableInstance = fiber.stateNode;
  }
}

// @beginner: 进入 upgradeHydrationErrorsToRecoverable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function upgradeHydrationErrorsToRecoverable(): Array<CapturedValue<unknown>> | null {
  // @beginner: 声明 queuedErrors：保存当前步骤需要读取或更新的数据。
  const queuedErrors = hydrationErrors;
  hydrationErrors = null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return queuedErrors;
}

// @beginner: 进入 getIsHydrating：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getIsHydrating(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return isHydrating;
}

// @beginner: 进入 queueHydrationError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function queueHydrationError(error: CapturedValue<unknown>): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hydrationErrors === null) {
    hydrationErrors = [error];
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    hydrationErrors.push(error);
  }
}

// @beginner: 进入 emitPendingHydrationWarnings：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function emitPendingHydrationWarnings(): void {
  // DEV hydration diff 输出依赖官方 SSR diff 结构；当前 client-only 复刻不输出额外 warning。
}

// @beginner: 进入 getDidSuspendOrErrorDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getDidSuspendOrErrorDEV(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return didSuspendOrErrorDEV;
}

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
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
