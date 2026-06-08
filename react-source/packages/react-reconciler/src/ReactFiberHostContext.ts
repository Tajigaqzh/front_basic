import type { Fiber } from "./ReactInternalTypes.js";
import type { Container, HostContext, TransitionStatus } from "./ReactFiberConfig.js";
import type { StackCursor } from "./ReactFiberStack.js";
import {
  getChildHostContext,
  getRootHostContext,
  HostTransitionContext,
  isPrimaryRenderer,
  NotPendingTransition,
} from "./ReactFiberConfig.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";

const contextStackCursor: StackCursor<HostContext | null> = createCursor(null);
const contextFiberStackCursor: StackCursor<Fiber | null> = createCursor(null);
const rootInstanceStackCursor: StackCursor<Container | null> = createCursor(null);
const hostTransitionProviderCursor: StackCursor<Fiber | null> = createCursor(null);

function requiredContext<T>(context: T | null): T {
  if (context === null) {
    throw new Error("Expected host context to exist.");
  }
  return context;
}

export function getCurrentRootHostContainer(): Container | null {
  return rootInstanceStackCursor.current;
}

export function getRootHostContainer(): Container {
  return requiredContext(rootInstanceStackCursor.current);
}

export function getHostTransitionProvider(): Fiber | null {
  return hostTransitionProviderCursor.current;
}

export function getHostContext(): HostContext {
  return requiredContext(contextStackCursor.current);
}

export function pushHostContainer(fiber: Fiber, nextRootInstance: Container): void {
  push(rootInstanceStackCursor, nextRootInstance, fiber);
  push(contextFiberStackCursor, fiber, fiber);

  // 与官方一致：先压入空值，确保 getRootHostContext 抛错时 unwind 栈层级仍然匹配。
  push(contextStackCursor, null, fiber);
  const nextRootContext = getRootHostContext(nextRootInstance);
  pop(contextStackCursor, fiber);
  push(contextStackCursor, nextRootContext, fiber);
}

export function popHostContainer(fiber: Fiber): void {
  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
  pop(rootInstanceStackCursor, fiber);
}

export function pushHostContext(fiber: Fiber): void {
  const stateHook = fiber.memoizedState;
  if (stateHook !== null) {
    const transitionStatus = stateHook.memoizedState as TransitionStatus;
    if (isPrimaryRenderer) {
      HostTransitionContext._currentValue = transitionStatus;
    } else {
      HostTransitionContext._currentValue2 = transitionStatus;
    }
    push(hostTransitionProviderCursor, fiber, fiber);
  }

  const context = requiredContext(contextStackCursor.current);
  const nextContext = getChildHostContext(context, String(fiber.type));

  if (context !== nextContext) {
    push(contextFiberStackCursor, fiber, fiber);
    push(contextStackCursor, nextContext, fiber);
  }
}

export function popHostContext(fiber: Fiber): void {
  if (contextFiberStackCursor.current === fiber) {
    pop(contextStackCursor, fiber);
    pop(contextFiberStackCursor, fiber);
  }

  if (hostTransitionProviderCursor.current === fiber) {
    pop(hostTransitionProviderCursor, fiber);
    if (isPrimaryRenderer) {
      HostTransitionContext._currentValue = NotPendingTransition;
    } else {
      HostTransitionContext._currentValue2 = NotPendingTransition;
    }
  }
}
