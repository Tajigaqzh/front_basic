/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Container, HostContext, TransitionStatus } from "./ReactFiberConfig.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getChildHostContext,
  getRootHostContext,
  HostTransitionContext,
  isPrimaryRenderer,
  NotPendingTransition,
} from "./ReactFiberConfig.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";

// @beginner: 声明 contextStackCursor：保存当前步骤需要读取或更新的数据。
const contextStackCursor: StackCursor<HostContext | null> = createCursor(null);
// @beginner: 声明 contextFiberStackCursor：保存当前步骤需要读取或更新的数据。
const contextFiberStackCursor: StackCursor<Fiber | null> = createCursor(null);
// @beginner: 声明 rootInstanceStackCursor：保存当前步骤需要读取或更新的数据。
const rootInstanceStackCursor: StackCursor<Container | null> = createCursor(null);
// @beginner: 声明 hostTransitionProviderCursor：保存当前步骤需要读取或更新的数据。
const hostTransitionProviderCursor: StackCursor<Fiber | null> = createCursor(null);

// @beginner: 进入 requiredContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function requiredContext<T>(context: T | null): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (context === null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Expected host context to exist.");
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return context;
}

// @beginner: 进入 getCurrentRootHostContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getCurrentRootHostContainer(): Container | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return rootInstanceStackCursor.current;
}

// @beginner: 进入 getRootHostContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getRootHostContainer(): Container {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return requiredContext(rootInstanceStackCursor.current);
}

// @beginner: 进入 getHostTransitionProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getHostTransitionProvider(): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hostTransitionProviderCursor.current;
}

// @beginner: 进入 getHostContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getHostContext(): HostContext {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return requiredContext(contextStackCursor.current);
}

// @beginner: 进入 pushHostContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushHostContainer(fiber: Fiber, nextRootInstance: Container): void {
  push(rootInstanceStackCursor, nextRootInstance, fiber);
  push(contextFiberStackCursor, fiber, fiber);

  // 与官方一致：先压入空值，确保 getRootHostContext 抛错时 unwind 栈层级仍然匹配。
  push(contextStackCursor, null, fiber);
  // @beginner: 声明 nextRootContext：保存当前步骤需要读取或更新的数据。
  const nextRootContext = getRootHostContext(nextRootInstance);
  pop(contextStackCursor, fiber);
  push(contextStackCursor, nextRootContext, fiber);
}

// @beginner: 进入 popHostContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popHostContainer(fiber: Fiber): void {
  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
  pop(rootInstanceStackCursor, fiber);
}

// @beginner: 进入 pushHostContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushHostContext(fiber: Fiber): void {
  // @beginner: 声明 stateHook：保存当前步骤需要读取或更新的数据。
  const stateHook = fiber.memoizedState;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (stateHook !== null) {
    // @beginner: 声明 transitionStatus：保存当前步骤需要读取或更新的数据。
    const transitionStatus = stateHook.memoizedState as TransitionStatus;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (isPrimaryRenderer) {
      HostTransitionContext._currentValue = transitionStatus;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      HostTransitionContext._currentValue2 = transitionStatus;
    }
    push(hostTransitionProviderCursor, fiber, fiber);
  }

  // @beginner: 声明 context：保存当前步骤需要读取或更新的数据。
  const context = requiredContext(contextStackCursor.current);
  // @beginner: 声明 nextContext：保存当前步骤需要读取或更新的数据。
  const nextContext = getChildHostContext(context, String(fiber.type));

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (context !== nextContext) {
    push(contextFiberStackCursor, fiber, fiber);
    push(contextStackCursor, nextContext, fiber);
  }
}

// @beginner: 进入 popHostContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popHostContext(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (contextFiberStackCursor.current === fiber) {
    pop(contextStackCursor, fiber);
    pop(contextFiberStackCursor, fiber);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hostTransitionProviderCursor.current === fiber) {
    pop(hostTransitionProviderCursor, fiber);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (isPrimaryRenderer) {
      HostTransitionContext._currentValue = NotPendingTransition;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      HostTransitionContext._currentValue2 = NotPendingTransition;
    }
  }
}
