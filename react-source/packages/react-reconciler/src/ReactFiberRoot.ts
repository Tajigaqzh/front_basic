import { NoLane, NoLanes } from "./ReactFiberLane.js";
import { createHostRootFiber } from "./ReactFiber.js";
import type { FiberRoot } from "./ReactInternalTypes.js";

export function createFiberRoot(containerInfo: Element | DocumentFragment): FiberRoot {
  const uninitializedFiber = createHostRootFiber();
  const root: FiberRoot = {
    containerInfo,
    current: uninitializedFiber,
    finishedWork: null,
    pendingLanes: NoLanes,
    pingedLanes: NoLanes,
    pingCache: new WeakMap(),
    callbackNode: null,
    callbackPriority: NoLane,
    next: null,
  };

  uninitializedFiber.stateNode = root;
  return root;
}
