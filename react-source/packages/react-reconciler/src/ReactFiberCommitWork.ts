import {
  hideDehydratedBoundary,
  hideInstance,
  hideTextInstance,
  unhideDehydratedBoundary,
  unhideInstance,
  unhideTextInstance,
  updateProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";
import { updateFiberProps } from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
import { ChildDeletion, MutationMask, Placement, Update } from "./ReactFiberFlags.js";
import {
  ClassComponent,
  DehydratedFragment,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from "./ReactWorkTags.js";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import {
  commitHookLayoutEffects,
  commitHookLayoutUnmountEffects,
  commitHookPassiveMountEffects,
  commitHookPassiveUnmountEffects,
} from "./ReactFiberCommitEffects.js";
import { commitUpdateQueue, type UpdateQueue } from "./ReactFiberClassUpdateQueue.js";
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";
import { resolveRetryWakeable } from "./ReactFiberWorkLoop.js";

export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber): void {
  recursivelyTraverseMutationEffects(root, finishedWork);
}

function recursivelyTraverseMutationEffects(root: FiberRoot, parentFiber: Fiber): void {
  if (parentFiber.flags & ChildDeletion) {
    commitChildDeletionEffects(root, parentFiber);
  }

  if (!(parentFiber.tag === OffscreenComponent && parentFiber.memoizedState !== null)) {
    let child = parentFiber.child;
    while (child !== null) {
      if ((child.subtreeFlags & MutationMask) !== 0 || (child.flags & MutationMask) !== 0) {
        recursivelyTraverseMutationEffects(root, child);
      }
      child = child.sibling;
    }
  }

  commitReconciliationEffects(parentFiber);
}

function commitReconciliationEffects(finishedWork: Fiber): void {
  if (finishedWork.flags & ChildDeletion) {
    commitChildDeletionEffects(null, finishedWork);
  }

  if (finishedWork.flags & Placement) {
    if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
      commitPlacement(finishedWork);
    }
    finishedWork.flags &= ~Placement;
  }

  if (finishedWork.flags & Update) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }

  if (finishedWork.tag === ClassComponent && finishedWork.updateQueue !== null) {
    commitUpdateQueue(
      finishedWork,
      finishedWork.updateQueue as UpdateQueue<unknown>,
      finishedWork.stateNode,
    );
  }

  if (finishedWork.tag === SuspenseComponent && finishedWork.updateQueue !== null) {
    attachSuspenseRetryListeners(finishedWork, finishedWork.updateQueue as RetryQueue);
  }

  if (finishedWork.tag === OffscreenComponent) {
    commitOffscreenVisibility(finishedWork);
  }

  commitHookLayoutEffects(finishedWork);
  commitHookPassiveMountEffects(finishedWork);
}

function commitOffscreenVisibility(finishedWork: Fiber): void {
  const wasHidden = finishedWork.alternate?.memoizedState !== null;
  const isHidden = finishedWork.memoizedState !== null;

  if (wasHidden === isHidden) {
    return;
  }

  if (isHidden) {
    hideOrUnhideAllChildren(finishedWork, true);
  } else {
    hideOrUnhideAllChildren(finishedWork, false);
  }
}

function hideOrUnhideAllChildren(fiber: Fiber, isHidden: boolean): void {
  let child = fiber.child;
  while (child !== null) {
    hideOrUnhideAllChildrenOnFiber(child, isHidden);
    child = child.sibling;
  }
}

function hideOrUnhideAllChildrenOnFiber(fiber: Fiber, isHidden: boolean): void {
  switch (fiber.tag) {
    case HostComponent: {
      const instance = fiber.stateNode as Element | null;
      if (instance !== null) {
        if (!isHidden) {
          ensureHostNodeMounted(fiber, instance);
          unhideInstance(instance, fiber.pendingProps);
        } else {
          hideInstance(instance);
        }
      }
      hideOrUnhideNearestPortals(fiber, isHidden);
      return;
    }
    case HostText: {
      const instance = fiber.stateNode as Text | null;
      if (instance !== null) {
        if (!isHidden) {
          ensureHostNodeMounted(fiber, instance);
          unhideTextInstance(instance, String(fiber.pendingProps.text ?? ""));
        } else {
          hideTextInstance(instance);
        }
      }
      return;
    }
    case DehydratedFragment: {
      const instance = fiber.stateNode as Comment | null;
      if (instance !== null) {
        if (isHidden) {
          hideDehydratedBoundary(instance);
        } else {
          unhideDehydratedBoundary(instance);
        }
      }
      return;
    }
    case HostPortal:
      hideOrUnhideAllChildren(fiber, isHidden);
      return;
    case OffscreenComponent:
      if (fiber.memoizedState !== null) {
        return;
      }
      hideOrUnhideAllChildren(fiber, isHidden);
      return;
    default:
      hideOrUnhideAllChildren(fiber, isHidden);
  }
}

