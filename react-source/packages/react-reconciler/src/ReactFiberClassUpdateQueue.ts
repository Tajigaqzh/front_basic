/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
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
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getRootForUpdatedFiber } from "./ReactFiberTreeReflection.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  peekEntangledActionLane,
  peekEntangledActionThenable,
} from "./ReactFiberAsyncAction.js";

// @beginner: 定义 Update：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Update<State> {
  lane: Lane;
  tag: 0 | 1 | 2 | 3;
  payload: unknown;
  callback: (() => void) | null;
  next: Update<State> | null;
}

// @beginner: 定义 SharedQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SharedQueue<State> {
  pending: Update<State> | null;
  lanes: Lanes;
}

// @beginner: 定义 UpdateQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface UpdateQueue<State> {
  baseState: State;
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;
  shared: SharedQueue<State>;
  callbacks: Array<() => void> | null;
}

// @beginner: 声明 UpdateState：保存当前步骤需要读取或更新的数据。
export const UpdateState = 0;
// @beginner: 声明 ReplaceState：保存当前步骤需要读取或更新的数据。
export const ReplaceState = 1;
// @beginner: 声明 ForceUpdate：保存当前步骤需要读取或更新的数据。
export const ForceUpdate = 2;
// @beginner: 声明 CaptureUpdate：保存当前步骤需要读取或更新的数据。
export const CaptureUpdate = 3;

// @beginner: 声明 hasForceUpdate：保存当前步骤需要读取或更新的数据。
let hasForceUpdate = false;
// @beginner: 声明 didReadFromEntangledAsyncAction：保存当前步骤需要读取或更新的数据。
let didReadFromEntangledAsyncAction = false;

// @beginner: 进入 initializeUpdateQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initializeUpdateQueue<State>(fiber: Fiber): void {
  // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
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

// @beginner: 进入 cloneUpdateQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function cloneUpdateQueue<State>(current: Fiber, workInProgress: Fiber): void {
  // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
  const queue = workInProgress.updateQueue as UpdateQueue<State> | null;
  // @beginner: 声明 currentQueue：保存当前步骤需要读取或更新的数据。
  const currentQueue = current.updateQueue as UpdateQueue<State> | null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
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

// @beginner: 进入 createUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createUpdate<State>(lane: Lane = SyncLane): Update<State> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    lane,
    tag: UpdateState,
    payload: null,
    callback: null,
    next: null,
  };
}

// @beginner: 进入 enqueueUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  _lane: Lane,
): FiberRoot | null {
  // @beginner: 声明 updateQueue：保存当前步骤需要读取或更新的数据。
  const updateQueue = fiber.updateQueue as UpdateQueue<State> | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (updateQueue === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 声明 pending：保存当前步骤需要读取或更新的数据。
  const pending = updateQueue.shared.pending;
  // 与官方一致：shared.pending 是环形单链表尾指针，插入为 O(1)。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pending === null) {
    update.next = update;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getRootForUpdatedFiber(fiber);
}

// @beginner: 进入 entangleTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function entangleTransitions<State>(
  root: FiberRoot,
  queue: UpdateQueue<State>,
  lane: Lane,
): void {
  // @beginner: 声明 updateLane：保存当前步骤需要读取或更新的数据。
  const updateLane = removeLanes(lane, OffscreenLane);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isTransitionLane(updateLane)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 queueLanes：保存当前步骤需要读取或更新的数据。
  const queueLanes = intersectLanes(queue.shared.lanes, root.pendingLanes);
  // @beginner: 声明 newQueueLanes：保存当前步骤需要读取或更新的数据。
  const newQueueLanes = mergeLanes(queueLanes, updateLane);
  queue.shared.lanes = newQueueLanes;
  root.entangledLanes = mergeLanes(root.entangledLanes ?? NoLanes, newQueueLanes);
}

