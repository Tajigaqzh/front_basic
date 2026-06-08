/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Wakeable } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane, Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  DidCapture,
  ForceClientRender,
  Incomplete,
  NoFlags,
  ScheduleRetry,
  ShouldCapture,
} from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ClassComponent, HostRoot, SuspenseComponent, SuspenseListComponent } from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { mergeLanes, RetryLane, SyncLane } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  CaptureUpdate,
  createUpdate,
  enqueueUpdate,
  type Update,
} from "./ReactFiberClassUpdateQueue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { noopSuspenseyCommitThenable } from "./ReactFiberThenable.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { attachPingListener } from "./ReactFiberWorkLoop.js";

// @beginner: 定义 CapturedValue：描述对象需要具备哪些字段，方便读者理解数据形状。
interface CapturedValue<T> {
  value: T;
  source: Fiber;
  stack: string | null;
}

// @beginner: 进入 createCapturedValueAtFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createCapturedValueAtFiber<T>(value: T, source: Fiber): CapturedValue<T> {
  // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
  const stack = value instanceof Error ? value.stack ?? null : null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { value, source, stack };
}

// @beginner: 进入 createRootErrorUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createRootErrorUpdate(
  _root: FiberRoot,
  errorInfo: CapturedValue<unknown>,
  lane: Lane,
): Update<unknown> {
  // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
  const update = createUpdate<unknown>(lane);
  update.tag = CaptureUpdate;
  update.payload = null;
  update.callback = () => {
    // 官方 React 会走 error logger；这里保留提交阶段回调位置，避免吞掉错误信息。
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (errorInfo.value instanceof Error) {
      console.error(errorInfo.value);
    }
  };
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return update;
}

// @beginner: 进入 createClassErrorUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createClassErrorUpdate(lane: Lane): Update<unknown> {
  // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
  const update = createUpdate<unknown>(lane);
  update.tag = CaptureUpdate;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return update;
}

// @beginner: 进入 initializeClassErrorUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initializeClassErrorUpdate(
  update: Update<unknown>,
  root: FiberRoot,
  fiber: Fiber,
  errorInfo: CapturedValue<unknown>,
): void {
  // @beginner: 声明 ctor：保存当前步骤需要读取或更新的数据。
  const ctor = fiber.type as {
    getDerivedStateFromError?: (error: unknown) => unknown;
  };
  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = fiber.stateNode as {
    componentDidCatch?: (error: unknown, info: { componentStack: string }) => void;
  } | null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof ctor.getDerivedStateFromError === "function") {
    update.payload = () => ctor.getDerivedStateFromError?.(errorInfo.value);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance !== null && typeof instance.componentDidCatch === "function") {
    update.callback = () => {
      instance.componentDidCatch?.(errorInfo.value, {
        componentStack: errorInfo.stack ?? "",
      });
    };
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    update.callback = createRootErrorUpdate(root, errorInfo, update.lane).callback;
  }
}

// @beginner: 进入 resetSuspendedComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function resetSuspendedComponent(sourceFiber: Fiber): void {
  // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
  const current = sourceFiber.alternate;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    sourceFiber.updateQueue = current.updateQueue;
    sourceFiber.memoizedState = current.memoizedState;
    sourceFiber.lanes = current.lanes;
  }
}

// @beginner: 进入 markSuspenseBoundaryShouldCapture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function markSuspenseBoundaryShouldCapture(
  suspenseBoundary: Fiber,
  sourceFiber: Fiber,
  rootRenderLanes: Lanes,
): Fiber {
  suspenseBoundary.flags |= ShouldCapture;
  suspenseBoundary.lanes = mergeLanes(suspenseBoundary.lanes, rootRenderLanes);
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, SyncLane);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return suspenseBoundary;
}

