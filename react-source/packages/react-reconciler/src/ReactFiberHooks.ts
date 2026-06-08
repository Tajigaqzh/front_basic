import { objectIs, ReactSharedInternals } from "shared";
import type { Dispatch, Props, ReactNode, StateAction } from "shared";
import { Passive as PassiveFiberFlag } from "./ReactFiberFlags.js";
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
import { HasEffect, Insertion, Layout, Passive } from "./ReactHookEffectTags.js";
import { DefaultAsyncDispatcher } from "./ReactFiberAsyncDispatcher.js";
import type {
  Effect,
  Fiber,
  FunctionComponentUpdateQueue,
  Hook,
  Update,
  UpdateQueue,
} from "./ReactInternalTypes.js";
import { requestUpdateLane, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";
import { prepareToReadContext, readContext, resetContextDependencies } from "./ReactFiberNewContext.js";
import {
  peekEntangledActionLane,
  peekEntangledActionThenable,
} from "./ReactFiberAsyncAction.js";

let currentlyRenderingFiber: Fiber | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let currentlyRenderingLanes: Lanes = NoLanes;

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

let localIdCounter = 0;

export function renderWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (props: Props, secondArg?: unknown) => ReactNode,
  props: Props,
  secondArg?: unknown,
  renderLanes: Lanes = SyncLane,
): ReactNode {
  currentlyRenderingFiber = workInProgress;
  currentlyRenderingLanes = renderLanes;
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgressHook = null;
  currentHook = current?.memoizedState ?? null;

  // React 包里的 useXxx 只查 dispatcher；mount/update 由 reconciler 在这里切换。
  const previousAsyncDispatcher = ReactSharedInternals.A;
  ReactSharedInternals.H = currentHook === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
  ReactSharedInternals.A = DefaultAsyncDispatcher;
  prepareToReadContext(workInProgress, renderLanes);
  const children = Component(props, secondArg);
  ReactSharedInternals.H = null;
  ReactSharedInternals.A = previousAsyncDispatcher;
  resetContextDependencies();

  currentlyRenderingFiber = null;
  currentlyRenderingLanes = NoLanes;
  workInProgressHook = null;
  currentHook = null;

  return children;
}

function mountState<S>(initialState: S | (() => S)): [S, Dispatch<StateAction<S>>] {
  return mountReducer(basicStateReducer<S>, initialState as S);
}

function updateState<S>(): [S, Dispatch<StateAction<S>>] {
  return updateReducer(basicStateReducer<S>);
}

function mountReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: (initialArg: S) => S,
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook<S>();
  const fiber = currentlyRenderingFiber!;
  const initialState =
    init !== undefined
      ? init(initialArg)
      : typeof initialArg === "function"
        ? (initialArg as () => S)()
        : initialArg;

  hook.memoizedState = initialState;
  hook.baseState = initialState;
  hook.baseQueue = null;

  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;

  const dispatch: Dispatch<A> = (action) => dispatchSetState(fiber, queue, action);
  queue.dispatch = dispatch;

  return [hook.memoizedState, dispatch];
}

