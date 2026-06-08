import type { ReactElement, Wakeable } from "shared";
import ReactSharedInternals from "shared/ReactSharedInternals.js";
import { createWorkInProgress } from "./ReactFiber.js";
import {
  mergeLanes,
  NoLane,
  NoLanes,
  OffscreenLane,
  RetryLane,
  SyncLane,
  type Lane,
  type Lanes,
} from "./ReactFiberLane.js";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import { beginWork } from "./ReactFiberBeginWork.js";
import { completeWork } from "./ReactFiberCompleteWork.js";
import { commitMutationEffects } from "./ReactFiberCommitWork.js";
import { ensureRootIsScheduled, requestTransitionLane } from "./ReactFiberRootScheduler.js";
import { isCurrentTreeHidden } from "./ReactFiberHiddenContext.js";
import { peekEntangledActionLane } from "./ReactFiberAsyncAction.js";

let workInProgressRoot: FiberRoot | null = null;
let workInProgress: Fiber | null = null;
let workInProgressRootRenderLanes: Lanes = NoLanes;
let workInProgressTransitions: unknown[] | null = null;

export function requestUpdateLane(): Lane {
  const transition = ReactSharedInternals.T;
  let lane: Lane;
  if (transition !== null) {
    lane = requestTransitionLane(transition);
  } else {
    const entangledActionLane = peekEntangledActionLane();
    lane = entangledActionLane !== NoLane ? entangledActionLane : SyncLane;
  }
  return isCurrentTreeHidden() ? mergeLanes(lane, OffscreenLane) : lane;
}

export function scheduleUpdateOnFiber(sourceFiber: Fiber, lane: Lane = SyncLane): void {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  if (sourceFiber.alternate !== null) {
    sourceFiber.alternate.lanes = mergeLanes(sourceFiber.alternate.lanes, lane);
  }

  let node = sourceFiber;
  while (node.return !== null) {
    const parent = node.return;
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    if (parent.alternate !== null) {
      parent.alternate.childLanes = mergeLanes(parent.alternate.childLanes, lane);
    }
    node = node.return;
  }
  const root = node.stateNode as FiberRoot;
  root.pendingLanes |= lane;
  ensureRootIsScheduled(root);
}

export function attachPingListener(root: FiberRoot, wakeable: Wakeable, lanes: Lanes): void {
  let pingCache = root.pingCache;
  if (pingCache === undefined) {
    pingCache = root.pingCache = new WeakMap();
  }

  let threadIDs = pingCache.get(wakeable);
  if (threadIDs === undefined) {
    threadIDs = new Set();
    pingCache.set(wakeable, threadIDs);
  }

  if (!threadIDs.has(lanes)) {
    threadIDs.add(lanes);
    const ping = () => pingSuspendedRoot(root, wakeable, lanes);
    wakeable.then(ping, ping);
  }
}

function pingSuspendedRoot(root: FiberRoot, wakeable: Wakeable, pingedLanes: Lanes): void {
  root.pingCache?.delete(wakeable);
  markRootPinged(root, pingedLanes);
  ensureRootIsScheduled(root);
}

export function markRootPinged(root: FiberRoot, pingedLanes: Lanes): void {
  root.pingedLanes = mergeLanes(root.pingedLanes ?? NoLanes, pingedLanes);
  root.pendingLanes = mergeLanes(root.pendingLanes, pingedLanes);
}

export function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable): void {
  const root = getRootForRetryFiber(boundaryFiber);
  if (root === null) {
    return;
  }
  root.pingCache?.delete(wakeable);
  scheduleUpdateOnFiber(boundaryFiber, RetryLane);
}

export function updateContainer(element: ReactElement | null | undefined, container: FiberRoot): void {
  container.current.pendingProps = { children: element ?? null };
  scheduleUpdateOnFiber(container.current, SyncLane);
}

export function performConcurrentWorkOnRoot(root: FiberRoot): void {
  const lanes = root.pendingLanes === NoLanes ? SyncLane : root.pendingLanes;
  renderRootSync(root, lanes);
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  commitRoot(root);
}

export function performSyncWorkOnRoot(root: FiberRoot): void {
  performConcurrentWorkOnRoot(root);
}

function renderRootSync(root: FiberRoot, renderLanes: Lanes): void {
  prepareFreshStack(root, renderLanes);

  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function prepareFreshStack(root: FiberRoot, renderLanes: Lanes): void {
  workInProgressRoot = root;
  workInProgressRootRenderLanes = renderLanes;
  workInProgress = createWorkInProgress(root.current, root.current.pendingProps);
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, workInProgressRootRenderLanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork: Fiber | null = unitOfWork;

  do {
    const current = completedWork.alternate;
    completeWork(current, completedWork);

    const sibling = completedWork.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }

    completedWork = completedWork.return;
    workInProgress = completedWork;
  } while (completedWork !== null);
}

function commitRoot(root: FiberRoot): void {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }

  root.finishedWork = null;
  commitMutationEffects(root, finishedWork);
  root.current = finishedWork;
  root.pendingLanes = 0;
  root.pingedLanes = NoLanes;
  root.entangledLanes = NoLanes;
  root.callbackNode = null;
  root.callbackPriority = 0;
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;
}

function getRootForRetryFiber(sourceFiber: Fiber): FiberRoot | null {
  let node = sourceFiber;
  while (node.return !== null) {
    node = node.return;
  }
  return node.stateNode as FiberRoot | null;
}

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

export function getWorkInProgressTransitions(): unknown[] | null {
  return workInProgressTransitions;
}

export function markTransitionStarted(): void {
  if (workInProgressTransitions === null) {
    workInProgressTransitions = [];
  }
}

export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: unknown,
): void {
  const target = nearestMountedAncestor ?? sourceFiber;
  target.updateQueue = error;
}
