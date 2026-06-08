import { HostComponent, HostRoot, HostText, OffscreenComponent } from "./ReactWorkTags.js";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";

export function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot {
  let node = sourceFiber;
  while (node.return !== null) {
    node = node.return;
  }

  if (node.tag !== HostRoot || node.stateNode === null) {
    throw new Error("Unable to find root from updated Fiber.");
  }

  return node.stateNode as FiberRoot;
}

function findFirstHostSibling(fiber: Fiber | null): Fiber | null {
  let node = fiber;

  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      return node;
    }

    if (!(node.tag === OffscreenComponent && node.memoizedState !== null) && node.child !== null) {
      const child = findFirstHostSibling(node.child);
      if (child !== null) {
        return child;
      }
    }

    node = node.sibling;
  }

  return null;
}

export function getNextSiblingHostFiber(fiber: Fiber): Fiber | null {
  return findFirstHostSibling(fiber.sibling);
}
