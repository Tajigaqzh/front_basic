import type { Wakeable } from "shared";
import type { Fiber } from "./ReactInternalTypes.js";
import type { Lane } from "./ReactFiberLane.js";
import type { TreeContext } from "./ReactFiberTreeContext.js";
import { DidCapture, NoFlags } from "./ReactFiberFlags.js";
import { SuspenseComponent, SuspenseListComponent } from "./ReactWorkTags.js";

export type SuspenseInstance = Comment;

export interface SuspenseState {
  dehydrated: SuspenseInstance | null;
  treeContext: TreeContext | null;
  retryLane: Lane;
  hydrationErrors: Array<unknown> | null;
}

export interface SuspenseListRenderState {
  isBackwards: boolean;
  rendering: Fiber | null;
  renderingStartTime: number;
  last: Fiber | null;
  tail: Fiber | null;
  tailMode: "collapsed" | "hidden" | undefined;
  treeForkCount: number;
}

export type RetryQueue = Set<Wakeable>;

const SUSPENSE_PENDING_START_DATA = "$?";
const SUSPENSE_QUEUED_START_DATA = "$~";
const SUSPENSE_FALLBACK_START_DATA = "$!";

export function isSuspenseInstancePending(instance: SuspenseInstance): boolean {
  return instance.data === SUSPENSE_PENDING_START_DATA || instance.data === SUSPENSE_QUEUED_START_DATA;
}

export function isSuspenseInstanceFallback(instance: SuspenseInstance): boolean {
  return (
    instance.data === SUSPENSE_FALLBACK_START_DATA ||
    (instance.data === SUSPENSE_PENDING_START_DATA &&
      instance.ownerDocument?.readyState !== "loading")
  );
}

export function getSuspenseInstanceFallbackErrorDetails(instance: SuspenseInstance): {
  digest?: string;
  message?: string;
  stack?: string;
  componentStack?: string;
} {
  const dataset = (instance.nextSibling as HTMLElement | null)?.dataset;
  return {
    digest: dataset?.dgst,
    message: dataset?.msg,
    stack: dataset?.stck,
    componentStack: dataset?.cstck,
  };
}

export function findFirstSuspended(row: Fiber): Fiber | null {
  let node: Fiber | null = row;

  while (node !== null) {
    if (node.tag === SuspenseComponent) {
      const state = node.memoizedState as SuspenseState | null;
      if (state !== null) {
        const dehydrated = state.dehydrated;
        if (
          dehydrated === null ||
          isSuspenseInstancePending(dehydrated) ||
          isSuspenseInstanceFallback(dehydrated)
        ) {
          return node;
        }
      }
    } else if (
      node.tag === SuspenseListComponent &&
      (node.memoizedProps?.revealOrder as string | undefined) !== "independent"
    ) {
      const didSuspend = (node.flags & DidCapture) !== NoFlags;
      if (didSuspend) {
        return node;
      }
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === row) {
      return null;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === row) {
        return null;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }

  return null;
}
