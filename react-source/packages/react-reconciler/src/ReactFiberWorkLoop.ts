/**
 * @beginner-module: 源码导读
 * 本文件是 Fiber 工作循环：把一次更新拆成 render 阶段和 commit 阶段。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactElement, Wakeable } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createWorkInProgress } from "./ReactFiber.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
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
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { beginWork } from "./ReactFiberBeginWork.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { completeWork } from "./ReactFiberCompleteWork.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { commitMutationEffects } from "./ReactFiberCommitWork.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ensureRootIsScheduled, requestTransitionLane } from "./ReactFiberRootScheduler.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isCurrentTreeHidden } from "./ReactFiberHiddenContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { peekEntangledActionLane } from "./ReactFiberAsyncAction.js";

// @beginner: workInProgressRoot 指向本轮正在渲染的 FiberRoot。
let workInProgressRoot: FiberRoot | null = null;
// @beginner: workInProgress 指向当前 DFS 正在处理的 Fiber 工作单元。
let workInProgress: Fiber | null = null;
// @beginner: workInProgressRootRenderLanes 记录本轮 render 要处理哪些优先级。
let workInProgressRootRenderLanes: Lanes = NoLanes;
// @beginner: workInProgressTransitions 保存本轮 render 关联的 transition 信息。
let workInProgressTransitions: unknown[] | null = null;

// @beginner: 进入 requestUpdateLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function requestUpdateLane(): Lane {
  // Lane 可以理解成“这次更新的优先级标签”。
  // 普通 setState 走 SyncLane；transition/async action 会使用单独 lane。
  // @beginner: transition 来自 startTransition 期间设置的共享状态。
  const transition = ReactSharedInternals.T;
  // @beginner: lane 是最终分配给这次更新的优先级位。
  let lane: Lane;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (transition !== null) {
    lane = requestTransitionLane(transition);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: entangledActionLane 表示异步 action 中需要绑定在一起处理的 lane。
    const entangledActionLane = peekEntangledActionLane();
    lane = entangledActionLane !== NoLane ? entangledActionLane : SyncLane;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return isCurrentTreeHidden() ? mergeLanes(lane, OffscreenLane) : lane;
}

// @beginner: 进入 scheduleUpdateOnFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function scheduleUpdateOnFiber(sourceFiber: Fiber, lane: Lane = SyncLane): void {
  // 1. 先把更新 lane 记录在触发更新的 Fiber 上。
  // 这样 beginWork 可以知道当前节点本身有工作要做。
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (sourceFiber.alternate !== null) {
    // current 和 workInProgress 是双缓存，两个方向都标记，避免下次从另一棵树读不到。
    sourceFiber.alternate.lanes = mergeLanes(sourceFiber.alternate.lanes, lane);
  }

  // 2. 从 sourceFiber 一路向上冒泡到 HostRoot。
  // 父节点的 childLanes 表示“我的子树里有这些优先级的工作”。
  // @beginner: node 从触发更新的 Fiber 开始，向上寻找 HostRoot。
  let node = sourceFiber;
  // @beginner: 沿 return 指针向上，把 lane 冒泡到每个祖先的 childLanes。
  while (node.return !== null) {
    // @beginner: parent 是当前节点的父 Fiber。
    const parent = node.return;
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (parent.alternate !== null) {
      parent.alternate.childLanes = mergeLanes(parent.alternate.childLanes, lane);
    }
    node = node.return;
  }
  // 3. node 已经是 HostRoot Fiber，它的 stateNode 就是 FiberRoot。
  // @beginner: HostRoot.stateNode 保存 FiberRoot，这是调度的根对象。
  const root = node.stateNode as FiberRoot;
  // 4. root.pendingLanes 记录整个应用根上等待处理的工作。
  root.pendingLanes |= lane;
  // 5. 交给 root scheduler 安排一次 render/commit。
  ensureRootIsScheduled(root);
}

// @beginner: 进入 attachPingListener：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function attachPingListener(root: FiberRoot, wakeable: Wakeable, lanes: Lanes): void {
  // @beginner: pingCache 记录某个 Promise 已经绑定过哪些 lanes 的 retry listener。
  let pingCache = root.pingCache;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pingCache === undefined) {
    pingCache = root.pingCache = new WeakMap();
  }

  // @beginner: threadIDs 保存同一个 wakeable 上已经监听过的 lanes，避免重复注册。
  let threadIDs = pingCache.get(wakeable);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (threadIDs === undefined) {
    threadIDs = new Set();
    pingCache.set(wakeable, threadIDs);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!threadIDs.has(lanes)) {
    threadIDs.add(lanes);
    // @beginner: 定义 ping：wakeable 完成后触发 root 重试对应 lanes。
    const ping = () => pingSuspendedRoot(root, wakeable, lanes);
    wakeable.then(ping, ping);
  }
}

// @beginner: 进入 pingSuspendedRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pingSuspendedRoot(root: FiberRoot, wakeable: Wakeable, pingedLanes: Lanes): void {
  root.pingCache?.delete(wakeable);
  markRootPinged(root, pingedLanes);
  ensureRootIsScheduled(root);
}

// @beginner: 进入 markRootPinged：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markRootPinged(root: FiberRoot, pingedLanes: Lanes): void {
  root.pingedLanes = mergeLanes(root.pingedLanes ?? NoLanes, pingedLanes);
  root.pendingLanes = mergeLanes(root.pendingLanes, pingedLanes);
}

// @beginner: 进入 resolveRetryWakeable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable): void {
  // @beginner: 先从 Suspense 边界向上找到所属 root，找不到就不能重试。
  const root = getRootForRetryFiber(boundaryFiber);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (root === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  root.pingCache?.delete(wakeable);
  scheduleUpdateOnFiber(boundaryFiber, RetryLane);
}

// @beginner: 进入 updateContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateContainer(element: ReactElement | null | undefined, container: FiberRoot): void {
  // HostRoot 没有真实 JSX type，它的 pendingProps.children 就是根 element。
  // root.render(<App />) 最终就是把 <App /> 写到这里。
  container.current.pendingProps = { children: element ?? null };
  // 根更新走同步优先级，随后进入 performSyncWorkOnRoot/performConcurrentWorkOnRoot。
  scheduleUpdateOnFiber(container.current, SyncLane);
}

// @beginner: 进入 performConcurrentWorkOnRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function performConcurrentWorkOnRoot(root: FiberRoot): void {
  // 阅读版把并发入口简化为同步跑完整棵树；保留 lanes 是为了理解官方结构。
  // @beginner: lanes 是本次 root render 要消费的优先级集合。
  const lanes = root.pendingLanes === NoLanes ? SyncLane : root.pendingLanes;
  // render 阶段：只构建 workInProgress Fiber 树、计算 flags，不直接改 DOM。
  renderRootSync(root, lanes);
  // root.current.alternate 是刚刚构建好的新树，也就是 finishedWork。
  // @beginner: finishedWork 是 render 阶段刚刚完成的 workInProgress 树。
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  // commit 阶段：读取 flags，一次性执行 DOM 插入/更新/删除和 effect。
  commitRoot(root);
}

// @beginner: 进入 performSyncWorkOnRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function performSyncWorkOnRoot(root: FiberRoot): void {
  performConcurrentWorkOnRoot(root);
}

// @beginner: 进入 renderRootSync：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function renderRootSync(root: FiberRoot, renderLanes: Lanes): void {
  // 创建本轮 workInProgress 根节点，准备从 HostRoot 开始 DFS。
  prepareFreshStack(root, renderLanes);

  // workInProgress 指针就像“当前正在做作业的 Fiber”。
  // 每次 performUnitOfWork 处理一个 Fiber，直到整棵树处理完变成 null。
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// @beginner: 进入 prepareFreshStack：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareFreshStack(root: FiberRoot, renderLanes: Lanes): void {
  workInProgressRoot = root;
  workInProgressRootRenderLanes = renderLanes;
  // createWorkInProgress 会复用 current.alternate；没有 alternate 时才创建新 Fiber。
  workInProgress = createWorkInProgress(root.current, root.current.pendingProps);
}

// @beginner: 进入 performUnitOfWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function performUnitOfWork(unitOfWork: Fiber): void {
  // current 是旧树上的对应 Fiber；mount 时为 null，update 时用于 diff。
  // @beginner: current 是旧树里的对应节点，beginWork 用它和新输入做 diff。
  const current = unitOfWork.alternate;
  // beginWork 是“向下走”：根据当前 Fiber 生成/复用 child Fiber。
  // @beginner: next 是 beginWork 返回的第一个子 Fiber；有它就继续向下 DFS。
  const next = beginWork(current, unitOfWork, workInProgressRootRenderLanes);
  // pendingProps 是本次输入，memoizedProps 是本次处理完后记住的输入。
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (next === null) {
    // 没有 child，说明这个 Fiber 的向下阶段结束，开始向上 complete。
    completeUnitOfWork(unitOfWork);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // 有 child，DFS 继续深入子节点。
    workInProgress = next;
  }
}

// @beginner: 进入 completeUnitOfWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function completeUnitOfWork(unitOfWork: Fiber): void {
  // completeWork 是“向上回溯”：创建 DOM、收集子树 flags/lanes。
  // @beginner: completedWork 从当前叶子/无子节点 Fiber 开始一路向父级回溯。
  let completedWork: Fiber | null = unitOfWork;

  // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
  do {
    // @beginner: current 是 complete 阶段可对比的旧 Fiber。
    const current = completedWork.alternate;
    completeWork(current, completedWork);

    // @beginner: sibling 存在时，DFS 回溯后要转向兄弟子树。
    const sibling = completedWork.sibling;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (sibling !== null) {
      // 当前子树完成后，如果有兄弟节点，DFS 转向兄弟。
      workInProgress = sibling;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }

    // 没有兄弟就回到父节点，继续 complete 父节点。
    completedWork = completedWork.return;
    workInProgress = completedWork;
  } while (completedWork !== null);
}

// @beginner: 进入 commitRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitRoot(root: FiberRoot): void {
  // @beginner: finishedWork 是等待提交的完整 Fiber 树。
  const finishedWork = root.finishedWork;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // 清空 finishedWork，避免重复提交同一棵树。
  root.finishedWork = null;
  // mutation effects 会真正改 DOM，并执行 layout/passive effect 登记逻辑。
  commitMutationEffects(root, finishedWork);
  // 提交完成，新树成为 current；旧树作为 alternate 留给下次更新复用。
  root.current = finishedWork;
  // 本轮同步提交已经处理完所有 pending work，清理 root 调度状态。
  root.pendingLanes = 0;
  root.pingedLanes = NoLanes;
  root.entangledLanes = NoLanes;
  root.callbackNode = null;
  root.callbackPriority = 0;
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;
}

// @beginner: 进入 getRootForRetryFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getRootForRetryFiber(sourceFiber: Fiber): FiberRoot | null {
  // @beginner: node 用来从边界 Fiber 向上爬到 HostRoot。
  let node = sourceFiber;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node.return !== null) {
    node = node.return;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return node.stateNode as FiberRoot | null;
}

// @beginner: 进入 getWorkInProgressRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getWorkInProgressRoot(): FiberRoot | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgressRoot;
}

// @beginner: 进入 getWorkInProgressTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getWorkInProgressTransitions(): unknown[] | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgressTransitions;
}

// @beginner: 进入 markTransitionStarted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markTransitionStarted(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgressTransitions === null) {
    workInProgressTransitions = [];
  }
}

// @beginner: 进入 captureCommitPhaseError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: unknown,
): void {
  // @beginner: target 是接收 commit 阶段错误信息的 Fiber。
  const target = nearestMountedAncestor ?? sourceFiber;
  target.updateQueue = error;
}
