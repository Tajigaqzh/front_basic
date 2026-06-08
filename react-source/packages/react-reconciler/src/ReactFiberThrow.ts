import type { Wakeable } from "shared";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import {
  DidCapture,
  ForceClientRender,
  Incomplete,
  NoFlags,
  ScheduleRetry,
  ShouldCapture,
} from "./ReactFiberFlags.js";
import { ClassComponent, HostRoot, SuspenseComponent, SuspenseListComponent } from "./ReactWorkTags.js";
import { mergeLanes, RetryLane, SyncLane } from "./ReactFiberLane.js";
import {
  CaptureUpdate,
  createUpdate,
  enqueueUpdate,
  type Update,
} from "./ReactFiberClassUpdateQueue.js";
import { noopSuspenseyCommitThenable } from "./ReactFiberThenable.js";
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";
import { attachPingListener } from "./ReactFiberWorkLoop.js";

interface CapturedValue<T> {
  value: T;
  source: Fiber;
  stack: string | null;
}

export function createCapturedValueAtFiber<T>(value: T, source: Fiber): CapturedValue<T> {
  const stack = value instanceof Error ? value.stack ?? null : null;
  return { value, source, stack };
}

export function createRootErrorUpdate(
  _root: FiberRoot,
  errorInfo: CapturedValue<unknown>,
  lane: Lane,
): Update<unknown> {
  const update = createUpdate<unknown>(lane);
  update.tag = CaptureUpdate;
  update.payload = null;
  update.callback = () => {
    // 官方 React 会走 error logger；这里保留提交阶段回调位置，避免吞掉错误信息。
    if (errorInfo.value instanceof Error) {
      console.error(errorInfo.value);
    }
  };
  return update;
}

export function createClassErrorUpdate(lane: Lane): Update<unknown> {
  const update = createUpdate<unknown>(lane);
  update.tag = CaptureUpdate;
  return update;
}

export function initializeClassErrorUpdate(
  update: Update<unknown>,
  root: FiberRoot,
  fiber: Fiber,
  errorInfo: CapturedValue<unknown>,
): void {
  const ctor = fiber.type as {
    getDerivedStateFromError?: (error: unknown) => unknown;
  };
  const instance = fiber.stateNode as {
    componentDidCatch?: (error: unknown, info: { componentStack: string }) => void;
  } | null;

  if (typeof ctor.getDerivedStateFromError === "function") {
    update.payload = () => ctor.getDerivedStateFromError?.(errorInfo.value);
  }

  if (instance !== null && typeof instance.componentDidCatch === "function") {
    update.callback = () => {
      instance.componentDidCatch?.(errorInfo.value, {
        componentStack: errorInfo.stack ?? "",
      });
    };
  } else {
    update.callback = createRootErrorUpdate(root, errorInfo, update.lane).callback;
  }
}

function resetSuspendedComponent(sourceFiber: Fiber): void {
  const current = sourceFiber.alternate;
  if (current !== null) {
    sourceFiber.updateQueue = current.updateQueue;
    sourceFiber.memoizedState = current.memoizedState;
    sourceFiber.lanes = current.lanes;
  }
}

function markSuspenseBoundaryShouldCapture(
  suspenseBoundary: Fiber,
  sourceFiber: Fiber,
  rootRenderLanes: Lanes,
): Fiber {
  suspenseBoundary.flags |= ShouldCapture;
  suspenseBoundary.lanes = mergeLanes(suspenseBoundary.lanes, rootRenderLanes);
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, SyncLane);
  return suspenseBoundary;
}

export function throwException(
  root: FiberRoot,
  _returnFiber: Fiber | null,
  sourceFiber: Fiber,
  value: unknown,
  rootRenderLanes: Lanes,
): boolean {
  sourceFiber.flags |= Incomplete;

  if (isWakeable(value)) {
    const wakeable = value;
    resetSuspendedComponent(sourceFiber);
    const suspenseBoundary = findNearestSuspenseBoundary(sourceFiber);

    if (suspenseBoundary !== null) {
      suspenseBoundary.flags &= ~ForceClientRender;
      markSuspenseBoundaryShouldCapture(suspenseBoundary, sourceFiber, rootRenderLanes);

      if (wakeable === noopSuspenseyCommitThenable) {
        suspenseBoundary.flags |= ScheduleRetry;
      } else {
        const retryQueue = suspenseBoundary.updateQueue as RetryQueue | null;
        if (retryQueue === null) {
          suspenseBoundary.updateQueue = new Set([wakeable]);
        } else {
          retryQueue.add(wakeable);
        }
        attachPingListener(root, wakeable, rootRenderLanes);
      }
      suspenseBoundary.lanes = mergeLanes(suspenseBoundary.lanes, RetryLane);
      return false;
    }

    root.pendingLanes = mergeLanes(root.pendingLanes, rootRenderLanes);
    attachPingListener(root, wakeable, rootRenderLanes);
    return false;
  }

  const errorInfo = createCapturedValueAtFiber(value, sourceFiber);
  const errorBoundary = findNearestErrorBoundary(sourceFiber);
  const lane = SyncLane;

  if (errorBoundary !== null) {
    errorBoundary.flags |= ShouldCapture;
    errorBoundary.lanes = mergeLanes(errorBoundary.lanes, lane);
    const update = createClassErrorUpdate(lane);
    initializeClassErrorUpdate(update, root, errorBoundary, errorInfo);
    enqueueUpdate(errorBoundary, update, lane);
    return false;
  }

  const rootFiber = root.current.alternate ?? root.current;
  rootFiber.flags = (rootFiber.flags & ~DidCapture) | ShouldCapture;
  const rootUpdate = createRootErrorUpdate(root, errorInfo, lane);
  if (rootFiber.updateQueue !== null) {
    enqueueUpdate(rootFiber, rootUpdate, lane);
  }
  return false;
}

function isWakeable(value: unknown): value is Wakeable {
  return value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";
}

function findNearestSuspenseBoundary(sourceFiber: Fiber): Fiber | null {
  let node = sourceFiber.return;
  while (node !== null) {
    if (node.tag === SuspenseComponent || node.tag === SuspenseListComponent) {
      return node;
    }
    node = node.return;
  }
  return null;
}

function findNearestErrorBoundary(sourceFiber: Fiber): Fiber | null {
  let node = sourceFiber.return;
  while (node !== null) {
    if (node.tag === ClassComponent) {
      const ctor = node.type as { getDerivedStateFromError?: unknown };
      const instance = node.stateNode as { componentDidCatch?: unknown } | null;
      if (
        typeof ctor.getDerivedStateFromError === "function" ||
        (instance !== null && typeof instance.componentDidCatch === "function")
      ) {
        return node;
      }
    }
    if (node.tag === HostRoot) {
      return null;
    }
    node = node.return;
  }
  return null;
}

export function clearSuspenseBoundaryShouldCapture(boundary: Fiber): void {
  boundary.flags &= ~ShouldCapture;
  if ((boundary.flags & DidCapture) === NoFlags) {
    boundary.updateQueue = null;
  }
}
