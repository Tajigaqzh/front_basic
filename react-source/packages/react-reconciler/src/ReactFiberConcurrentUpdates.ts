/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot, Update as HookUpdate, UpdateQueue as HookQueue } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane, Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoLane, NoLanes, mergeLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostRoot } from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type {
  SharedQueue as ClassQueue,
  Update as ClassUpdate,
} from "./ReactFiberClassUpdateQueue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getRootForUpdatedFiber } from "./ReactFiberTreeReflection.js";

// @beginner: 定义 ConcurrentUpdate：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ConcurrentUpdate {
  next: ConcurrentUpdate | null;
  lane: Lane;
}

// @beginner: 定义 ConcurrentQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
interface ConcurrentQueue {
  pending: ConcurrentUpdate | null;
}

// @beginner: 声明 concurrentQueues：保存当前步骤需要读取或更新的数据。
const concurrentQueues: unknown[] = [];
// @beginner: 声明 concurrentQueuesIndex：保存当前步骤需要读取或更新的数据。
let concurrentQueuesIndex = 0;
// @beginner: 声明 concurrentlyUpdatedLanes：保存当前步骤需要读取或更新的数据。
let concurrentlyUpdatedLanes: Lanes = NoLanes;

// @beginner: 进入 finishQueueingConcurrentUpdates：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function finishQueueingConcurrentUpdates(): void {
  // @beginner: 声明 endIndex：保存当前步骤需要读取或更新的数据。
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;
  concurrentlyUpdatedLanes = NoLanes;

  // @beginner: 声明 i：保存当前步骤需要读取或更新的数据。
  let i = 0;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (i < endIndex) {
    // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
    const fiber = concurrentQueues[i++] as Fiber;
    // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
    const queue = concurrentQueues[i++] as ConcurrentQueue | null;
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    const update = concurrentQueues[i++] as ConcurrentUpdate | null;
    // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
    const lane = concurrentQueues[i++] as Lane;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (queue !== null && update !== null) {
      // @beginner: 声明 pending：保存当前步骤需要读取或更新的数据。
      const pending = queue.pending;
      // 官方结构：pending 指向环形链表尾节点，新 update 插到尾节点后面。
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (pending === null) {
        update.next = update;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        update.next = pending.next;
        pending.next = update;
      }
      queue.pending = update;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lane !== NoLane) {
      markUpdateLaneFromFiberToRoot(fiber, lane);
    }
  }
}

// @beginner: 进入 getConcurrentlyUpdatedLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getConcurrentlyUpdatedLanes(): Lanes {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return concurrentlyUpdatedLanes;
}

// @beginner: 进入 enqueueUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
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
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.alternate !== null) {
    fiber.alternate.lanes = mergeLanes(fiber.alternate.lanes, lane);
  }
}

// @beginner: 进入 enqueueConcurrentHookUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueConcurrentHookUpdate<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
  lane: Lane,
): FiberRoot | null {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, lane);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getRootForUpdatedFiber(fiber);
}

// @beginner: 进入 enqueueConcurrentHookUpdateAndEagerlyBailout：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueConcurrentHookUpdateAndEagerlyBailout<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
): void {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, NoLane);
  finishQueueingConcurrentUpdates();
}

// @beginner: 进入 enqueueConcurrentClassUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane,
): FiberRoot | null {
  enqueueUpdate(fiber, queue as unknown as ConcurrentQueue, update as unknown as ConcurrentUpdate, lane);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getRootForUpdatedFiber(fiber);
}

// @beginner: 进入 enqueueConcurrentRenderForLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueConcurrentRenderForLane(fiber: Fiber, lane: Lane): FiberRoot | null {
  enqueueUpdate(fiber, null, null, lane);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getRootForUpdatedFiber(fiber);
}

// @beginner: 进入 unsafe_markUpdateLaneFromFiberToRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unsafe_markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return markUpdateLaneFromFiberToRoot(sourceFiber, lane);
}

// @beginner: 进入 markUpdateLaneFromFiberToRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | null {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (sourceFiber.alternate !== null) {
    sourceFiber.alternate.lanes = mergeLanes(sourceFiber.alternate.lanes, lane);
  }

  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = sourceFiber;
  // @beginner: 声明 parent：保存当前步骤需要读取或更新的数据。
  let parent = sourceFiber.return;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (parent.alternate !== null) {
      parent.alternate.childLanes = mergeLanes(parent.alternate.childLanes, lane);
    }
    node = parent;
    parent = parent.return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node.tag !== HostRoot || node.stateNode === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = node.stateNode as FiberRoot;
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return root;
}
