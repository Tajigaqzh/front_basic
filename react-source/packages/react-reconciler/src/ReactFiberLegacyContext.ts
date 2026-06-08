/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { disableLegacyContext } from "shared/ReactFeatureFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ClassComponent, HostRoot } from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";

// @beginner: 定义 LegacyContext：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type LegacyContext = Record<string, unknown>;
// @beginner: 定义 LegacyContextProviderType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type LegacyContextProviderType = Function & {
  childContextTypes?: Record<string, unknown> | null;
  contextTypes?: Record<string, unknown> | null;
};
// @beginner: 定义 LegacyInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type LegacyInstance = {
  getChildContext?: () => LegacyContext;
  __reactInternalMemoizedUnmaskedChildContext?: LegacyContext;
  __reactInternalMemoizedMaskedChildContext?: LegacyContext;
  __reactInternalMemoizedMergedChildContext?: LegacyContext;
};

// @beginner: 声明 emptyContextObject：保存当前步骤需要读取或更新的数据。
export const emptyContextObject: LegacyContext = Object.freeze({});

// @beginner: 声明 contextStackCursor：保存当前步骤需要读取或更新的数据。
const contextStackCursor: StackCursor<LegacyContext> = createCursor(emptyContextObject);
// @beginner: 声明 didPerformWorkStackCursor：保存当前步骤需要读取或更新的数据。
const didPerformWorkStackCursor: StackCursor<boolean> = createCursor(false);
// @beginner: 声明 previousContext：保存当前步骤需要读取或更新的数据。
let previousContext: LegacyContext = emptyContextObject;

// @beginner: 进入 getUnmaskedContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getUnmaskedContext(
  workInProgress: Fiber,
  Component: LegacyContextProviderType,
  didPushOwnContextIfProvider: boolean,
): LegacyContext {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return emptyContextObject;
  }

  // Provider 读取 context 时不能看到自己刚 push 的 childContext，需要回退到父级 context。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (didPushOwnContextIfProvider && isContextProvider(Component)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return previousContext;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return contextStackCursor.current;
}

// @beginner: 进入 cacheContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function cacheContext(workInProgress: Fiber, unmaskedContext: LegacyContext, maskedContext: LegacyContext): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as LegacyInstance | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance !== null) {
    instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
    instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
  }
}

// @beginner: 进入 getMaskedContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getMaskedContext(workInProgress: Fiber, unmaskedContext: LegacyContext): LegacyContext {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return emptyContextObject;
  }

  // @beginner: 声明 type：保存当前步骤需要读取或更新的数据。
  const type = workInProgress.type as LegacyContextProviderType;
  // @beginner: 声明 contextTypes：保存当前步骤需要读取或更新的数据。
  const contextTypes = type.contextTypes;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (contextTypes === null || contextTypes === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return emptyContextObject;
  }

  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as LegacyInstance | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (
    instance !== null &&
    instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext &&
    instance.__reactInternalMemoizedMaskedChildContext !== undefined
  ) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return instance.__reactInternalMemoizedMaskedChildContext;
  }

  // @beginner: 声明 context：保存当前步骤需要读取或更新的数据。
  const context: LegacyContext = {};
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const key in contextTypes) {
    context[key] = unmaskedContext[key];
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance !== null) {
    cacheContext(workInProgress, unmaskedContext, context);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return context;
}

// @beginner: 进入 hasContextChanged：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hasContextChanged(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return disableLegacyContext ? false : didPerformWorkStackCursor.current;
}

// @beginner: 进入 isContextProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isContextProvider(type: LegacyContextProviderType): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return type.childContextTypes !== null && type.childContextTypes !== undefined;
}

// @beginner: 进入 popContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popContext(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  pop(didPerformWorkStackCursor, fiber);
  pop(contextStackCursor, fiber);
}

// @beginner: 进入 popTopLevelContextObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popTopLevelContextObject(fiber: Fiber): void {
  popContext(fiber);
}

