import type { ReactContext } from "shared";
import { objectIs } from "shared";
import type { ContextDependency, Dependencies, Fiber } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import type { StackCursor } from "./ReactFiberStack.js";
import { HostTransitionContext, isPrimaryRenderer } from "./ReactFiberConfig.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";
import { ContextProvider } from "./ReactWorkTags.js";
import { DidPropagateContext, NeedsPropagation, NoFlags } from "./ReactFiberFlags.js";
import { isSubsetOfLanes, mergeLanes, NoLanes } from "./ReactFiberLane.js";
import { getHostTransitionProvider } from "./ReactFiberHostContext.js";

const valueCursor: StackCursor<unknown> = createCursor(null);
let currentlyRenderingFiber: Fiber | null = null;
let lastContextDependency: ContextDependency | null = null;

export function resetContextDependencies(): void {
  currentlyRenderingFiber = null;
  lastContextDependency = null;
}

export function prepareToReadContext(workInProgress: Fiber, _renderLanes: Lanes): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;

  const dependencies = workInProgress.dependencies;
  if (dependencies !== null) {
    dependencies.firstContext = null;
  }
}

export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T,
): void {
  if (isPrimaryRenderer) {
    push(valueCursor, context._currentValue, providerFiber);
    context._currentValue = nextValue;
  } else {
    push(valueCursor, context._currentValue2, providerFiber);
    context._currentValue2 = nextValue;
  }
}

export function popProvider(context: ReactContext<unknown>, providerFiber: Fiber): void {
  const currentValue = valueCursor.current;

  if (isPrimaryRenderer) {
    context._currentValue = currentValue;
  } else {
    context._currentValue2 = currentValue;
  }

  pop(valueCursor, providerFiber);
}

export function scheduleContextWorkOnParentPath(
  parent: Fiber | null,
  renderLanes: Lanes,
  propagationRoot: Fiber,
): void {
  let node = parent;
  while (node !== null) {
    const alternate = node.alternate;
    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
      node.childLanes = mergeLanes(node.childLanes, renderLanes);
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
      }
    } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLanes)) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
    }

    if (node === propagationRoot) {
      break;
    }
    node = node.return;
  }
}

export function propagateContextChange<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes,
): void {
  propagateContextChanges(workInProgress, [context], renderLanes, true);
}

function propagateContextChanges(
  workInProgress: Fiber,
  contexts: Array<ReactContext<unknown>>,
  renderLanes: Lanes,
  forcePropagateEntireTree: boolean,
): void {
  let fiber = workInProgress.child;
  if (fiber !== null) {
    fiber.return = workInProgress;
  }

  while (fiber !== null) {
    let nextFiber: Fiber | null = fiber.child;
    const dependencies = fiber.dependencies;

    if (dependencies !== null) {
      let dependency = dependencies.firstContext;
      while (dependency !== null) {
        if (contexts.includes(dependency.context)) {
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
          if (fiber.alternate !== null) {
            fiber.alternate.lanes = mergeLanes(fiber.alternate.lanes, renderLanes);
          }
          scheduleContextWorkOnParentPath(fiber.return, renderLanes, workInProgress);
          if (!forcePropagateEntireTree) {
            nextFiber = null;
          }
          break;
        }
        dependency = dependency.next;
      }
    }

    if (nextFiber !== null) {
      nextFiber.return = fiber;
      fiber = nextFiber;
      continue;
    }

    while (fiber !== null) {
      if (fiber === workInProgress) {
        return;
      }
      if (fiber.sibling !== null) {
        fiber.sibling.return = fiber.return;
        fiber = fiber.sibling;
        break;
      }
      fiber = fiber.return;
    }
  }
}

export function lazilyPropagateParentContextChanges(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): boolean {
  return propagateParentContextChanges(current, workInProgress, renderLanes, false);
}

export function propagateParentContextChangesToDeferredTree(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): void {
  propagateParentContextChanges(current, workInProgress, renderLanes, true);
}

function propagateParentContextChanges(
  _current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
  forcePropagateEntireTree: boolean,
): boolean {
  let contexts: Array<ReactContext<unknown>> | null = null;
  let parent: Fiber | null = workInProgress;
  let isInsidePropagationBailout = false;

  while (parent !== null) {
    if (!isInsidePropagationBailout) {
      if ((parent.flags & NeedsPropagation) !== NoFlags) {
        isInsidePropagationBailout = true;
      } else if ((parent.flags & DidPropagateContext) !== NoFlags) {
        break;
      }
    }

    if (parent.tag === ContextProvider) {
      const currentParent = parent.alternate;
      if (currentParent !== null) {
        const oldProps = currentParent.memoizedProps;
        const newProps = parent.pendingProps;
        if (oldProps !== null && !objectIs(newProps.value, oldProps.value)) {
          const context = (parent.type as { _context?: ReactContext<unknown> })._context;
          if (context !== undefined) {
            contexts = contexts === null ? [context] : [...contexts, context];
          }
        }
      }
    } else if (parent === getHostTransitionProvider() && parent.alternate !== null) {
      contexts = contexts === null ? [HostTransitionContext] : [...contexts, HostTransitionContext];
    }

    parent = parent.return;
  }

  if (contexts !== null) {
    propagateContextChanges(workInProgress, contexts, renderLanes, forcePropagateEntireTree);
  }

  workInProgress.flags |= DidPropagateContext;
  return contexts !== null;
}

export function checkIfContextChanged(currentDependencies: Dependencies): boolean {
  let dependency = currentDependencies.firstContext;
  while (dependency !== null) {
    const context = dependency.context;
    const newValue = isPrimaryRenderer ? context._currentValue : context._currentValue2;
    if (!objectIs(newValue, dependency.memoizedValue)) {
      return true;
    }
    dependency = dependency.next;
  }
  return false;
}

export function readContext<T>(context: ReactContext<T>): T {
  return readContextForConsumer(currentlyRenderingFiber, context);
}

export function readContextDuringReconciliation<T>(
  consumer: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes,
): T {
  if (currentlyRenderingFiber === null) {
    prepareToReadContext(consumer, renderLanes);
  }
  return readContextForConsumer(consumer, context);
}

function readContextForConsumer<T>(consumer: Fiber | null, context: ReactContext<T>): T {
  const value = isPrimaryRenderer ? context._currentValue : context._currentValue2;
  const contextItem: ContextDependency<T> = {
    context,
    memoizedValue: value,
    next: null,
  };

  if (lastContextDependency === null) {
    if (consumer === null) {
      throw new Error("Context can only be read while React is rendering.");
    }

    lastContextDependency = contextItem;
    consumer.dependencies = {
      lanes: NoLanes,
      firstContext: contextItem,
    };
    consumer.flags |= NeedsPropagation;
  } else {
    lastContextDependency = lastContextDependency.next = contextItem;
  }

  return value;
}
