import { disableLegacyContext } from "shared/ReactFeatureFlags.js";
import type { Fiber } from "./ReactInternalTypes.js";
import type { StackCursor } from "./ReactFiberStack.js";
import { ClassComponent, HostRoot } from "./ReactWorkTags.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";

type LegacyContext = Record<string, unknown>;
type LegacyContextProviderType = Function & {
  childContextTypes?: Record<string, unknown> | null;
  contextTypes?: Record<string, unknown> | null;
};
type LegacyInstance = {
  getChildContext?: () => LegacyContext;
  __reactInternalMemoizedUnmaskedChildContext?: LegacyContext;
  __reactInternalMemoizedMaskedChildContext?: LegacyContext;
  __reactInternalMemoizedMergedChildContext?: LegacyContext;
};

export const emptyContextObject: LegacyContext = Object.freeze({});

const contextStackCursor: StackCursor<LegacyContext> = createCursor(emptyContextObject);
const didPerformWorkStackCursor: StackCursor<boolean> = createCursor(false);
let previousContext: LegacyContext = emptyContextObject;

function getUnmaskedContext(
  workInProgress: Fiber,
  Component: LegacyContextProviderType,
  didPushOwnContextIfProvider: boolean,
): LegacyContext {
  if (disableLegacyContext) {
    return emptyContextObject;
  }

  // Provider 读取 context 时不能看到自己刚 push 的 childContext，需要回退到父级 context。
  if (didPushOwnContextIfProvider && isContextProvider(Component)) {
    return previousContext;
  }
  return contextStackCursor.current;
}

function cacheContext(workInProgress: Fiber, unmaskedContext: LegacyContext, maskedContext: LegacyContext): void {
  if (disableLegacyContext) {
    return;
  }

  const instance = workInProgress.stateNode as LegacyInstance | null;
  if (instance !== null) {
    instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
    instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
  }
}

function getMaskedContext(workInProgress: Fiber, unmaskedContext: LegacyContext): LegacyContext {
  if (disableLegacyContext) {
    return emptyContextObject;
  }

  const type = workInProgress.type as LegacyContextProviderType;
  const contextTypes = type.contextTypes;
  if (contextTypes === null || contextTypes === undefined) {
    return emptyContextObject;
  }

  const instance = workInProgress.stateNode as LegacyInstance | null;
  if (
    instance !== null &&
    instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext &&
    instance.__reactInternalMemoizedMaskedChildContext !== undefined
  ) {
    return instance.__reactInternalMemoizedMaskedChildContext;
  }

  const context: LegacyContext = {};
  for (const key in contextTypes) {
    context[key] = unmaskedContext[key];
  }

  if (instance !== null) {
    cacheContext(workInProgress, unmaskedContext, context);
  }
  return context;
}

function hasContextChanged(): boolean {
  return disableLegacyContext ? false : didPerformWorkStackCursor.current;
}

function isContextProvider(type: LegacyContextProviderType): boolean {
  if (disableLegacyContext) {
    return false;
  }
  return type.childContextTypes !== null && type.childContextTypes !== undefined;
}

function popContext(fiber: Fiber): void {
  if (disableLegacyContext) {
    return;
  }
  pop(didPerformWorkStackCursor, fiber);
  pop(contextStackCursor, fiber);
}

function popTopLevelContextObject(fiber: Fiber): void {
  popContext(fiber);
}

function pushTopLevelContextObject(fiber: Fiber, context: LegacyContext, didChange: boolean): void {
  if (disableLegacyContext) {
    return;
  }
  if (contextStackCursor.current !== emptyContextObject) {
    throw new Error("Unexpected context found on stack.");
  }

  push(contextStackCursor, context, fiber);
  push(didPerformWorkStackCursor, didChange, fiber);
}

function processChildContext(
  fiber: Fiber,
  type: LegacyContextProviderType,
  parentContext: LegacyContext,
): LegacyContext {
  if (disableLegacyContext) {
    return parentContext;
  }

  const instance = fiber.stateNode as LegacyInstance | null;
  const childContextTypes = type.childContextTypes ?? {};
  if (instance === null || typeof instance.getChildContext !== "function") {
    return parentContext;
  }

  const childContext = instance.getChildContext();
  for (const contextKey in childContext) {
    if (!(contextKey in childContextTypes)) {
      throw new Error(
        `${getComponentNameFromFiber(fiber) ?? "Unknown"}.getChildContext(): key "${contextKey}" is not defined in childContextTypes.`,
      );
    }
  }

  return {
    ...parentContext,
    ...childContext,
  };
}

function pushContextProvider(workInProgress: Fiber): boolean {
  if (disableLegacyContext) {
    return false;
  }

  const instance = workInProgress.stateNode as LegacyInstance | null;
  const memoizedMergedChildContext =
    instance?.__reactInternalMemoizedMergedChildContext ?? emptyContextObject;

  previousContext = contextStackCursor.current;
  push(contextStackCursor, memoizedMergedChildContext, workInProgress);
  push(didPerformWorkStackCursor, didPerformWorkStackCursor.current, workInProgress);
  return true;
}

function invalidateContextProvider(
  workInProgress: Fiber,
  type: LegacyContextProviderType,
  didChange: boolean,
): void {
  if (disableLegacyContext) {
    return;
  }

  const instance = workInProgress.stateNode as LegacyInstance | null;
  if (instance === null) {
    throw new Error("Expected to have an instance by this point.");
  }

  if (didChange) {
    const mergedContext = processChildContext(workInProgress, type, previousContext);
    instance.__reactInternalMemoizedMergedChildContext = mergedContext;

    // 用新合并出的 childContext 替换刚才提前 push 的空/旧 context。
    pop(didPerformWorkStackCursor, workInProgress);
    pop(contextStackCursor, workInProgress);
    push(contextStackCursor, mergedContext, workInProgress);
    push(didPerformWorkStackCursor, didChange, workInProgress);
  } else {
    pop(didPerformWorkStackCursor, workInProgress);
    push(didPerformWorkStackCursor, didChange, workInProgress);
  }
}

function findCurrentUnmaskedContext(fiber: Fiber): LegacyContext {
  if (disableLegacyContext) {
    return emptyContextObject;
  }

  let node: Fiber | null = fiber;
  while (node !== null) {
    switch (node.tag) {
      case HostRoot:
        return ((node.stateNode as { context?: LegacyContext } | null)?.context ?? emptyContextObject);
      case ClassComponent: {
        const Component = node.type as LegacyContextProviderType;
        if (isContextProvider(Component)) {
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

  throw new Error("Found unexpected detached subtree parent.");
}

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
