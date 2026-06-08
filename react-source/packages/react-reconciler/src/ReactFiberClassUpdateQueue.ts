import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import type { Lane } from "./ReactFiberLane.js";
import {
  intersectLanes,
  isSubsetOfLanes,
  isTransitionLane,
  mergeLanes,
  NoLane,
  NoLanes,
  OffscreenLane,
  removeLanes,
  SyncLane,
  type Lanes,
} from "./ReactFiberLane.js";
import { getRootForUpdatedFiber } from "./ReactFiberTreeReflection.js";
import {
  peekEntangledActionLane,
  peekEntangledActionThenable,
} from "./ReactFiberAsyncAction.js";

export interface Update<State> {
  lane: Lane;
  tag: 0 | 1 | 2 | 3;
  payload: unknown;
  callback: (() => void) | null;
  next: Update<State> | null;
}

export interface SharedQueue<State> {
  pending: Update<State> | null;
  lanes: Lanes;
}

export interface UpdateQueue<State> {
  baseState: State;
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;
  shared: SharedQueue<State>;
  callbacks: Array<() => void> | null;
}

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

let hasForceUpdate = false;
let didReadFromEntangledAsyncAction = false;

export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      lanes: NoLanes,
    },
    callbacks: null,
  };
  fiber.updateQueue = queue;
}

export function cloneUpdateQueue<State>(current: Fiber, workInProgress: Fiber): void {
  const queue = workInProgress.updateQueue as UpdateQueue<State> | null;
  const currentQueue = current.updateQueue as UpdateQueue<State> | null;

  if (queue === currentQueue && currentQueue !== null) {
    workInProgress.updateQueue = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
      callbacks: null,
    };
  }
}

export function createUpdate<State>(lane: Lane = SyncLane): Update<State> {
  return {
    lane,
    tag: UpdateState,
    payload: null,
    callback: null,
    next: null,
  };
}

export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  _lane: Lane,
): FiberRoot | null {
  const updateQueue = fiber.updateQueue as UpdateQueue<State> | null;
  if (updateQueue === null) {
    return null;
  }

  const pending = updateQueue.shared.pending;
  // 与官方一致：shared.pending 是环形单链表尾指针，插入为 O(1)。
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;

  return getRootForUpdatedFiber(fiber);
}

export function entangleTransitions<State>(
  root: FiberRoot,
  queue: UpdateQueue<State>,
  lane: Lane,
): void {
  const updateLane = removeLanes(lane, OffscreenLane);
  if (!isTransitionLane(updateLane)) {
    return;
  }

  const queueLanes = intersectLanes(queue.shared.lanes, root.pendingLanes);
  const newQueueLanes = mergeLanes(queueLanes, updateLane);
  queue.shared.lanes = newQueueLanes;
  root.entangledLanes = mergeLanes(root.entangledLanes ?? NoLanes, newQueueLanes);
}

export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: unknown,
  _instance: unknown,
  renderLanes: Lanes = NoLanes,
): void {
  const queue = workInProgress.updateQueue as UpdateQueue<State> | null;
  if (queue === null) {
    return;
  }

  hasForceUpdate = false;
  didReadFromEntangledAsyncAction = false;
  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;
  const pendingQueue = queue.shared.pending;

  if (pendingQueue !== null) {
    queue.shared.pending = null;
    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;

    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    } else {
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;
  }

  if (firstBaseUpdate !== null) {
    let newState = queue.baseState;
    let newBaseState: State | null = null;
    let newFirstBaseUpdate: Update<State> | null = null;
    let newLastBaseUpdate: Update<State> | null = null;
    let update: Update<State> | null = firstBaseUpdate;

    while (update !== null) {
      const updateLane = removeLanes(update.lane, OffscreenLane);
      const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane);

      if (shouldSkipUpdate) {
        // 与官方一致：跳过的 update 克隆进 base queue，保持原 lane 等下一轮重放。
        const clone: Update<State> = {
          lane: updateLane,
          tag: update.tag,
          payload: update.payload,
          callback: update.callback,
          next: null,
        };
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          newBaseState = newState;
        } else {
          newLastBaseUpdate.next = clone;
          newLastBaseUpdate = clone;
        }
        workInProgress.lanes = mergeLanes(workInProgress.lanes, updateLane);
      } else {
        if (newLastBaseUpdate !== null) {
          // 前面有低优先级 update 被跳过后，后续已提交 update 用 NoLane 留在队列里；
          // 这样重放时不会被再次过滤，也不会重复触发 callback。
          const clone: Update<State> = {
            lane: NoLane,
            tag: update.tag,
            payload: update.payload,
            callback: null,
            next: null,
          };
          newLastBaseUpdate.next = clone;
          newLastBaseUpdate = clone;
        }

        if (updateLane !== NoLane && updateLane === peekEntangledActionLane()) {
          didReadFromEntangledAsyncAction = true;
        }
        newState = getStateFromUpdate(update, newState, props);
        if (update.callback !== null) {
          if (queue.callbacks === null) {
            queue.callbacks = [];
          }
          queue.callbacks.push(update.callback);
        }
      }

      update = update.next;
    }

    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState as State;
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;
    workInProgress.memoizedState = newState;

    if (newLastBaseUpdate === null) {
      queue.shared.lanes = NoLanes;
    }
  }
}

export function suspendIfUpdateReadFromEntangledAsyncAction(): void {
  if (!didReadFromEntangledAsyncAction) {
    return;
  }
  const thenable = peekEntangledActionThenable();
  if (thenable !== null) {
    throw thenable;
  }
}

function getStateFromUpdate<State>(
  update: Update<State>,
  prevState: State,
  nextProps: unknown,
): State {
  switch (update.tag) {
    case ReplaceState: {
      const payload = update.payload;
      return typeof payload === "function"
        ? (payload as (state: State, props: unknown) => State)(prevState, nextProps)
        : (payload as State);
    }
    case ForceUpdate:
      hasForceUpdate = true;
      return prevState;
    case UpdateState:
    default: {
      const payload = update.payload;
      const partialState =
        typeof payload === "function"
          ? (payload as (state: State, props: unknown) => Partial<State> | null)(prevState, nextProps)
          : (payload as Partial<State> | null);

      if (partialState === null || partialState === undefined) {
        return prevState;
      }

      if (typeof prevState === "object" && prevState !== null) {
        return { ...prevState, ...partialState };
      }

      return partialState as State;
    }
  }
}

export function commitUpdateQueue<State>(
  finishedWork: Fiber,
  finishedQueue: UpdateQueue<State>,
  instance: unknown,
): void {
  const callbacks = finishedQueue.callbacks;
  if (callbacks === null) {
    return;
  }
  finishedQueue.callbacks = null;
  callbacks.forEach((callback) => callback.call(instance));
}

export function resetHasForceUpdateBeforeProcessing(): void {
  hasForceUpdate = false;
}

export function checkHasForceUpdateAfterProcessing(): boolean {
  return hasForceUpdate;
}
