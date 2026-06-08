/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { SuspenseState } from "./ReactFiberSuspenseComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isCurrentTreeHidden } from "./ReactFiberHiddenContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { OffscreenComponent } from "./ReactWorkTags.js";

// @beginner: 声明 suspenseHandlerStackCursor：保存当前步骤需要读取或更新的数据。
const suspenseHandlerStackCursor: StackCursor<Fiber | null> = createCursor(null);
// @beginner: 声明 shellBoundary：保存当前步骤需要读取或更新的数据。
let shellBoundary: Fiber | null = null;

// @beginner: 进入 getShellBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getShellBoundary(): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return shellBoundary;
}

// @beginner: 进入 pushPrimaryTreeSuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushPrimaryTreeSuspenseHandler(handler: Fiber): void {
  push(
    suspenseStackCursor,
    setDefaultShallowSuspenseListContext(suspenseStackCursor.current),
    handler,
  );
  push(suspenseHandlerStackCursor, handler, handler);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shellBoundary === null) {
    // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
    const current = handler.alternate;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (current === null || isCurrentTreeHidden()) {
      shellBoundary = handler;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 声明 previousState：保存当前步骤需要读取或更新的数据。
      const previousState = current.memoizedState as SuspenseState | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (previousState !== null) {
        shellBoundary = handler;
      }
    }
  }
}

// @beginner: 进入 pushFallbackTreeSuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushFallbackTreeSuspenseHandler(fiber: Fiber): void {
  reuseSuspenseHandlerOnStack(fiber);
}

// @beginner: 进入 pushDehydratedActivitySuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushDehydratedActivitySuspenseHandler(fiber: Fiber): void {
  push(suspenseStackCursor, suspenseStackCursor.current, fiber);
  push(suspenseHandlerStackCursor, fiber, fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shellBoundary === null) {
    shellBoundary = fiber;
  }
}

// @beginner: 进入 pushOffscreenSuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushOffscreenSuspenseHandler(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === OffscreenComponent) {
    push(suspenseStackCursor, suspenseStackCursor.current, fiber);
    push(suspenseHandlerStackCursor, fiber, fiber);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (shellBoundary === null) {
      shellBoundary = fiber;
    }
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    reuseSuspenseHandlerOnStack(fiber);
  }
}

// @beginner: 进入 reuseSuspenseHandlerOnStack：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reuseSuspenseHandlerOnStack(fiber: Fiber): void {
  push(suspenseStackCursor, suspenseStackCursor.current, fiber);
  push(suspenseHandlerStackCursor, getSuspenseHandler(), fiber);
}

// @beginner: 进入 getSuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSuspenseHandler(): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return suspenseHandlerStackCursor.current;
}

// @beginner: 进入 popSuspenseHandler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popSuspenseHandler(fiber: Fiber): void {
  pop(suspenseHandlerStackCursor, fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shellBoundary === fiber) {
    shellBoundary = null;
  }
  pop(suspenseStackCursor, fiber);
}

// @beginner: 定义 SuspenseContext：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SuspenseContext = number;
// @beginner: 定义 SubtreeSuspenseContext：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SubtreeSuspenseContext = number;
// @beginner: 定义 ShallowSuspenseContext：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ShallowSuspenseContext = number;

// @beginner: 声明 DefaultSuspenseContext：保存当前步骤需要读取或更新的数据。
const DefaultSuspenseContext: SuspenseContext = 0b00;
// @beginner: 声明 SubtreeSuspenseContextMask：保存当前步骤需要读取或更新的数据。
const SubtreeSuspenseContextMask: SuspenseContext = 0b01;
// @beginner: 声明 ForceSuspenseFallback：保存当前步骤需要读取或更新的数据。
export const ForceSuspenseFallback: ShallowSuspenseContext = 0b10;

// @beginner: 声明 suspenseStackCursor：保存当前步骤需要读取或更新的数据。
export const suspenseStackCursor: StackCursor<SuspenseContext> = createCursor(DefaultSuspenseContext);

// @beginner: 进入 hasSuspenseListContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hasSuspenseListContext(parentContext: SuspenseContext, flag: SuspenseContext): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (parentContext & flag) !== 0;
}

// @beginner: 进入 setDefaultShallowSuspenseListContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setDefaultShallowSuspenseListContext(parentContext: SuspenseContext): SuspenseContext {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return parentContext & SubtreeSuspenseContextMask;
}

// @beginner: 进入 setShallowSuspenseListContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setShallowSuspenseListContext(
  parentContext: SuspenseContext,
  shallowContext: ShallowSuspenseContext,
): SuspenseContext {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (parentContext & SubtreeSuspenseContextMask) | shallowContext;
}

// @beginner: 进入 pushSuspenseListContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushSuspenseListContext(fiber: Fiber, newContext: SuspenseContext): void {
  push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current, fiber);
  push(suspenseStackCursor, newContext, fiber);
}

// @beginner: 进入 pushSuspenseListCatch：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushSuspenseListCatch(fiber: Fiber, newContext: SuspenseContext): void {
  push(suspenseHandlerStackCursor, fiber, fiber);
  push(suspenseStackCursor, newContext, fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shellBoundary === null) {
    shellBoundary = fiber;
  }
}

// @beginner: 进入 popSuspenseListContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popSuspenseListContext(fiber: Fiber): void {
  pop(suspenseStackCursor, fiber);
  pop(suspenseHandlerStackCursor, fiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shellBoundary === fiber) {
    shellBoundary = null;
  }
}
