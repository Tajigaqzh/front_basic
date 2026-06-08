import {
  getFiberCurrentPropsFromNode,
  getInstanceFromNode,
} from "../client/ReactDOMComponentTree.js";
import { restoreControlledState } from "../client/ReactDOMComponent.js";

let restoreTarget: Node | null = null;
let restoreQueue: Node[] | null = null;

export function enqueueStateRestore(target: Node | null): void {
  if (target === null) {
    return;
  }
  if (restoreTarget !== null) {
    if (restoreQueue !== null) {
      restoreQueue.push(target);
    } else {
      restoreQueue = [target];
    }
  } else {
    restoreTarget = target;
  }
}

export function needsStateRestore(): boolean {
  return restoreTarget !== null || restoreQueue !== null;
}

export function restoreStateIfNeeded(): void {
  if (restoreTarget === null) {
    return;
  }

  const target = restoreTarget;
  const queuedTargets = restoreQueue;
  restoreTarget = null;
  restoreQueue = null;

  restoreStateOfTarget(target);
  if (queuedTargets !== null) {
    for (let i = 0; i < queuedTargets.length; i += 1) {
      restoreStateOfTarget(queuedTargets[i]);
    }
  }
}

function restoreStateOfTarget(target: Node): void {
  // 事件结束后再取一次 DOM -> Fiber，保证拿到当前树上的实例。
  const internalInstance = getInstanceFromNode(target);
  if (internalInstance === null) {
    return;
  }

  const stateNode = internalInstance.stateNode;
  if (stateNode !== null && typeof stateNode === "object") {
    const props = getFiberCurrentPropsFromNode(stateNode as Node);
    restoreControlledState(stateNode as Element, String(internalInstance.type), props);
  }
}
