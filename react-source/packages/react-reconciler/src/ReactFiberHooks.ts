/**
 * @beginner-module: 源码导读
 * 本文件实现函数组件 Hooks 的运行时：Hook 链表、update 队列、deps 比较和 effect 登记。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { objectIs, ReactSharedInternals } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Dispatch, Props, ReactNode, StateAction } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { Passive as PassiveFiberFlag } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  isSubsetOfLanes,
  intersectLanes,
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
import { HasEffect, Insertion, Layout, Passive } from "./ReactHookEffectTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DefaultAsyncDispatcher } from "./ReactFiberAsyncDispatcher.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type {
  Effect,
  Fiber,
  FunctionComponentUpdateQueue,
  Hook,
  Update,
  UpdateQueue,
} from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { requestUpdateLane, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { prepareToReadContext, readContext, resetContextDependencies } from "./ReactFiberNewContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  peekEntangledActionLane,
  peekEntangledActionThenable,
} from "./ReactFiberAsyncAction.js";

// @beginner: currentlyRenderingFiber 指向当前正在执行的函数组件 Fiber。
let currentlyRenderingFiber: Fiber | null = null;
// @beginner: workInProgressHook 指向本轮新 Hook 链表的尾节点。
let workInProgressHook: Hook | null = null;
// @beginner: currentHook 指向旧 Hook 链表中当前要克隆的节点。
let currentHook: Hook | null = null;
// @beginner: currentlyRenderingLanes 是本轮函数组件 render 正在处理的更新优先级。
let currentlyRenderingLanes: Lanes = NoLanes;

// mount dispatcher：函数组件第一次渲染时使用。
// 每个 Hook 调用都会创建一个新的 Hook 节点，追加到 fiber.memoizedState 链表。
// @beginner: HooksDispatcherOnMount 把 public useXxx 映射到 mountXxx 实现。
const HooksDispatcherOnMount = {
  readContext,
  useContext: readContext,
  useState: mountState,
  useReducer: mountReducer,
  useRef: mountRef,
  useMemo: mountMemo,
  useCallback: mountCallback,
  useEffect: mountEffect,
  useInsertionEffect: mountInsertionEffect,
  useLayoutEffect: mountLayoutEffect,
  useImperativeHandle: mountImperativeHandle,
  useTransition: mountTransition,
  useDeferredValue: mountDeferredValue,
  useId: mountId,
};

// update dispatcher：函数组件更新时使用。
// 每个 Hook 调用都会从 current.memoizedState 旧链表克隆一个 Hook 节点。
// @beginner: HooksDispatcherOnUpdate 把 public useXxx 映射到 updateXxx 实现。
const HooksDispatcherOnUpdate = {
  readContext,
  useContext: readContext,
  useState: updateState,
  useReducer: updateReducer,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useEffect: updateEffect,
  useInsertionEffect: updateInsertionEffect,
  useLayoutEffect: updateLayoutEffect,
  useImperativeHandle: updateImperativeHandle,
  useTransition: updateTransition,
  useDeferredValue: updateDeferredValue,
  useId: updateId,
};

// @beginner: localIdCounter 是复刻版 useId 的简单本地计数器。
let localIdCounter = 0;

// @beginner: 进入 renderWithHooks：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function renderWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (props: Props, secondArg?: unknown) => ReactNode,
  props: Props,
  secondArg?: unknown,
  renderLanes: Lanes = SyncLane,
): ReactNode {
  // 1. 记录当前正在渲染的函数组件 Fiber。
  // 后续 useState/useEffect 创建 Hook 节点时都要挂到这个 Fiber 上。
  currentlyRenderingFiber = workInProgress;
  currentlyRenderingLanes = renderLanes;
  // 2. 清空本轮新 Fiber 的 Hook 链表和 effect 队列，准备重建。
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  // 3. workInProgressHook 指向新链表最后一个 Hook；currentHook 指向旧链表当前 Hook。
  workInProgressHook = null;
  currentHook = current?.memoizedState ?? null;

  // React 包里的 useXxx 只查 dispatcher；mount/update 由 reconciler 在这里切换。
  // @beginner: previousAsyncDispatcher 用于 render 结束后恢复旧的 async dispatcher。
  const previousAsyncDispatcher = ReactSharedInternals.A;
  ReactSharedInternals.H = currentHook === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
  ReactSharedInternals.A = DefaultAsyncDispatcher;
  prepareToReadContext(workInProgress, renderLanes);
  // 4. 真正执行用户函数组件。组件内部调用 useState/useEffect 时会走上面的 dispatcher。
  // @beginner: children 是函数组件返回的 ReactNode，后续会继续 reconcile。
  const children = Component(props, secondArg);
  // 5. 函数组件执行完后立刻清空 dispatcher，防止在 render 外调用 Hooks。
  ReactSharedInternals.H = null;
  ReactSharedInternals.A = previousAsyncDispatcher;
  resetContextDependencies();

  currentlyRenderingFiber = null;
  currentlyRenderingLanes = NoLanes;
  workInProgressHook = null;
  currentHook = null;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return children;
}

// @beginner: 进入 mountState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountState<S>(initialState: S | (() => S)): [S, Dispatch<StateAction<S>>] {
  // useState 可以看成内置 reducer：action 是值或 updater 函数。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return mountReducer(basicStateReducer<S>, initialState as S);
}

// @beginner: 进入 updateState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateState<S>(): [S, Dispatch<StateAction<S>>] {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateReducer(basicStateReducer<S>);
}

// @beginner: 进入 mountReducer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: (initialArg: S) => S,
): [S, Dispatch<A>] {
  // 创建当前 Hook 节点，并追加到 currentlyRenderingFiber.memoizedState 链表。
  // @beginner: hook 是当前 useReducer/useState 对应的新 Hook 节点。
  const hook = mountWorkInProgressHook<S>();
  // dispatch 闭包要记住当前 Fiber。以后用户点击按钮调用 dispatch 时，
  // React 才知道应该从哪棵 Fiber 往上找到 root 并调度更新。
  // @beginner: fiber 被 dispatch 闭包捕获，之后 setState 才知道要调度哪棵子树。
  const fiber = currentlyRenderingFiber!;
  // init 存在时做惰性初始化；useState(() => initial) 也在 mount 时只执行一次。
  // @beginner: initialState 是 mount 阶段计算出的初始状态，只在首次渲染使用。
  const initialState =
    init !== undefined
      ? init(initialArg)
      : typeof initialArg === "function"
        ? (initialArg as () => S)()
        : initialArg;

  // memoizedState 是本次 render 返回给组件的 state。
  hook.memoizedState = initialState;
  // baseState/baseQueue 用于优先级跳过后的 rebase；小白先理解为“重新计算的起点”。
  hook.baseState = initialState;
  hook.baseQueue = null;

  // 每个 state/reducer Hook 都有自己的更新队列。
  // pending 是环形链表尾节点；dispatch 固定复用同一个函数。
  // @beginner: queue 保存这个 Hook 后续所有 setState/useReducer 更新。
  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;

  // dispatch(action) 不会立刻改 state，只会创建 update 入队并 scheduleUpdateOnFiber。
  // @beginner: 定义 dispatch：返回给用户的 setState/dispatch 函数，调用时把 update 入队。
  const dispatch: Dispatch<A> = (action) => dispatchSetState(fiber, queue, action);
  queue.dispatch = dispatch;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return [hook.memoizedState, dispatch];
}

// @beginner: 进入 updateReducer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateReducer<S, A>(reducer: (state: S, action: A) => S): [S, Dispatch<A>] {
  // 更新时不创建全新语义的 Hook，而是从旧链表 currentHook 克隆当前顺序的 Hook。
  // @beginner: hook 是从旧 Hook 克隆出的本轮 Hook 节点。
  const hook = updateWorkInProgressHook<S>();
  // @beginner: queue 是该 Hook 持有的更新队列，mount 后会一直复用。
  const queue = hook.queue as UpdateQueue<S, A>;
  queue.lastRenderedReducer = reducer;
  // pendingQueue 是上次 render 之后新触发的 setState/useReducer action。
  // @beginner: pendingQueue 是上次 render 后新入队、尚未处理的更新环。
  const pendingQueue = queue.pending;
  // @beginner: baseQueue 保存之前因优先级不足而跳过、需要重放的更新。
  let baseQueue = hook.baseQueue as Update<S, A> | null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingQueue !== null) {
    // 把本轮新 pending 更新合并到 baseQueue。
    // 两者都是环形链表，只需要交换 next 指针即可 O(1) 拼接。
    queue.pending = null;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (baseQueue !== null) {
      // @beginner: baseFirst 是旧 baseQueue 的第一个更新节点。
      const baseFirst = baseQueue.next;
      // @beginner: pendingFirst 是新 pendingQueue 的第一个更新节点。
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    baseQueue = pendingQueue;
    hook.baseQueue = pendingQueue;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (baseQueue === null) {
    // 没有任何待处理更新，直接复用 baseState。
    hook.memoizedState = hook.baseState;
    queue.lastRenderedState = hook.memoizedState;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return [hook.memoizedState, queue.dispatch as Dispatch<A>];
  }

  // @beginner: first 是环形更新链表的第一个节点。
  const first = baseQueue.next;
  // @beginner: update 是当前正在重放的更新节点。
  let update = first;
  // @beginner: previousMemoizedState 用来判断本轮 state 是否真的变化。
  const previousMemoizedState = hook.memoizedState;
  // @beginner: newState 是按 update 队列重放后逐步计算出的状态。
  let newState = hook.baseState;
  // @beginner: newBaseState 是下次重放被跳过更新时的起点状态。
  let newBaseState: S | null = null;
  // @beginner: newBaseQueueFirst 是本轮重建 baseQueue 的第一个节点。
  let newBaseQueueFirst: Update<S, A> | null = null;
  // @beginner: newBaseQueueLast 是本轮重建 baseQueue 的尾节点。
  let newBaseQueueLast: Update<S, A> | null = null;
  // @beginner: didReadFromEntangledAsyncAction 表示本轮读到了被 entangle 的异步 action。
  let didReadFromEntangledAsyncAction = false;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (update !== null) {
    // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
    do {
      // update.lane 表示这条 update 的优先级；当前 renderLanes 不包含它就先跳过。
      // @beginner: updateLane 是当前 update 自己的优先级，去掉 Offscreen 标记后再比较。
      const updateLane = removeLanes(update.lane, OffscreenLane);
      // @beginner: shouldSkipUpdate 表示当前 renderLanes 不够处理这条 update。
      const shouldSkipUpdate = !isSubsetOfLanes(currentlyRenderingLanes, updateLane);

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (shouldSkipUpdate) {
        // 优先级不足时保留原 lane，下一轮包含该 lane 的 render 会从 newBaseState 重新计算。
        // @beginner: clone 把跳过的 update 复制到新的 baseQueue，留到未来重放。
        const clone: Update<S, A> = {
          lane: updateLane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null,
        };
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        currentlyRenderingFiber!.lanes = mergeLanes(currentlyRenderingFiber!.lanes, updateLane);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newBaseQueueLast !== null) {
          // 前面发生过跳过时，后续已应用更新也要以 NoLane 克隆进 baseQueue，
          // 这样重放低优先级更新时仍能得到与官方一致的 rebasing 顺序。
          // @beginner: clone 保留已经处理过的 update，保证未来 rebase 顺序一致。
          const clone: Update<S, A> = {
            lane: NoLane,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null,
          };
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (updateLane !== NoLane && updateLane === peekEntangledActionLane()) {
          didReadFromEntangledAsyncAction = true;
        }
        // 真正计算新 state：
        // - eagerState 是 dispatch 时提前算好的结果，可直接复用。
        // - 否则调用 reducer(newState, action)。
        newState = update.hasEagerState ? (update.eagerState as S) : reducer(newState, update.action);
      }

      update = update.next;
    } while (update !== null && update !== first);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (newBaseQueueLast === null) {
    // 所有更新都被处理完，baseState 就是最终 newState，不再保留 baseQueue。
    hook.baseState = newState;
    hook.baseQueue = null;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // 有低优先级更新被跳过，保留新 baseQueue，下次对应 lane render 时继续重放。
    newBaseQueueLast.next = newBaseQueueFirst;
    hook.baseState = newBaseState as S;
    hook.baseQueue = newBaseQueueLast;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!objectIs(newState, previousMemoizedState) && didReadFromEntangledAsyncAction) {
    // @beginner: entangledActionThenable 是需要抛给 Suspense/use 的异步 action thenable。
    const entangledActionThenable = peekEntangledActionThenable();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (entangledActionThenable !== null) {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw entangledActionThenable;
    }
  }

  hook.memoizedState = newState;
  queue.lastRenderedState = newState;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hook.baseQueue === null) {
    queue.lanes = NoLanes;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return [hook.memoizedState, queue.dispatch as Dispatch<A>];
}

// @beginner: 进入 mountRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountRef<T>(initialValue: T): { current: T } {
  // @beginner: ref Hook 节点的 memoizedState 保存稳定的 ref 对象。
  const hook = mountWorkInProgressHook<{ current: T }>();
  // ref 是稳定对象。后续 updateRef 会返回同一个 object，不触发调度。
  // @beginner: ref 是返回给用户的稳定对象，后续 render 会复用同一个引用。
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return ref;
}

// @beginner: 进入 updateRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateRef<T>(): { current: T } {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateWorkInProgressHook<{ current: T }>().memoizedState;
}

// @beginner: 进入 mountMemo：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  // @beginner: memo Hook 节点保存 [value, deps]。
  const hook = mountWorkInProgressHook<[T, unknown[] | null]>();
  // mount 时必须执行 create，得到初始缓存值。
  // @beginner: value 是 create() 计算出的缓存结果。
  const value = create();
  // memoizedState 同时保存 value 和 deps，下次 update 才能比较。
  hook.memoizedState = [value, deps ?? null];
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value;
}

// @beginner: 进入 updateMemo：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  // @beginner: updateMemo 从旧 Hook 克隆出保存 [value, deps] 的节点。
  const hook = updateWorkInProgressHook<[T, unknown[] | null]>();
  // @beginner: nextDeps 是本轮传入的依赖数组；undefined 会被规范化成 null。
  const nextDeps = deps ?? null;
  // @beginner: prevState 是上次保存的 [value, deps]。
  const prevState = hook.memoizedState;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextDeps !== null && prevState[1] !== null && areHookInputsEqual(nextDeps, prevState[1])) {
    // deps 每一项都 Object.is 相等，直接返回旧 value，不再执行 create。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return prevState[0];
  }

  // deps 变化或没有 deps，重新计算并覆盖缓存。
  // @beginner: nextValue 是 deps 变化后重新执行 create 得到的新缓存值。
  const nextValue = create();
  hook.memoizedState = [nextValue, nextDeps];
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextValue;
}

// @beginner: 进入 mountCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  // useCallback 缓存函数本身；实现上复用 useMemo。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return mountMemo(() => callback, deps);
}

// @beginner: 进入 updateCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateMemo(() => callback, deps);
}

// @beginner: 进入 mountEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: effect Hook 节点的 memoizedState 保存 effect 环形链表节点。
  const hook = mountWorkInProgressHook<Effect>();
  // HasEffect 表示本次 commit 需要执行 create；Passive 表示这是 useEffect。
  hook.memoizedState = pushEffect(HasEffect | Passive, create, deps ?? null);
}

// @beginner: 进入 updateEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: updateEffect 复用旧 Hook 节点，并根据 deps 决定是否带 HasEffect。
  const hook = updateWorkInProgressHook<Effect>();
  // @beginner: nextDeps 是本轮 useEffect 传入的依赖。
  const nextDeps = deps ?? null;
  // @beginner: prevEffect 是上次 render 登记的 effect 节点。
  const prevEffect = hook.memoizedState;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextDeps !== null && prevEffect.deps !== null && areHookInputsEqual(nextDeps, prevEffect.deps)) {
    // deps 没变：仍然记录 effect 节点，但不带 HasEffect，commit 时不会重新执行 create。
    hook.memoizedState = pushEffect(Passive, create, nextDeps);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // deps 变化或没有 deps：带 HasEffect，commit 后执行 cleanup + create。
  hook.memoizedState = pushEffect(HasEffect | Passive, create, nextDeps);
}

// @beginner: 进入 mountInsertionEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: insertion effect 也用 effect 节点，只是 tag 标记不同。
  const hook = mountWorkInProgressHook<Effect>();
  hook.memoizedState = pushEffect(HasEffect | Insertion, create, deps ?? null);
}

// @beginner: 进入 updateInsertionEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  updateEffectImpl(Insertion, create, deps);
}

// @beginner: 进入 mountLayoutEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: layout effect 也登记到 effect 环形链表，commit 时机早于 passive effect。
  const hook = mountWorkInProgressHook<Effect>();
  hook.memoizedState = pushEffect(HasEffect | Layout, create, deps ?? null);
}

// @beginner: 进入 updateLayoutEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  updateEffectImpl(Layout, create, deps);
}

// @beginner: 进入 updateEffectImpl：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateEffectImpl(
  effectTag: number,
  create: () => void | (() => void),
  deps?: unknown[],
): void {
  // @beginner: updateEffectImpl 统一处理 layout/insertion 这类 effect 的 deps 比较。
  const hook = updateWorkInProgressHook<Effect>();
  // @beginner: nextDeps 是本轮 effect 依赖数组。
  const nextDeps = deps ?? null;
  // @beginner: prevEffect 保存上次的 create/destroy/deps/tag。
  const prevEffect = hook.memoizedState;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextDeps !== null && prevEffect.deps !== null && areHookInputsEqual(nextDeps, prevEffect.deps)) {
    hook.memoizedState = pushEffect(effectTag, create, nextDeps);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  hook.memoizedState = pushEffect(HasEffect | effectTag, create, nextDeps);
}

// @beginner: 进入 mountImperativeHandle：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  mountLayoutEffect(createImperativeHandleEffect(ref, create), deps);
}

// @beginner: 进入 updateImperativeHandle：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  updateLayoutEffect(createImperativeHandleEffect(ref, create), deps);
}

// @beginner: 进入 createImperativeHandleEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createImperativeHandleEffect<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
): () => () => void {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (ref === null || ref === undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return () => undefined;
    }
    // @beginner: instance 是 create() 暴露给父组件 ref 的命令式对象。
    const instance = create();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof ref === "function") {
      ref(instance);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return () => ref(null);
    }
    ref.current = instance;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return () => {
      ref.current = null;
    };
  };
}

// @beginner: 进入 mountTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountTransition(): [boolean, (callback: () => void) => void] {
  // @beginner: transition Hook 保存 [isPending, startTransition] 这样的二元组。
  const hook = mountWorkInProgressHook<[boolean, (callback: () => void) => void]>();
  // @beginner: 定义 start：复刻版的 transition 启动函数，当前实现会同步执行 callback。
  const start = (callback: () => void) => callback();
  hook.memoizedState = [false, start];
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook.memoizedState;
}

// @beginner: 进入 updateTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateTransition(): [boolean, (callback: () => void) => void] {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateWorkInProgressHook<[boolean, (callback: () => void) => void]>().memoizedState;
}

// @beginner: 进入 mountDeferredValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountDeferredValue<T>(value: T, initialValue?: T): T {
  // @beginner: deferred Hook 的 memoizedState 保存当前应该返回的 deferred value。
  const hook = mountWorkInProgressHook<T>();
  hook.memoizedState = initialValue ?? value;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook.memoizedState;
}

// @beginner: 进入 updateDeferredValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateDeferredValue<T>(value: T): T {
  // @beginner: updateDeferredValue 在复刻版中直接覆盖为最新 value。
  const hook = updateWorkInProgressHook<T>();
  hook.memoizedState = value;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook.memoizedState;
}

// @beginner: 进入 mountId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountId(): string {
  // @beginner: id Hook 节点保存生成后的 id，后续 update 直接复用。
  const hook = mountWorkInProgressHook<string>();
  // @beginner: id 是复刻版按计数器生成的简单稳定标识。
  const id = `:r${localIdCounter++}:`;
  hook.memoizedState = id;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return id;
}

// @beginner: 进入 updateId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateId(): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateWorkInProgressHook<string>().memoizedState;
}

// @beginner: 进入 mountWorkInProgressHook：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountWorkInProgressHook<S>(): Hook<S> {
  // Hook 节点是一个链表节点，不同 Hook 只是在 memoizedState/queue 里放不同内容。
  // @beginner: hook 是新创建的 Hook 链表节点。
  const hook: Hook<S> = {
    memoizedState: null as S,
    baseState: null as S,
    baseQueue: null,
    queue: null as unknown as UpdateQueue<S, unknown>,
    next: null,
  };

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgressHook === null) {
    // 第一个 Hook 挂到 Fiber.memoizedState。
    currentlyRenderingFiber!.memoizedState = hook;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // 后续 Hook 追加到链表尾部。
    workInProgressHook.next = hook;
  }

  workInProgressHook = hook;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook;
}

// @beginner: 进入 updateWorkInProgressHook：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateWorkInProgressHook<S>(): Hook<S> {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentHook === null) {
    // 更新时 Hook 调用数量比上次多，说明违反了“Hook 调用顺序必须稳定”。
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Rendered more hooks than during the previous render.");
  }

  // 从旧 Hook 克隆出新 Hook。这样本轮 render 可以安全修改新链表，
  // 旧链表仍留在 current Fiber 上，直到 commit 后双缓存切换。
  // @beginner: hook 是从 currentHook 克隆出的 workInProgress Hook 节点。
  const hook: Hook<S> = {
    memoizedState: currentHook.memoizedState,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
    queue: currentHook.queue,
    next: null,
  };

  // 旧链表指针前进，等待下一个 useXxx 调用。
  currentHook = currentHook.next;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgressHook === null) {
    currentlyRenderingFiber!.memoizedState = hook;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    workInProgressHook.next = hook;
  }

  workInProgressHook = hook;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return hook;
}

// @beginner: 进入 dispatchSetState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function dispatchSetState<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A): void {
  // dispatch 被用户事件/异步回调触发时，先为这条更新申请 lane。
  // @beginner: lane 决定这条 setState/update 用哪个优先级调度。
  const lane = requestUpdateLane();
  // update 是环形链表里的一个节点，action 就是 setState(action) 的参数。
  // @beginner: update 保存 action、lane 和可选 eagerState，会被放进 Hook 队列。
  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  // @beginner: alternate 是双缓存另一侧 Fiber，用来判断当前是否已有待处理工作。
  const alternate = fiber.alternate;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
    // 如果当前 Fiber 没有待处理工作，可以先尝试 eager 计算新 state。
    // state 没变时直接跳过 schedule，减少一次无意义 render。
    // @beginner: lastRenderedReducer 是上次 render 使用的 reducer，可用于 eager 预计算。
    const lastRenderedReducer = queue.lastRenderedReducer;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lastRenderedReducer !== null) {
      // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
      try {
        // @beginner: currentState 是队列记录的上一次渲染状态。
        const currentState = queue.lastRenderedState as S;
        // @beginner: eagerState 是 dispatch 阶段提前算出的下一状态。
        const eagerState = lastRenderedReducer(currentState, action);
        update.hasEagerState = true;
        update.eagerState = eagerState;

        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (objectIs(eagerState, currentState)) {
          // 官方 eager bailout：state 不变时保留 update 供后续 rebase，但不调度 root。
          enqueueHookUpdate(queue, update);
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return;
        }
      // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
      } catch {
        // eager 计算失败时保持官方语义：错误留到 render 阶段再次抛出。
      }
    }
  }

  enqueueHookUpdate(queue, update);
  entangleTransitionUpdate(fiber, queue, lane);
  // 从当前 Fiber 往上找到 root，安排 render/commit。
  scheduleUpdateOnFiber(fiber, lane);
}

// @beginner: 进入 enqueueHookUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function enqueueHookUpdate<S, A>(queue: UpdateQueue<S, A>, update: Update<S, A>): void {
  // queue.pending 指向环形链表尾节点。
  // 第一次入队：update.next 指向自己。
  // 后续入队：插入到 pending 和 first 之间，然后 pending 指向新 update。
  // @beginner: pending 指向当前环形更新队列的尾节点。
  const pending = queue.pending;
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

// @beginner: 进入 entangleTransitionUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function entangleTransitionUpdate<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  lane: Lanes,
): void {
  // @beginner: updateLane 是 transition entangle 时使用的原始 lane。
  const updateLane = removeLanes(lane, OffscreenLane);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isTransitionLane(updateLane)) {
    // @beginner: node 从触发更新的 Fiber 向上找到 root。
    let node: Fiber = fiber;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (node.return !== null) {
      node = node.return;
    }
    // @beginner: root 保存 pendingLanes/entangledLanes，用来合并 transition 工作。
    const root = node.stateNode as { pendingLanes?: Lanes; entangledLanes?: Lanes } | null;
    // @beginner: pendingLanes 是 root 上仍等待处理的 lanes。
    const pendingLanes = root?.pendingLanes ?? NoLanes;
    // @beginner: queueLanes 是该 Hook 队列当前仍相关的 pending lanes。
    const queueLanes = intersectLanes(queue.lanes, pendingLanes);
    // @beginner: newQueueLanes 把当前 transition lane 合并进 Hook 队列。
    const newQueueLanes = mergeLanes(queueLanes, updateLane);
    queue.lanes = newQueueLanes;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (root !== null) {
      root.entangledLanes = mergeLanes(root.entangledLanes ?? NoLanes, newQueueLanes);
    }
  }
}

// @beginner: 进入 pushEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function pushEffect(
  tag: number,
  create: () => void | (() => void),
  deps: unknown[] | null,
): Effect {
  // effect 也是环形链表节点，挂在函数组件 Fiber.updateQueue.lastEffect 上。
  // @beginner: effect 节点保存 create/destroy/deps/tag，并串到 Fiber 的 effect 环上。
  const effect: Effect = {
    tag,
    create,
    destroy: undefined,
    deps,
    next: null,
  };
  // @beginner: fiber 是当前正在 render 的函数组件 Fiber。
  const fiber = currentlyRenderingFiber!;
  // 给 Fiber 打 Passive 标记，commit 阶段才会进入 Hook effect 处理。
  fiber.flags |= PassiveFiberFlag;

  // @beginner: updateQueue 对函数组件来说保存 lastEffect 指针。
  let updateQueue = fiber.updateQueue as FunctionComponentUpdateQueue | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (updateQueue === null) {
    updateQueue = { lastEffect: null };
    fiber.updateQueue = updateQueue;
  }

  // @beginner: lastEffect 是 effect 环形链表的尾节点。
  const lastEffect = updateQueue.lastEffect;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lastEffect === null) {
    // 第一个 effect：自己指向自己。
    effect.next = effect;
    updateQueue.lastEffect = effect;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // 新 effect 插入到 lastEffect 后面，并成为新的 lastEffect。
    // @beginner: firstEffect 是环形链表的头节点，用来把新 effect 插入尾节点后。
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    updateQueue.lastEffect = effect;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return effect;
}

// @beginner: 进入 basicStateReducer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function basicStateReducer<S>(state: S, action: StateAction<S>): S {
  // useState 的 action 可以是值，也可以是 updater(prevState)。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof action === "function" ? (action as (prevState: S) => S)(state) : action;
}

// @beginner: 进入 areHookInputsEqual：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function areHookInputsEqual(nextDeps: unknown[], prevDeps: unknown[]): boolean {
  // deps 数量不同直接认为变化；数量相同再逐个 Object.is 比较。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextDeps.length !== prevDeps.length) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < nextDeps.length; i += 1) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!Object.is(nextDeps[i], prevDeps[i])) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}