// @beginner: 进入 pushTopLevelContextObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pushTopLevelContextObject(fiber: Fiber, context: LegacyContext, didChange: boolean): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (contextStackCursor.current !== emptyContextObject) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Unexpected context found on stack.");
  }

  push(contextStackCursor, context, fiber);
  push(didPerformWorkStackCursor, didChange, fiber);
}

// @beginner: 进入 processChildContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function processChildContext(
  fiber: Fiber,
  type: LegacyContextProviderType,
  parentContext: LegacyContext,
): LegacyContext {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return parentContext;
  }

  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = fiber.stateNode as LegacyInstance | null;
  // @beginner: 声明 childContextTypes：保存当前步骤需要读取或更新的数据。
  const childContextTypes = type.childContextTypes ?? {};
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance === null || typeof instance.getChildContext !== "function") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return parentContext;
  }

  // @beginner: 声明 childContext：保存当前步骤需要读取或更新的数据。
  const childContext = instance.getChildContext();
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const contextKey in childContext) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!(contextKey in childContextTypes)) {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error(
        `${getComponentNameFromFiber(fiber) ?? "Unknown"}.getChildContext(): key "${contextKey}" is not defined in childContextTypes.`,
      );
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    ...parentContext,
    ...childContext,
  };
}

// @beginner: 进入 pushContextProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pushContextProvider(workInProgress: Fiber): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as LegacyInstance | null;
  // @beginner: 声明 memoizedMergedChildContext：保存当前步骤需要读取或更新的数据。
  const memoizedMergedChildContext =
    instance?.__reactInternalMemoizedMergedChildContext ?? emptyContextObject;

  previousContext = contextStackCursor.current;
  push(contextStackCursor, memoizedMergedChildContext, workInProgress);
  push(didPerformWorkStackCursor, didPerformWorkStackCursor.current, workInProgress);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 invalidateContextProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function invalidateContextProvider(
  workInProgress: Fiber,
  type: LegacyContextProviderType,
  didChange: boolean,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as LegacyInstance | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance === null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Expected to have an instance by this point.");
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (didChange) {
    // @beginner: 声明 mergedContext：保存当前步骤需要读取或更新的数据。
    const mergedContext = processChildContext(workInProgress, type, previousContext);
    instance.__reactInternalMemoizedMergedChildContext = mergedContext;

    // 用新合并出的 childContext 替换刚才提前 push 的空/旧 context。
    pop(didPerformWorkStackCursor, workInProgress);
    pop(contextStackCursor, workInProgress);
    push(contextStackCursor, mergedContext, workInProgress);
    push(didPerformWorkStackCursor, didChange, workInProgress);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    pop(didPerformWorkStackCursor, workInProgress);
    push(didPerformWorkStackCursor, didChange, workInProgress);
  }
}

// @beginner: 进入 findCurrentUnmaskedContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findCurrentUnmaskedContext(fiber: Fiber): LegacyContext {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disableLegacyContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return emptyContextObject;
  }

  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Fiber | null = fiber;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (node.tag) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case HostRoot:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return ((node.stateNode as { context?: LegacyContext } | null)?.context ?? emptyContextObject);
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case ClassComponent: {
        // @beginner: 声明 Component：保存当前步骤需要读取或更新的数据。
        const Component = node.type as LegacyContextProviderType;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (isContextProvider(Component)) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return (
            (node.stateNode as LegacyInstance | null)?.__reactInternalMemoizedMergedChildContext ??
            emptyContextObject
          );
        }
        break;
      }
    }
    node = node.return;
  }

  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Found unexpected detached subtree parent.");
}

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  getUnmaskedContext,
  cacheContext,
  getMaskedContext,
  hasContextChanged,
  popContext,
  popTopLevelContextObject,
  pushTopLevelContextObject,
  processChildContext,
  isContextProvider,
  pushContextProvider,
  invalidateContextProvider,
  findCurrentUnmaskedContext,
};