// @beginner: 进入 processUpdateQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: unknown,
  _instance: unknown,
  renderLanes: Lanes = NoLanes,
): void {
  // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
  const queue = workInProgress.updateQueue as UpdateQueue<State> | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queue === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  hasForceUpdate = false;
  didReadFromEntangledAsyncAction = false;
  // @beginner: 声明 firstBaseUpdate：保存当前步骤需要读取或更新的数据。
  let firstBaseUpdate = queue.firstBaseUpdate;
  // @beginner: 声明 lastBaseUpdate：保存当前步骤需要读取或更新的数据。
  let lastBaseUpdate = queue.lastBaseUpdate;
  // @beginner: 声明 pendingQueue：保存当前步骤需要读取或更新的数据。
  const pendingQueue = queue.shared.pending;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingQueue !== null) {
    queue.shared.pending = null;
    // @beginner: 声明 lastPendingUpdate：保存当前步骤需要读取或更新的数据。
    const lastPendingUpdate = pendingQueue;
    // @beginner: 声明 firstPendingUpdate：保存当前步骤需要读取或更新的数据。
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (firstBaseUpdate !== null) {
    // @beginner: 声明 newState：保存当前步骤需要读取或更新的数据。
    let newState = queue.baseState;
    // @beginner: 声明 newBaseState：保存当前步骤需要读取或更新的数据。
    let newBaseState: State | null = null;
    // @beginner: 声明 newFirstBaseUpdate：保存当前步骤需要读取或更新的数据。
    let newFirstBaseUpdate: Update<State> | null = null;
    // @beginner: 声明 newLastBaseUpdate：保存当前步骤需要读取或更新的数据。
    let newLastBaseUpdate: Update<State> | null = null;
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    let update: Update<State> | null = firstBaseUpdate;

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (update !== null) {
      // @beginner: 声明 updateLane：保存当前步骤需要读取或更新的数据。
      const updateLane = removeLanes(update.lane, OffscreenLane);
      // @beginner: 声明 shouldSkipUpdate：保存当前步骤需要读取或更新的数据。
      const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane);

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (shouldSkipUpdate) {
        // 与官方一致：跳过的 update 克隆进 base queue，保持原 lane 等下一轮重放。
        // @beginner: 声明 clone：保存当前步骤需要读取或更新的数据。
        const clone: Update<State> = {
          lane: updateLane,
          tag: update.tag,
          payload: update.payload,
          callback: update.callback,
          next: null,
        };
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          newBaseState = newState;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          newLastBaseUpdate.next = clone;
          newLastBaseUpdate = clone;
        }
        workInProgress.lanes = mergeLanes(workInProgress.lanes, updateLane);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newLastBaseUpdate !== null) {
          // 前面有低优先级 update 被跳过后，后续已提交 update 用 NoLane 留在队列里；
          // 这样重放时不会被再次过滤，也不会重复触发 callback。
          // @beginner: 声明 clone：保存当前步骤需要读取或更新的数据。
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

        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (updateLane !== NoLane && updateLane === peekEntangledActionLane()) {
          didReadFromEntangledAsyncAction = true;
        }
        newState = getStateFromUpdate(update, newState, props);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (update.callback !== null) {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (queue.callbacks === null) {
            queue.callbacks = [];
          }
          queue.callbacks.push(update.callback);
        }
      }

      update = update.next;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState as State;
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;
    workInProgress.memoizedState = newState;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (newLastBaseUpdate === null) {
      queue.shared.lanes = NoLanes;
    }
  }
}

// @beginner: 进入 suspendIfUpdateReadFromEntangledAsyncAction：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function suspendIfUpdateReadFromEntangledAsyncAction(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!didReadFromEntangledAsyncAction) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 声明 thenable：保存当前步骤需要读取或更新的数据。
  const thenable = peekEntangledActionThenable();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (thenable !== null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw thenable;
  }
}

// @beginner: 进入 getStateFromUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getStateFromUpdate<State>(
  update: Update<State>,
  prevState: State,
  nextProps: unknown,
): State {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (update.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ReplaceState: {
      // @beginner: 声明 payload：保存当前步骤需要读取或更新的数据。
      const payload = update.payload;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return typeof payload === "function"
        ? (payload as (state: State, props: unknown) => State)(prevState, nextProps)
        : (payload as State);
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ForceUpdate:
      hasForceUpdate = true;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return prevState;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case UpdateState:
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default: {
      // @beginner: 声明 payload：保存当前步骤需要读取或更新的数据。
      const payload = update.payload;
      // @beginner: 声明 partialState：保存当前步骤需要读取或更新的数据。
      const partialState =
        typeof payload === "function"
          ? (payload as (state: State, props: unknown) => Partial<State> | null)(prevState, nextProps)
          : (payload as Partial<State> | null);

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (partialState === null || partialState === undefined) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return prevState;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof prevState === "object" && prevState !== null) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return { ...prevState, ...partialState };
      }

      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return partialState as State;
    }
  }
}

// @beginner: 进入 commitUpdateQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitUpdateQueue<State>(
  finishedWork: Fiber,
  finishedQueue: UpdateQueue<State>,
  instance: unknown,
): void {
  // @beginner: 声明 callbacks：保存当前步骤需要读取或更新的数据。
  const callbacks = finishedQueue.callbacks;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (callbacks === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  finishedQueue.callbacks = null;
  callbacks.forEach((callback) => callback.call(instance));
}

// @beginner: 进入 resetHasForceUpdateBeforeProcessing：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetHasForceUpdateBeforeProcessing(): void {
  hasForceUpdate = false;
}

// @beginner: 进入 checkHasForceUpdateAfterProcessing：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkHasForceUpdateAfterProcessing(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hasForceUpdate;
}
