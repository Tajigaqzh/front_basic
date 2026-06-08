import { isArray, REACT_PORTAL_TYPE } from "shared";
import { isValidElement } from "react";
import type { Props, ReactNode } from "shared";
import { ChildDeletion, Placement, Update } from "./ReactFiberFlags.js";
import { createFiberFromElement, createFiberFromPortal, createFiberFromText, createWorkInProgress } from "./ReactFiber.js";
import type { Fiber } from "./ReactInternalTypes.js";
import { HostPortal, HostText } from "./ReactWorkTags.js";

export function reconcileChildFibers(returnFiber: Fiber, currentFirstChild: Fiber | null, newChild: ReactNode): Fiber | null {
  const newChildren = normalizeChildren(newChild);
  let oldFiber = currentFirstChild;
  let previousNewFiber: Fiber | null = null;
  let resultingFirstChild: Fiber | null = null;

  for (let newIndex = 0; newIndex < newChildren.length; newIndex += 1) {
    const child = newChildren[newIndex];
    const same = oldFiber !== null && sameType(oldFiber, child);
    let newFiber: Fiber | null = null;

    if (same && oldFiber !== null) {
      newFiber = createWorkInProgress(oldFiber, propsFromChild(child));
      newFiber.flags |= Update;
    } else {
      if (child !== null) {
        newFiber = createFiberFromNode(child);
        newFiber.flags |= Placement;
      }

      if (oldFiber !== null) {
        deleteChild(returnFiber, oldFiber);
      }
    }

    if (oldFiber !== null) {
      oldFiber = oldFiber.sibling;
    }

    if (newFiber === null) {
      continue;
    }

    newFiber.return = returnFiber;
    newFiber.index = newIndex;

    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }

    previousNewFiber = newFiber;
  }

  while (oldFiber !== null) {
    deleteChild(returnFiber, oldFiber);
    oldFiber = oldFiber.sibling;
  }

  return resultingFirstChild;
}

export function mountChildFibers(returnFiber: Fiber, newChild: ReactNode): Fiber | null {
  const mounted = reconcileChildFibers(returnFiber, null, newChild);
  let node = mounted;
  while (node !== null) {
    node.flags |= Placement;
    node = node.sibling;
  }
  return mounted;
}

export function cloneChildFibers(current: Fiber | null, workInProgress: Fiber): void {
  if (current !== null && workInProgress.child !== current.child) {
    throw new Error("Resuming work is not implemented in this TypeScript source recreation.");
  }

  if (workInProgress.child === null) {
    return;
  }

  // 官方 bailout 路径会复用 current.child 指针；一旦发现子树仍有工作，
  // 这里才逐个 clone 成 workInProgress child，避免直接修改已提交树。
  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;
  newChild.return = workInProgress;

  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
    newChild.return = workInProgress;
  }

  newChild.sibling = null;
}

function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
  returnFiber.flags |= ChildDeletion;
  if (returnFiber.deletions === null) {
    returnFiber.deletions = [childToDelete];
  } else {
    returnFiber.deletions.push(childToDelete);
  }
}

function createFiberFromNode(child: NonNullable<ReactNode>): Fiber {
  if (isValidElement(child)) {
    return createFiberFromElement(child);
  }

  if (isPortal(child)) {
    return createFiberFromPortal(child);
  }

  return createFiberFromText(child as string | number);
}

function sameType(oldFiber: Fiber, child: NonNullable<ReactNode>): boolean {
  if (isValidElement(child)) {
    return oldFiber.key === child.key && oldFiber.elementType === child.type;
  }

  if (isPortal(child)) {
    return (
      oldFiber.tag === HostPortal &&
      oldFiber.key === child.key &&
      (oldFiber.stateNode as { containerInfo?: unknown } | null)?.containerInfo === child.containerInfo
    );
  }

  return oldFiber.tag === HostText && (typeof child === "string" || typeof child === "number");
}

function propsFromChild(child: NonNullable<ReactNode>): Props {
  if (isValidElement(child)) {
    return child.props;
  }

  return { text: String(child) };
}

function isPortal(value: unknown): value is Extract<NonNullable<ReactNode>, { containerInfo: unknown }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $$typeof?: symbol }).$$typeof === REACT_PORTAL_TYPE
  );
}

function normalizeChildren(children: ReactNode): NonNullable<ReactNode>[] {
  const result: NonNullable<ReactNode>[] = [];
  appendChild(result, children);
  return result;
}

function appendChild(result: NonNullable<ReactNode>[], child: ReactNode): void {
  if (isArray(child)) {
    for (const item of child) {
      appendChild(result, item);
    }
    return;
  }

  if (child === null || child === undefined || child === false || child === true) {
    return;
  }

  result.push(child);
}