// @beginner: 进入 throwException：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function throwException(
  root: FiberRoot,
  _returnFiber: Fiber | null,
  sourceFiber: Fiber,
  value: unknown,
  rootRenderLanes: Lanes,
): boolean {
  sourceFiber.flags |= Incomplete;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isWakeable(value)) {
    // @beginner: 声明 wakeable：保存当前步骤需要读取或更新的数据。
    const wakeable = value;
    resetSuspendedComponent(sourceFiber);
    // @beginner: 声明 suspenseBoundary：保存当前步骤需要读取或更新的数据。
    const suspenseBoundary = findNearestSuspenseBoundary(sourceFiber);

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (suspenseBoundary !== null) {
      suspenseBoundary.flags &= ~ForceClientRender;
      markSuspenseBoundaryShouldCapture(suspenseBoundary, sourceFiber, rootRenderLanes);

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (wakeable === noopSuspenseyCommitThenable) {
        suspenseBoundary.flags |= ScheduleRetry;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 声明 retryQueue：保存当前步骤需要读取或更新的数据。
        const retryQueue = suspenseBoundary.updateQueue as RetryQueue | null;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (retryQueue === null) {
          suspenseBoundary.updateQueue = new Set([wakeable]);
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          retryQueue.add(wakeable);
        }
        attachPingListener(root, wakeable, rootRenderLanes);
      }
      suspenseBoundary.lanes = mergeLanes(suspenseBoundary.lanes, RetryLane);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }

    root.pendingLanes = mergeLanes(root.pendingLanes, rootRenderLanes);
    attachPingListener(root, wakeable, rootRenderLanes);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 errorInfo：保存当前步骤需要读取或更新的数据。
  const errorInfo = createCapturedValueAtFiber(value, sourceFiber);
  // @beginner: 声明 errorBoundary：保存当前步骤需要读取或更新的数据。
  const errorBoundary = findNearestErrorBoundary(sourceFiber);
  // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
  const lane = SyncLane;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (errorBoundary !== null) {
    errorBoundary.flags |= ShouldCapture;
    errorBoundary.lanes = mergeLanes(errorBoundary.lanes, lane);
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    const update = createClassErrorUpdate(lane);
    initializeClassErrorUpdate(update, root, errorBoundary, errorInfo);
    enqueueUpdate(errorBoundary, update, lane);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 rootFiber：保存当前步骤需要读取或更新的数据。
  const rootFiber = root.current.alternate ?? root.current;
  rootFiber.flags = (rootFiber.flags & ~DidCapture) | ShouldCapture;
  // @beginner: 声明 rootUpdate：保存当前步骤需要读取或更新的数据。
  const rootUpdate = createRootErrorUpdate(root, errorInfo, lane);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (rootFiber.updateQueue !== null) {
    enqueueUpdate(rootFiber, rootUpdate, lane);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 isWakeable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isWakeable(value: unknown): value is Wakeable {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";
}

// @beginner: 进入 findNearestSuspenseBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findNearestSuspenseBoundary(sourceFiber: Fiber): Fiber | null {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = sourceFiber.return;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === SuspenseComponent || node.tag === SuspenseListComponent) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return node;
    }
    node = node.return;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 findNearestErrorBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findNearestErrorBoundary(sourceFiber: Fiber): Fiber | null {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = sourceFiber.return;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === ClassComponent) {
      // @beginner: 声明 ctor：保存当前步骤需要读取或更新的数据。
      const ctor = node.type as { getDerivedStateFromError?: unknown };
      // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
      const instance = node.stateNode as { componentDidCatch?: unknown } | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (
        typeof ctor.getDerivedStateFromError === "function" ||
        (instance !== null && typeof instance.componentDidCatch === "function")
      ) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return node;
      }
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === HostRoot) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    }
    node = node.return;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 clearSuspenseBoundaryShouldCapture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function clearSuspenseBoundaryShouldCapture(boundary: Fiber): void {
  boundary.flags &= ~ShouldCapture;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ((boundary.flags & DidCapture) === NoFlags) {
    boundary.updateQueue = null;
  }
}