function hideOrUnhideNearestPortals(parentFiber: Fiber, isHidden: boolean): void {
  let child = parentFiber.child;
  while (child !== null) {
    if (child.tag === HostPortal) {
      hideOrUnhideAllChildren(child, isHidden);
    } else if (child.tag === OffscreenComponent) {
      if (child.memoizedState === null) {
        hideOrUnhideNearestPortals(child, isHidden);
      }
    } else {
      hideOrUnhideNearestPortals(child, isHidden);
    }
    child = child.sibling;
  }
}

function ensureHostNodeMounted(fiber: Fiber, node: Node): void {
  if (node.parentNode !== null) {
    return;
  }
  const parent = getHostParentFiber(fiber);
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);
  parentNode.appendChild(node);
}

function attachSuspenseRetryListeners(finishedWork: Fiber, wakeables: RetryQueue): void {
  let retryCache = finishedWork.suspenseRetryCache;
  if (retryCache === undefined) {
    retryCache = finishedWork.suspenseRetryCache = new WeakSet();
  }

  wakeables.forEach((wakeable) => {
    if (retryCache.has(wakeable)) {
      return;
    }
    retryCache.add(wakeable);
    // Suspense commit 阶段保存的 retryQueue 会在 wakeable settle 后重新调度边界。
    // WeakSet 与官方 retry cache 目的相同：同一 thenable 多次 commit 时只注册一次 listener。
    const retry = () => resolveRetryWakeable(finishedWork, wakeable);
    wakeable.then(retry, retry);
  });
}

function commitChildDeletionEffects(root: FiberRoot | null, parentFiber: Fiber): void {
  const deletions = parentFiber.deletions ?? [];
  for (const childToDelete of deletions) {
    commitDeletionEffects(root, parentFiber, childToDelete);
  }
  parentFiber.deletions = null;
  parentFiber.flags &= ~ChildDeletion;
}

function commitPlacement(finishedWork: Fiber): void {
  const parent = getHostParentFiber(finishedWork);
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);
  const node = getHostSiblingOrSelf(finishedWork);

  if (node !== null) {
    parentNode.appendChild(node);
  }
}

function commitUpdate(finishedWork: Fiber): void {
  if (finishedWork.tag === HostComponent && finishedWork.stateNode instanceof Element) {
    updateProperties(
      finishedWork.stateNode,
      String(finishedWork.type),
      finishedWork.alternate?.memoizedProps ?? {},
      finishedWork.pendingProps,
    );
    updateFiberProps(finishedWork.stateNode, finishedWork.pendingProps);
  }

  if (finishedWork.tag === HostText && finishedWork.stateNode instanceof Text) {
    const nextText = String(finishedWork.pendingProps.text ?? "");
    if (finishedWork.stateNode.nodeValue !== nextText) {
      finishedWork.stateNode.nodeValue = nextText;
    }
  }
}

function commitDeletionEffects(_root: FiberRoot | null, nearestMountedAncestor: Fiber, deletedFiber: Fiber): void {
  const parent = getHostParentFiber(nearestMountedAncestor);
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);

  recursivelyDeleteHostNodes(parentNode, deletedFiber);
}

function recursivelyDeleteHostNodes(parentNode: Node, fiber: Fiber): void {
  commitHookLayoutUnmountEffects(fiber);
  commitHookPassiveUnmountEffects(fiber);

  if (fiber.tag === HostPortal) {
    const portalContainer = (fiber.stateNode as { containerInfo: Node }).containerInfo;
    let child = fiber.child;
    while (child !== null) {
      recursivelyDeleteHostNodes(portalContainer, child);
      child = child.sibling;
    }
    return;
  }

  if (fiber.tag === HostComponent || fiber.tag === HostText) {
    const node = fiber.stateNode as Node | null;
    if (node !== null) {
      const actualParent = node.parentNode;
      if (actualParent !== null) {
        actualParent.removeChild(node);
      } else if (parentNode.contains?.(node)) {
        parentNode.removeChild(node);
      }
    }
    return;
  }

  let child = fiber.child;
  while (child !== null) {
    recursivelyDeleteHostNodes(parentNode, child);
    child = child.sibling;
  }
}

function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;

  while (parent !== null) {
    if (parent.tag === HostComponent || parent.tag === HostRoot || parent.tag === HostPortal) {
      return parent;
    }
    parent = parent.return;
  }

  throw new Error("Expected to find a host parent.");
}

function getHostSiblingOrSelf(fiber: Fiber): Node | null {
  if (fiber.tag === OffscreenComponent && fiber.memoizedState !== null) {
    return null;
  }

  if (fiber.tag === HostComponent || fiber.tag === HostText) {
    return fiber.stateNode as Node | null;
  }

  let child = fiber.child;
  while (child !== null) {
    const node = getHostSiblingOrSelf(child);
    if (node !== null) {
      return node;
    }
    child = child.sibling;
  }

  return null;
}
