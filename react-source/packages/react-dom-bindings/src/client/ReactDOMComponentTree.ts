import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { Props } from "shared";

const internalInstanceKey = "__reactFiber$frontSource";
const internalPropsKey = "__reactProps$frontSource";
const internalContainerKey = "__reactContainer$frontSource";
const internalScrollTimerKey = "__reactScrollEndTimer$frontSource";

type NodeWithReactInternals = Node & {
  [internalInstanceKey]?: Fiber;
  [internalPropsKey]?: Props;
  [internalContainerKey]?: true;
  [internalScrollTimerKey]?: ReturnType<typeof setTimeout> | null;
};

export function precacheFiberNode(hostInst: Fiber, node: Node): void {
  (node as NodeWithReactInternals)[internalInstanceKey] = hostInst;
}

export function getClosestInstanceFromNode(targetNode: Node): Fiber | null {
  let node: Node | null = targetNode;
  while (node !== null) {
    const inst = (node as NodeWithReactInternals)[internalInstanceKey];
    if (inst !== undefined) {
      return inst;
    }
    node = node.parentNode;
  }
  return null;
}

export function getInstanceFromNode(node: Node): Fiber | null {
  return (node as NodeWithReactInternals)[internalInstanceKey] ?? null;
}

export function getNodeFromInstance(inst: Fiber): Node {
  return inst.stateNode as Node;
}

export function updateFiberProps(node: Node, props: Props): void {
  (node as NodeWithReactInternals)[internalPropsKey] = props;
}

export function getFiberCurrentPropsFromNode(node: Node): Props | null {
  return (node as NodeWithReactInternals)[internalPropsKey] ?? null;
}

export function markContainerAsRoot(_hostRoot: Fiber, node: Node): void {
  (node as NodeWithReactInternals)[internalContainerKey] = true;
}

export function unmarkContainerAsRoot(node: Node): void {
  delete (node as NodeWithReactInternals)[internalContainerKey];
}

export function isContainerMarkedAsRoot(node: Node): boolean {
  return (node as NodeWithReactInternals)[internalContainerKey] === true;
}

export function getScrollEndTimer(target: EventTarget): ReturnType<typeof setTimeout> | null {
  return (target as NodeWithReactInternals)[internalScrollTimerKey] ?? null;
}

export function setScrollEndTimer(
  target: EventTarget,
  timer: ReturnType<typeof setTimeout>,
): void {
  (target as NodeWithReactInternals)[internalScrollTimerKey] = timer;
}

export function clearScrollEndTimer(target: EventTarget): void {
  const current = getScrollEndTimer(target);
  if (current !== null) {
    clearTimeout(current);
  }
  (target as NodeWithReactInternals)[internalScrollTimerKey] = null;
}
