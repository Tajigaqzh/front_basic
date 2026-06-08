import type { Fiber } from "./ReactInternalTypes.js";
import type { StackCursor } from "./ReactFiberStack.js";
import type { SuspenseState } from "./ReactFiberSuspenseComponent.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";
import { isCurrentTreeHidden } from "./ReactFiberHiddenContext.js";
import { OffscreenComponent } from "./ReactWorkTags.js";

const suspenseHandlerStackCursor: StackCursor<Fiber | null> = createCursor(null);
let shellBoundary: Fiber | null = null;

export function getShellBoundary(): Fiber | null {
  return shellBoundary;
}

export function pushPrimaryTreeSuspenseHandler(handler: Fiber): void {
  push(
    suspenseStackCursor,
    setDefaultShallowSuspenseListContext(suspenseStackCursor.current),
    handler,
  );
  push(suspenseHandlerStackCursor, handler, handler);

  if (shellBoundary === null) {
    const current = handler.alternate;
    if (current === null || isCurrentTreeHidden()) {
      shellBoundary = handler;
    } else {
      const previousState = current.memoizedState as SuspenseState | null;
      if (previousState !== null) {
        shellBoundary = handler;
      }
    }
  }
}

export function pushFallbackTreeSuspenseHandler(fiber: Fiber): void {
  reuseSuspenseHandlerOnStack(fiber);
}

export function pushDehydratedActivitySuspenseHandler(fiber: Fiber): void {
  push(suspenseStackCursor, suspenseStackCursor.current, fiber);
  push(suspenseHandlerStackCursor, fiber, fiber);
  if (shellBoundary === null) {
    shellBoundary = fiber;
  }
}

export function pushOffscreenSuspenseHandler(fiber: Fiber): void {
  if (fiber.tag === OffscreenComponent) {
    push(suspenseStackCursor, suspenseStackCursor.current, fiber);
    push(suspenseHandlerStackCursor, fiber, fiber);
    if (shellBoundary === null) {
      shellBoundary = fiber;
    }
  } else {
    reuseSuspenseHandlerOnStack(fiber);
  }
}

export function reuseSuspenseHandlerOnStack(fiber: Fiber): void {
  push(suspenseStackCursor, suspenseStackCursor.current, fiber);
  push(suspenseHandlerStackCursor, getSuspenseHandler(), fiber);
}

export function getSuspenseHandler(): Fiber | null {
  return suspenseHandlerStackCursor.current;
}

export function popSuspenseHandler(fiber: Fiber): void {
  pop(suspenseHandlerStackCursor, fiber);
  if (shellBoundary === fiber) {
    shellBoundary = null;
  }
  pop(suspenseStackCursor, fiber);
}

export type SuspenseContext = number;
export type SubtreeSuspenseContext = number;
export type ShallowSuspenseContext = number;

const DefaultSuspenseContext: SuspenseContext = 0b00;
const SubtreeSuspenseContextMask: SuspenseContext = 0b01;
export const ForceSuspenseFallback: ShallowSuspenseContext = 0b10;

export const suspenseStackCursor: StackCursor<SuspenseContext> = createCursor(DefaultSuspenseContext);

export function hasSuspenseListContext(parentContext: SuspenseContext, flag: SuspenseContext): boolean {
  return (parentContext & flag) !== 0;
}

export function setDefaultShallowSuspenseListContext(parentContext: SuspenseContext): SuspenseContext {
  return parentContext & SubtreeSuspenseContextMask;
}

export function setShallowSuspenseListContext(
  parentContext: SuspenseContext,
  shallowContext: ShallowSuspenseContext,
): SuspenseContext {
  return (parentContext & SubtreeSuspenseContextMask) | shallowContext;
}

export function pushSuspenseListContext(fiber: Fiber, newContext: SuspenseContext): void {
  push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current, fiber);
  push(suspenseStackCursor, newContext, fiber);
}

export function pushSuspenseListCatch(fiber: Fiber, newContext: SuspenseContext): void {
  push(suspenseHandlerStackCursor, fiber, fiber);
  push(suspenseStackCursor, newContext, fiber);
  if (shellBoundary === null) {
    shellBoundary = fiber;
  }
}

export function popSuspenseListContext(fiber: Fiber): void {
  pop(suspenseStackCursor, fiber);
  pop(suspenseHandlerStackCursor, fiber);
  if (shellBoundary === fiber) {
    shellBoundary = null;
  }
}
