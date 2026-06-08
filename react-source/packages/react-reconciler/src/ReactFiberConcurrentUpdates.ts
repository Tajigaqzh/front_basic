import type { Fiber, FiberRoot, Update as HookUpdate, UpdateQueue as HookQueue } from "./ReactInternalTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import { NoLane, NoLanes, mergeLanes } from "./ReactFiberLane.js";
import { HostRoot } from "./ReactWorkTags.js";
import type {
  SharedQueue as ClassQueue,
  Update as ClassUpdate,
} from "./ReactFiberClassUpdateQueue.js";
import { getRootForUpdatedFiber } from "./ReactFiberTreeReflection.js";

export interface ConcurrentUpdate {
  next: ConcurrentUpdate | null;
  lane: Lane;
}

interface ConcurrentQueue {
  pending: ConcurrentUpdate | null;
}

const concurrentQueues: unknown[] = [];
let concurrentQueuesIndex = 0;
let concurrentlyUpdatedLanes: Lanes = NoLanes;

export function finishQueueingConcurrentUpdates(): void {
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;
  concurrentlyUpdatedLanes = NoLanes;

  let i = 0;
  while (i < endIndex) {
    const fiber = concurrentQueues[i++] as Fiber;
    const queue = concurrentQueues[i++] as ConcurrentQueue | null;
    const update = concurrentQueues[i++] as ConcurrentUpdate | null;
    const lane = concurrentQueues[i++] as Lane;

    if (queue !== null && update !== null) {
      const pending = queue.pending;
      // 官方结构：pending 指向环形链表尾节点，新 update 插到尾节点后面。
      if (pending === null) {
        update.next = update;
      } else {
        update.next = pending.next;
        pending.next = update;
      }
      queue.pending = update;
    }

    if (lane !== NoLane) {
      markUpdateLaneFromFiberToRoot(fiber, lane);
    }
  }
}

export function getConcurrentlyUpdatedLanes(): Lanes {
  return concurrentlyUpdatedLanes;
}

function enqueueUpdate(
  fiber: Fiber,
  queue: ConcurrentQueue | null,
  update: ConcurrentUpdate | null,
  lane: Lane,
): void {
  concurrentQueues[concurrentQueuesIndex++] = fiber;
  concurrentQueues[concurrentQueuesIndex++] = queue;
  concurrentQueues[concurrentQueuesIndex++] = update;
  concurrentQueues[concurrentQueuesIndex++] = lane;

  concurrentlyUpdatedLanes = mergeLanes(concurrentlyUpdatedLanes, lane);
  fiber.lanes = mergeLanes(fiber.lanes, lane);
  if (fiber.alternate !== null) {
    fiber.alternate.lanes = mergeLanes(fiber.alternate.lanes, lane);
  }
}

export function enqueueConcurrentHookUpdate<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
  lane: Lane,
): FiberRoot | null {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, lane);
  return getRootForUpdatedFiber(fiber);
}

export function enqueueConcurrentHookUpdateAndEagerlyBailout<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
): void {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, NoLane);
  finishQueueingConcurrentUpdates();
}

export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane,
): FiberRoot | null {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, lane);
  return getRootForUpdatedFiber(fiber);
}

export function enqueueConcurrentRenderForLane(fiber: Fiber, lane: Lane): FiberRoot | null {
  enqueueUpdate(fiber, null, null, lane);
  return getRootForUpdatedFiber(fiber);
}

export function unsafe_markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | null {
  return markUpdateLaneFromFiberToRoot(sourceFiber, lane);
}

export function markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | null {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  if (sourceFiber.alternate !== null) {
    sourceFiber.alternate.lanes = mergeLanes(sourceFiber.alternate.lanes, lane);
  }

  let node = sourceFiber;
  let parent = sourceFiber.return;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    if (parent.alternate !== null) {
      parent.alternate.childLanes = mergeLanes(parent.alternate.childLanes, lane);
    }
    node = parent;
    parent = parent.return;
  }

  if (node.tag !== HostRoot || node.stateNode === null) {
    return null;
  }

  const root = node.stateNode as FiberRoot;
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
  return root;
}