function updateReducer<S, A>(reducer: (state: S, action: A) => S): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook<S>();
  const queue = hook.queue as UpdateQueue<S, A>;
  queue.lastRenderedReducer = reducer;
  const pendingQueue = queue.pending;
  let baseQueue = hook.baseQueue as Update<S, A> | null;

  if (pendingQueue !== null) {
    queue.pending = null;
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    baseQueue = pendingQueue;
    hook.baseQueue = pendingQueue;
  }

  if (baseQueue === null) {
    hook.memoizedState = hook.baseState;
    queue.lastRenderedState = hook.memoizedState;
    return [hook.memoizedState, queue.dispatch as Dispatch<A>];
  }

  const first = baseQueue.next;
  let update = first;
  const previousMemoizedState = hook.memoizedState;
  let newState = hook.baseState;
  let newBaseState: S | null = null;
  let newBaseQueueFirst: Update<S, A> | null = null;
  let newBaseQueueLast: Update<S, A> | null = null;
  let didReadFromEntangledAsyncAction = false;

  if (update !== null) {
    do {
      const updateLane = removeLanes(update.lane, OffscreenLane);
      const shouldSkipUpdate = !isSubsetOfLanes(currentlyRenderingLanes, updateLane);

      if (shouldSkipUpdate) {
        // 优先级不足时保留原 lane，下一轮包含该 lane 的 render 会从 newBaseState 重新计算。
        const clone: Update<S, A> = {
          lane: updateLane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null,
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        currentlyRenderingFiber!.lanes = mergeLanes(currentlyRenderingFiber!.lanes, updateLane);
      } else {
        if (newBaseQueueLast !== null) {
          // 前面发生过跳过时，后续已应用更新也要以 NoLane 克隆进 baseQueue，
          // 这样重放低优先级更新时仍能得到与官方一致的 rebasing 顺序。
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
        if (updateLane !== NoLane && updateLane === peekEntangledActionLane()) {
          didReadFromEntangledAsyncAction = true;
        }
        newState = update.hasEagerState ? (update.eagerState as S) : reducer(newState, update.action);
      }

      update = update.next;
    } while (update !== null && update !== first);
  }

  if (newBaseQueueLast === null) {
    hook.baseState = newState;
    hook.baseQueue = null;
  } else {
    newBaseQueueLast.next = newBaseQueueFirst;
    hook.baseState = newBaseState as S;
    hook.baseQueue = newBaseQueueLast;
  }

  if (!objectIs(newState, previousMemoizedState) && didReadFromEntangledAsyncAction) {
    const entangledActionThenable = peekEntangledActionThenable();
    if (entangledActionThenable !== null) {
      throw entangledActionThenable;
    }
  }

  hook.memoizedState = newState;
  queue.lastRenderedState = newState;

  if (hook.baseQueue === null) {
    queue.lanes = NoLanes;
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<A>];
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook<{ current: T }>();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(): { current: T } {
  return updateWorkInProgressHook<{ current: T }>().memoizedState;
}

function mountMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  const hook = mountWorkInProgressHook<[T, unknown[] | null]>();
  const value = create();
  hook.memoizedState = [value, deps ?? null];
  return value;
}

function updateMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  const hook = updateWorkInProgressHook<[T, unknown[] | null]>();
  const nextDeps = deps ?? null;
  const prevState = hook.memoizedState;

  if (nextDeps !== null && prevState[1] !== null && areHookInputsEqual(nextDeps, prevState[1])) {
    return prevState[0];
  }

  const nextValue = create();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function mountCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  return mountMemo(() => callback, deps);
}

function updateCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  return updateMemo(() => callback, deps);
}

function mountEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const hook = mountWorkInProgressHook<Effect>();
  hook.memoizedState = pushEffect(HasEffect | Passive, create, deps ?? null);
}

function updateEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const hook = updateWorkInProgressHook<Effect>();
  const nextDeps = deps ?? null;
  const prevEffect = hook.memoizedState;

  if (nextDeps !== null && prevEffect.deps !== null && areHookInputsEqual(nextDeps, prevEffect.deps)) {
    hook.memoizedState = pushEffect(Passive, create, nextDeps);
    return;
  }

  hook.memoizedState = pushEffect(HasEffect | Passive, create, nextDeps);
}

function mountInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const hook = mountWorkInProgressHook<Effect>();
  hook.memoizedState = pushEffect(HasEffect | Insertion, create, deps ?? null);
}

function updateInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  updateEffectImpl(Insertion, create, deps);
}

function mountLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const hook = mountWorkInProgressHook<Effect>();
  hook.memoizedState = pushEffect(HasEffect | Layout, create, deps ?? null);
}

function updateLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  updateEffectImpl(Layout, create, deps);
}

function updateEffectImpl(
  effectTag: number,
  create: () => void | (() => void),
  deps?: unknown[],
): void {
  const hook = updateWorkInProgressHook<Effect>();
  const nextDeps = deps ?? null;
  const prevEffect = hook.memoizedState;

  if (nextDeps !== null && prevEffect.deps !== null && areHookInputsEqual(nextDeps, prevEffect.deps)) {
    hook.memoizedState = pushEffect(effectTag, create, nextDeps);
    return;
  }

  hook.memoizedState = pushEffect(HasEffect | effectTag, create, nextDeps);
}

function mountImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  mountLayoutEffect(createImperativeHandleEffect(ref, create), deps);
}

function updateImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  updateLayoutEffect(createImperativeHandleEffect(ref, create), deps);
}

function createImperativeHandleEffect<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
): () => () => void {
  return () => {
    if (ref === null || ref === undefined) {
      return () => undefined;
    }
    const instance = create();
    if (typeof ref === "function") {
      ref(instance);
      return () => ref(null);
    }
    ref.current = instance;
    return () => {
      ref.current = null;
    };
  };
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const hook = mountWorkInProgressHook<[boolean, (callback: () => void) => void]>();
  const start = (callback: () => void) => callback();
  hook.memoizedState = [false, start];
  return hook.memoizedState;
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  return updateWorkInProgressHook<[boolean, (callback: () => void) => void]>().memoizedState;
}

function mountDeferredValue<T>(value: T, initialValue?: T): T {
  const hook = mountWorkInProgressHook<T>();
  hook.memoizedState = initialValue ?? value;
  return hook.memoizedState;
}

function updateDeferredValue<T>(value: T): T {
  const hook = updateWorkInProgressHook<T>();
  hook.memoizedState = value;
  return hook.memoizedState;
}

function mountId(): string {
  const hook = mountWorkInProgressHook<string>();
  const id = `:r${localIdCounter++}:`;
  hook.memoizedState = id;
  return id;
}

function updateId(): string {
  return updateWorkInProgressHook<string>().memoizedState;
}

function mountWorkInProgressHook<S>(): Hook<S> {
  const hook: Hook<S> = {
    memoizedState: null as S,
    baseState: null as S,
    baseQueue: null,
    queue: null as unknown as UpdateQueue<S, unknown>,
    next: null,
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber!.memoizedState = hook;
  } else {
    workInProgressHook.next = hook;
  }

  workInProgressHook = hook;
  return hook;
}

function updateWorkInProgressHook<S>(): Hook<S> {
  if (currentHook === null) {
    throw new Error("Rendered more hooks than during the previous render.");
  }

  const hook: Hook<S> = {
    memoizedState: currentHook.memoizedState,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
    queue: currentHook.queue,
    next: null,
  };

  currentHook = currentHook.next;

  if (workInProgressHook === null) {
    currentlyRenderingFiber!.memoizedState = hook;
  } else {
    workInProgressHook.next = hook;
  }

  workInProgressHook = hook;
  return hook;
}

function dispatchSetState<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A): void {
  const lane = requestUpdateLane();
  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  const alternate = fiber.alternate;
  if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
    const lastRenderedReducer = queue.lastRenderedReducer;
    if (lastRenderedReducer !== null) {
      try {
        const currentState = queue.lastRenderedState as S;
        const eagerState = lastRenderedReducer(currentState, action);
        update.hasEagerState = true;
        update.eagerState = eagerState;

        if (objectIs(eagerState, currentState)) {
          // 官方 eager bailout：state 不变时保留 update 供后续 rebase，但不调度 root。
          enqueueHookUpdate(queue, update);
          return;
        }
      } catch {
        // eager 计算失败时保持官方语义：错误留到 render 阶段再次抛出。
      }
    }
  }

  enqueueHookUpdate(queue, update);
  entangleTransitionUpdate(fiber, queue, lane);
  scheduleUpdateOnFiber(fiber, lane);
}

function enqueueHookUpdate<S, A>(queue: UpdateQueue<S, A>, update: Update<S, A>): void {
  const pending = queue.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
}

function entangleTransitionUpdate<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  lane: Lanes,
): void {
  const updateLane = removeLanes(lane, OffscreenLane);
  if (isTransitionLane(updateLane)) {
    let node: Fiber = fiber;
    while (node.return !== null) {
      node = node.return;
    }
    const root = node.stateNode as { pendingLanes?: Lanes; entangledLanes?: Lanes } | null;
    const pendingLanes = root?.pendingLanes ?? NoLanes;
    const queueLanes = intersectLanes(queue.lanes, pendingLanes);
    const newQueueLanes = mergeLanes(queueLanes, updateLane);
    queue.lanes = newQueueLanes;
    if (root !== null) {
      root.entangledLanes = mergeLanes(root.entangledLanes ?? NoLanes, newQueueLanes);
    }
  }
}

function pushEffect(
  tag: number,
  create: () => void | (() => void),
  deps: unknown[] | null,
): Effect {
  const effect: Effect = {
    tag,
    create,
    destroy: undefined,
    deps,
    next: null,
  };
  const fiber = currentlyRenderingFiber!;
  fiber.flags |= PassiveFiberFlag;

  let updateQueue = fiber.updateQueue as FunctionComponentUpdateQueue | null;
  if (updateQueue === null) {
    updateQueue = { lastEffect: null };
    fiber.updateQueue = updateQueue;
  }

  const lastEffect = updateQueue.lastEffect;
  if (lastEffect === null) {
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    updateQueue.lastEffect = effect;
  }

  return effect;
}

function basicStateReducer<S>(state: S, action: StateAction<S>): S {
  return typeof action === "function" ? (action as (prevState: S) => S)(state) : action;
}

function areHookInputsEqual(nextDeps: unknown[], prevDeps: unknown[]): boolean {
  if (nextDeps.length !== prevDeps.length) {
    return false;
  }

  for (let i = 0; i < nextDeps.length; i += 1) {
    if (!Object.is(nextDeps[i], prevDeps[i])) {
      return false;
    }
  }

  return true;
}
