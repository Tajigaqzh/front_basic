import { describe, expect, it } from "vitest";
import { createContext, startTransition, useReducer } from "react";
import { REACT_ELEMENT_TYPE, REACT_PORTAL_TYPE, REACT_SUSPENSE_TYPE } from "shared";
import type { Fiber, FiberRoot, Hook } from "../packages/react-reconciler/src/ReactInternalTypes.js";
import {
  createHostRootFiber,
  createFiberFromElement,
  createWorkInProgress,
  FiberNode,
} from "../packages/react-reconciler/src/ReactFiber.js";
import {
  beginWork,
  SelectiveHydrationException,
} from "../packages/react-reconciler/src/ReactFiberBeginWork.js";
import { completeWork } from "../packages/react-reconciler/src/ReactFiberCompleteWork.js";
import { commitMutationEffects } from "../packages/react-reconciler/src/ReactFiberCommitWork.js";
import { createCapturedValueAtFiber } from "../packages/react-reconciler/src/ReactCapturedValue.js";
import {
  createUpdate,
  enqueueUpdate,
  entangleTransitions,
  initializeUpdateQueue,
  processUpdateQueue,
  ReplaceState,
  suspendIfUpdateReadFromEntangledAsyncAction,
  type UpdateQueue,
} from "../packages/react-reconciler/src/ReactFiberClassUpdateQueue.js";
import {
  enqueueConcurrentHookUpdate,
  finishQueueingConcurrentUpdates,
  getConcurrentlyUpdatedLanes,
} from "../packages/react-reconciler/src/ReactFiberConcurrentUpdates.js";
import {
  requestTransitionLane,
  scheduleTaskForRootDuringMicrotask,
} from "../packages/react-reconciler/src/ReactFiberRootScheduler.js";
import { throwException } from "../packages/react-reconciler/src/ReactFiberThrow.js";
import { unwindWork } from "../packages/react-reconciler/src/ReactFiberUnwindWork.js";
import {
  createCursor,
  pop,
  push,
} from "../packages/react-reconciler/src/ReactFiberStack.js";
import {
  popProvider,
  prepareToReadContext,
  pushProvider,
  readContext,
  resetContextDependencies,
} from "../packages/react-reconciler/src/ReactFiberNewContext.js";
import {
  createThenableState,
  getSuspendedThenable,
  SuspenseException,
  trackUsedThenable,
  type ThenableState,
} from "../packages/react-reconciler/src/ReactFiberThenable.js";
import {
  findFirstSuspended,
  getSuspenseInstanceFallbackErrorDetails,
  isSuspenseInstanceFallback,
  isSuspenseInstancePending,
} from "../packages/react-reconciler/src/ReactFiberSuspenseComponent.js";
import { DidCapture, ShouldCapture } from "../packages/react-reconciler/src/ReactFiberFlags.js";
import { Forked } from "../packages/react-reconciler/src/ReactFiberFlags.js";
import {
  getNextLanes,
  getBumpedLaneForHydration,
  DefaultLane,
  includesSomeLane,
  NoLane,
  NoLanes,
  OffscreenLane,
  RetryLane,
  SyncLane,
  TransitionLane,
  TransitionLane2,
  TransitionLanes,
} from "../packages/react-reconciler/src/ReactFiberLane.js";
import { renderWithHooks } from "../packages/react-reconciler/src/ReactFiberHooks.js";
import {
  performConcurrentWorkOnRoot,
  requestUpdateLane,
} from "../packages/react-reconciler/src/ReactFiberWorkLoop.js";
import {
  FunctionComponent,
  ClassComponent,
  ContextProvider,
  DehydratedFragment,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
  SuspenseListComponent,
} from "../packages/react-reconciler/src/ReactWorkTags.js";
import {
  getEntangledRenderLanes,
  isCurrentTreeHidden,
  popHiddenContext,
  pushHiddenContext,
} from "../packages/react-reconciler/src/ReactFiberHiddenContext.js";
import {
  ForceSuspenseFallback,
  getShellBoundary,
  getSuspenseHandler,
  hasSuspenseListContext,
  popSuspenseHandler,
  popSuspenseListContext,
  pushOffscreenSuspenseHandler,
  pushPrimaryTreeSuspenseHandler,
  pushSuspenseListCatch,
} from "../packages/react-reconciler/src/ReactFiberSuspenseContext.js";
import {
  createOffscreenInstance,
  isOffscreenVisible,
  OffscreenVisible,
} from "../packages/react-reconciler/src/ReactFiberOffscreenComponent.js";
import {
  CacheContext,
  createCache,
  popCacheProvider,
  pushCacheProvider,
  releaseCache,
  retainCache,
} from "../packages/react-reconciler/src/ReactFiberCacheComponent.js";
import { createPortal } from "../packages/react-reconciler/src/ReactPortal.js";
import { getStackByFiberInDevAndProd } from "../packages/react-reconciler/src/ReactFiberComponentStack.js";
import { clz32 } from "../packages/react-reconciler/src/clz32.js";
import * as MutationTracking from "../packages/react-reconciler/src/ReactFiberMutationTracking.js";
import * as ProfilerTimer from "../packages/react-reconciler/src/ReactProfilerTimer.js";
import * as DevToolsHook from "../packages/react-reconciler/src/ReactFiberDevToolsHook.js";
import {
  getForksAtLevel,
  getSuspendedTreeContext,
  getTreeId,
  isForkedChild,
  popTreeContext,
  pushMaterializedTreeId,
  pushTreeFork,
  pushTreeId,
  restoreSuspendedTreeContext,
} from "../packages/react-reconciler/src/ReactFiberTreeContext.js";
import {
  emptyContextObject,
  findCurrentUnmaskedContext,
  getMaskedContext,
  getUnmaskedContext,
  hasContextChanged,
  invalidateContextProvider,
  isContextProvider,
  popContext,
  popTopLevelContextObject,
  processChildContext,
  pushContextProvider,
  pushTopLevelContextObject,
} from "../packages/react-reconciler/src/ReactFiberLegacyContext.js";
import {
  enterHydrationState,
  getDidSuspendOrErrorDEV,
  getIsHydrating,
  markDidThrowWhileHydratingDEV,
  popHydrationState,
  queueHydrationError,
  resetHydrationState,
  tryToClaimNextHydratableTextInstance,
  upgradeHydrationErrorsToRecoverable,
} from "../packages/react-reconciler/src/ReactFiberHydrationContext.js";
import { isRootDehydrated } from "../packages/react-reconciler/src/ReactFiberShellHydration.js";
import {
  chainThenableValue,
  entangleAsyncAction,
  peekEntangledActionLane,
  peekEntangledActionThenable,
} from "../packages/react-reconciler/src/ReactFiberAsyncAction.js";
import { DefaultAsyncDispatcher } from "../packages/react-reconciler/src/ReactFiberAsyncDispatcher.js";
import {
  claimQueuedTransitionTypes,
  clearEntangledAsyncTransitionTypes,
  entangleAsyncTransitionTypes,
} from "../packages/react-reconciler/src/ReactFiberTransitionTypes.js";
import {
  NoTransition,
  requestCurrentTransition,
} from "../packages/react-reconciler/src/ReactFiberTransition.js";
import ReactSharedInternals from "../packages/shared/ReactSharedInternals.js";
import {
  logCaughtError,
  logRecoverableError,
  logUncaughtError,
} from "../packages/react-reconciler/src/ReactFiberErrorLogger.js";
import { schedulePostPaintCallback } from "../packages/react-reconciler/src/ReactPostPaintCallback.js";
import {
  callComponentDidCatchInDEV,
  callComponentDidMountInDEV,
  callComponentInDEV,
  callDestroyInDEV,
  callLazyInitInDEV,
  callRenderInDEV,
} from "../packages/react-reconciler/src/ReactFiberCallUserSpace.js";
import { isRendering } from "../packages/react-reconciler/src/ReactCurrentFiber.js";
import { describeDiff } from "../packages/react-reconciler/src/ReactFiberHydrationDiffs.js";
import * as NoMutation from "../packages/react-reconciler/src/ReactFiberConfigWithNoMutation.js";
import * as NoPersistence from "../packages/react-reconciler/src/ReactFiberConfigWithNoPersistence.js";
import * as NoHydration from "../packages/react-reconciler/src/ReactFiberConfigWithNoHydration.js";
import * as NoResources from "../packages/react-reconciler/src/ReactFiberConfigWithNoResources.js";
import * as NoSingletons from "../packages/react-reconciler/src/ReactFiberConfigWithNoSingletons.js";
import * as NoMicrotasks from "../packages/react-reconciler/src/ReactFiberConfigWithNoMicrotasks.js";
import * as NoScopes from "../packages/react-reconciler/src/ReactFiberConfigWithNoScopes.js";
import * as NoTestSelectors from "../packages/react-reconciler/src/ReactFiberConfigWithNoTestSelectors.js";
import { attachScopeFiber, createScopeInstance } from "../packages/react-reconciler/src/ReactFiberScope.js";
import { isConcurrentActEnvironment, isLegacyActEnvironment } from "../packages/react-reconciler/src/ReactFiberAct.js";
import {
  logComponentRender,
  performanceTrackEvents,
  popDeepEquality,
  pushDeepEquality,
  setCurrentTrackFromLanes,
} from "../packages/react-reconciler/src/ReactFiberPerformanceTrack.js";
import ReactStrictModeWarnings from "../packages/react-reconciler/src/ReactStrictModeWarnings.js";
import {
  createComponentSelector,
  createRoleSelector,
  createTestNameSelector,
  createTextSelector,
  findAllNodes,
  focusWithin,
  getFindAllNodesFailureDescription,
} from "../packages/react-reconciler/src/ReactTestSelectors.js";
import {
  isCompatibleFamilyForHotReloading,
  resolveForwardRefForHotReloading,
  resolveFunctionForHotReloading,
  setRefreshHandler,
} from "../packages/react-reconciler/src/ReactFiberHotReloading.js";
import { ScopeComponent } from "../packages/react-reconciler/src/ReactWorkTags.js";
import * as NoViewTransition from "../packages/react-reconciler/src/ReactFiberConfigWithNoViewTransition.js";
import {
  createViewTransitionState,
  getViewTransitionClassName,
  getViewTransitionName,
  setPendingTransitionTypesForTest,
} from "../packages/react-reconciler/src/ReactFiberViewTransitionComponent.js";
import {
  committedViewTransitions,
  commitEnterViewTransitions,
  measuredViewTransitions,
  measureViewTransitionHostInstances,
  popViewTransitionCancelableScope,
  pushViewTransitionCancelableScope,
  resetShouldStartViewTransition,
  shouldStartViewTransition,
  trackAppearingViewTransition,
} from "../packages/react-reconciler/src/ReactFiberCommitViewTransitions.js";
import {
  getViewTransitionNameCount,
  trackNamedViewTransition,
  untrackNamedViewTransition,
} from "../packages/react-reconciler/src/ReactFiberDuplicateViewTransitions.js";
import {
  cancelScheduledGesture,
  getScheduledGestures,
  scheduleGesture,
  scheduleGestureCommit,
  startScheduledGesture,
  stopCommittedGesture,
} from "../packages/react-reconciler/src/ReactFiberGestureScheduler.js";
import {
  applyDepartureTransitions,
  gestureApplicationRecords,
  insertDestinationClones,
  startGestureAnimations,
} from "../packages/react-reconciler/src/ReactFiberApplyGesture.js";
import {
  getMarkerInstances,
  popMarkerInstance,
  popRootMarkerInstance,
  processTransitionCallbacks,
  pushMarkerInstance,
  pushRootMarkerInstance,
} from "../packages/react-reconciler/src/ReactFiberTracingMarkerComponent.js";
import * as DomFiberConfigFork from "../packages/react-reconciler/src/forks/ReactFiberConfig.dom.js";

function createRootWithChild(child: Fiber): FiberRoot {
  const rootFiber = createHostRootFiber();
  const root = {
    containerInfo: {} as Element,
    current: rootFiber,
    finishedWork: null,
    pendingLanes: 0,
    callbackNode: null,
    callbackPriority: 0,
    next: null,
  };
  rootFiber.stateNode = root;
  child.return = rootFiber;
  return root as FiberRoot;
}

function createManualWakeable() {
  const fulfillCallbacks: Array<() => void> = [];
  const rejectCallbacks: Array<() => void> = [];
  return {
    wakeable: {
      then(onFulfill: () => void, onReject: () => void) {
        fulfillCallbacks.push(onFulfill);
        rejectCallbacks.push(onReject);
      },
    },
    resolve() {
      for (const callback of fulfillCallbacks) {
        callback();
      }
    },
    get listenerCount() {
      return fulfillCallbacks.length + rejectCallbacks.length;
    },
  };
}

describe("ReactFiberStack", () => {
  it("按 Fiber 入栈顺序恢复 cursor.current", () => {
    const root = createHostRootFiber();
    const child = new FiberNode(FunctionComponent, {}, null);
    const cursor = createCursor("root");

    push(cursor, "parent", root);
    push(cursor, "child", child);
    expect(cursor.current).toBe("child");

    pop(cursor, child);
    expect(cursor.current).toBe("parent");
    pop(cursor, root);
    expect(cursor.current).toBe("root");
  });
});

describe("ReactFiberConcurrentUpdates", () => {
  it("暂存 concurrent update，finish 后落入 pending 环形队列并向 root 标记 lane", () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    const root = createRootWithChild(fiber);
    const queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: null,
      lastRenderedState: 0,
    };
    const update = {
      lane: SyncLane,
      action: 1,
      hasEagerState: false,
      eagerState: null,
      next: null,
    };

    expect(enqueueConcurrentHookUpdate(fiber, queue, update, SyncLane)).toBe(root);
    expect(queue.pending).toBeNull();
    expect(getConcurrentlyUpdatedLanes()).toBe(SyncLane);

    finishQueueingConcurrentUpdates();

    expect(queue.pending).toBe(update);
    expect(update.next).toBe(update);
    expect(root.pendingLanes).toBe(SyncLane);
    expect(root.current.childLanes).toBe(SyncLane);
  });
});

describe("ReactFiberHooks update queue lanes", () => {
  it("useReducer eager state 相等时保留 pending update 但不调度 root", () => {
    let dispatch: ((action: number) => void) | null = null;
    function Counter() {
      const [count, update] = useReducer((state: number, action: number) => state + action, 0);
      dispatch = update;
      return count;
    }

    const current = new FiberNode(FunctionComponent, {}, null);
    current.type = Counter;
    const root = createRootWithChild(current);

    expect(renderWithHooks(null, current, Counter, {}, undefined, SyncLane)).toBe(0);

    dispatch?.(0);

    const hook = current.memoizedState as Hook<number>;
    expect(root.pendingLanes).toBe(0);
    expect(current.lanes).toBe(0);
    expect(hook.queue.pending?.hasEagerState).toBe(true);
    expect(hook.queue.pending?.eagerState).toBe(0);
  });

  it("useReducer 按 renderLanes 跳过低优先级 update，并在下一轮从 baseQueue 重放", async () => {
    const previousNode = globalThis.Node;
    const previousElement = globalThis.Element;
    let dispatch: ((action: number) => void) | null = null;
    function Counter() {
      const [count, update] = useReducer((state: number, action: number) => state + action, 0);
      dispatch = update;
      return count;
    }

    Object.assign(globalThis, {
      Node: class Node {
        static DOCUMENT_FRAGMENT_NODE = 11;
      },
      Element: class Element {},
    });

    try {
      const current = new FiberNode(FunctionComponent, {}, null);
      current.type = Counter;
      const root = createRootWithChild(current);

      expect(renderWithHooks(null, current, Counter, {}, undefined, SyncLane)).toBe(0);
      current.memoizedProps = {};

      startTransition(() => {
        dispatch?.(10);
      });
      dispatch?.(1);
      const mountedHook = current.memoizedState as Hook<number>;
      const transitionLane = mountedHook.queue.lanes;
      expect(includesSomeLane(transitionLane, TransitionLanes)).toBe(true);
      expect(root.entangledLanes).toBe(transitionLane);

      const syncWork = createWorkInProgress(current, {});
      expect(renderWithHooks(current, syncWork, Counter, {}, undefined, SyncLane)).toBe(1);

      const syncHook = syncWork.memoizedState as Hook<number>;
      expect(syncHook.baseState).toBe(0);
      expect(syncHook.baseQueue?.next?.lane).toBe(transitionLane);
      expect(syncHook.baseQueue?.lane).toBe(NoLane);

      const transitionWork = createWorkInProgress(syncWork, {});
      expect(renderWithHooks(syncWork, transitionWork, Counter, {}, undefined, transitionLane)).toBe(11);

      const transitionHook = transitionWork.memoizedState as Hook<number>;
      expect(transitionHook.baseState).toBe(11);
      expect(transitionHook.baseQueue).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      Object.assign(globalThis, {
        Node: previousNode,
        Element: previousElement,
      });
    }
  });
});

describe("ReactFiberRootScheduler", () => {
  it("根据 root.pendingLanes 创建 root callback 并记录 callbackPriority", async () => {
    const previousNode = globalThis.Node;
    const previousElement = globalThis.Element;
    Object.assign(globalThis, {
      Node: class Node {
        static DOCUMENT_FRAGMENT_NODE = 11;
      },
      Element: class Element {},
    });
    try {
      const rootFiber = createHostRootFiber();
      const root: FiberRoot = {
        containerInfo: {} as Element,
        current: rootFiber,
        finishedWork: null,
        pendingLanes: SyncLane,
        callbackNode: null,
        callbackPriority: 0,
        next: null,
      };
      rootFiber.stateNode = root;

      expect(scheduleTaskForRootDuringMicrotask(root)).toBe(SyncLane);
      expect(root.callbackNode).not.toBeNull();
      expect(root.callbackPriority).toBe(SyncLane);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      Object.assign(globalThis, {
        Node: previousNode,
        Element: previousElement,
      });
    }
  });

  it("requestTransitionLane 对不同 transition 轮转，对同一 transition 复用", () => {
    const firstTransition = {};
    const secondTransition = {};

    const firstLane = requestTransitionLane(firstTransition);
    const secondLane = requestTransitionLane(secondTransition);

    expect(includesSomeLane(firstLane, TransitionLanes)).toBe(true);
    expect(includesSomeLane(secondLane, TransitionLanes)).toBe(true);
    expect(secondLane).not.toBe(firstLane);
    expect(requestTransitionLane(firstTransition)).toBe(firstLane);
  });

  it("getNextLanes 会把选中的 entangled pending lanes 一起返回", () => {
    const root = {
      pendingLanes: TransitionLane | TransitionLane2,
      entangledLanes: TransitionLane | TransitionLane2,
    };

    expect(getNextLanes(root)).toBe(TransitionLane | TransitionLane2);
  });
});

describe("ReactFiberUnwindWork", () => {
  it("unwind 捕获 ShouldCapture 并转换为 DidCapture", () => {
    const suspense = new FiberNode(SuspenseComponent, {}, null);
    suspense.flags |= ShouldCapture;

    expect(unwindWork(null, suspense, SyncLane)).toBe(suspense);
    expect((suspense.flags & ShouldCapture)).toBe(0);
    expect((suspense.flags & DidCapture)).toBe(DidCapture);
  });
});

describe("ReactFiberThrow", () => {
  it("wakeable 会标记最近 Suspense 边界并保存 retryQueue", () => {
    const rootFiber = createHostRootFiber();
    const suspense = new FiberNode(SuspenseComponent, {}, null);
    const source = new FiberNode(FunctionComponent, {}, null);
    const root: FiberRoot = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: 0,
      callbackNode: null,
      callbackPriority: 0,
      next: null,
    };
    rootFiber.stateNode = root;
    rootFiber.child = suspense;
    suspense.return = rootFiber;
    suspense.child = source;
    source.return = suspense;
    const wakeable = { then() {} };

    expect(throwException(root, suspense, source, wakeable, SyncLane)).toBe(false);
    expect((suspense.flags & ShouldCapture)).toBe(ShouldCapture);
    expect(suspense.updateQueue).toBeInstanceOf(Set);
    expect((suspense.updateQueue as Set<unknown>).has(wakeable)).toBe(true);
  });

  it("wakeable ping 后会把原 render lanes 标记为 pinged/pending 以便重试", () => {
    const rootFiber = createHostRootFiber();
    const suspense = new FiberNode(SuspenseComponent, {}, null);
    const source = new FiberNode(FunctionComponent, {}, null);
    const root: FiberRoot = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: 0,
      pingedLanes: 0,
      pingCache: new WeakMap(),
      callbackNode: null,
      callbackPriority: 0,
      next: null,
    };
    rootFiber.stateNode = root;
    rootFiber.child = suspense;
    suspense.return = rootFiber;
    suspense.child = source;
    source.return = suspense;
    const manual = createManualWakeable();

    expect(throwException(root, suspense, source, manual.wakeable, TransitionLane)).toBe(false);
    expect(manual.listenerCount).toBe(2);

    manual.resolve();

    expect(includesSomeLane(root.pingedLanes ?? 0, TransitionLane)).toBe(true);
    expect(includesSomeLane(root.pendingLanes, TransitionLane)).toBe(true);
    root.pendingLanes = NoLanes;
  });

  it("Suspense commit retry listener 去重，并在 wakeable resolve 后调度 RetryLane", () => {
    const rootFiber = createHostRootFiber();
    const suspense = new FiberNode(SuspenseComponent, {}, null);
    const root: FiberRoot = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: 0,
      callbackNode: null,
      callbackPriority: 0,
      next: null,
    };
    rootFiber.stateNode = root;
    rootFiber.child = suspense;
    suspense.return = rootFiber;
    const manual = createManualWakeable();
    suspense.updateQueue = new Set([manual.wakeable]);

    commitMutationEffects(root, suspense);
    commitMutationEffects(root, suspense);

    expect(manual.listenerCount).toBe(2);

    manual.resolve();

    expect(includesSomeLane(suspense.lanes, RetryLane)).toBe(true);
    expect(includesSomeLane(root.pendingLanes, RetryLane)).toBe(true);
    expect(includesSomeLane(rootFiber.childLanes, RetryLane)).toBe(true);
    root.pendingLanes = NoLanes;
  });

  it("普通错误会进入最近 class error boundary 的更新队列", () => {
    const rootFiber = createHostRootFiber();
    const boundary = new FiberNode(ClassComponent, {}, null);
    const source = new FiberNode(FunctionComponent, {}, null);
    const root: FiberRoot = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: 0,
      callbackNode: null,
      callbackPriority: 0,
      next: null,
    };
    rootFiber.stateNode = root;
    rootFiber.child = boundary;
    boundary.return = rootFiber;
    boundary.child = source;
    source.return = boundary;
    boundary.type = class Boundary {
      static getDerivedStateFromError() {
        return { failed: true };
      }
    };
    boundary.memoizedState = { failed: false };
    initializeUpdateQueue(boundary);

    expect(throwException(root, boundary, source, new Error("boom"), SyncLane)).toBe(false);
    expect((boundary.flags & ShouldCapture)).toBe(ShouldCapture);
    expect((boundary.updateQueue as UpdateQueue<unknown>).shared.pending).not.toBeNull();
  });
});

describe("ReactFiberHiddenContext / SuspenseContext / Offscreen / Cache", () => {
  it("HiddenContext 入栈后标记当前树隐藏并合并 baseLanes", () => {
    const fiber = new FiberNode(OffscreenComponent, {}, null);

    pushHiddenContext(fiber, { baseLanes: SyncLane });

    expect(isCurrentTreeHidden()).toBe(true);
    expect(getEntangledRenderLanes()).toBe(SyncLane);

    popHiddenContext(fiber);
    expect(isCurrentTreeHidden()).toBe(false);
  });

  it("隐藏树内 requestUpdateLane 会叠加 OffscreenLane", () => {
    const fiber = new FiberNode(OffscreenComponent, {}, null);

    pushHiddenContext(fiber, { baseLanes: SyncLane });
    try {
      expect(requestUpdateLane()).toBe(SyncLane | OffscreenLane);
    } finally {
      popHiddenContext(fiber);
    }
  });

  it("OffscreenComponent begin/complete 会按 mode 维护 hidden context", () => {
    const offscreen = new FiberNode(OffscreenComponent, {
      mode: "hidden",
      children: "hidden-child",
    }, null);

    const child = beginWork(null, offscreen, SyncLane);

    expect(isCurrentTreeHidden()).toBe(true);
    expect(offscreen.memoizedState).not.toBeNull();
    expect(child?.tag).toBe(HostText);

    completeWork(null, offscreen);
    expect(isCurrentTreeHidden()).toBe(false);
  });

  it("Suspense handler stack 记录最近捕获边界和 shell boundary", () => {
    const suspense = new FiberNode(SuspenseComponent, {}, null);

    pushPrimaryTreeSuspenseHandler(suspense);

    expect(getSuspenseHandler()).toBe(suspense);
    expect(getShellBoundary()).toBe(suspense);

    popSuspenseHandler(suspense);
    expect(getSuspenseHandler()).toBeNull();
    expect(getShellBoundary()).toBeNull();
  });

  it("SuspenseList catch 使用自身作为 handler 并保留 context flag", () => {
    const list = new FiberNode(SuspenseListComponent, {}, null);

    pushSuspenseListCatch(list, ForceSuspenseFallback);

    expect(getSuspenseHandler()).toBe(list);
    expect(hasSuspenseListContext(ForceSuspenseFallback, ForceSuspenseFallback)).toBe(true);

    popSuspenseListContext(list);
  });

  it("Offscreen instance 使用 visibility bit 表示可见状态", () => {
    const visible = createOffscreenInstance(true);
    const hidden = createOffscreenInstance(false);

    expect(visible._visibility).toBe(OffscreenVisible);
    expect(isOffscreenVisible(visible)).toBe(true);
    expect(isOffscreenVisible(hidden)).toBe(false);
  });

  it("Offscreen suspense handler 会成为当前 handler", () => {
    const offscreen = new FiberNode(OffscreenComponent, {}, null);
    pushOffscreenSuspenseHandler(offscreen);

    expect(getSuspenseHandler()).toBe(offscreen);
    expect(getShellBoundary()).toBe(offscreen);

    popSuspenseHandler(offscreen);
  });

  it("Offscreen 可见性提交会恢复 detached host node，并隐藏可见 host instance", () => {
    const previousNode = globalThis.Node;
    const previousElement = globalThis.Element;
    const previousHTMLElement = globalThis.HTMLElement;
    const previousSVGElement = globalThis.SVGElement;
    const previousText = globalThis.Text;

    class FakeNode {
      parentNode: FakeNode | null = null;
      children: FakeNode[] = [];
      appendChild(node: FakeNode) {
        node.parentNode = this;
        this.children.push(node);
        return node;
      }
      removeChild(node: FakeNode) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
      }
      contains(node: FakeNode) {
        return this.children.includes(node);
      }
    }
    class FakeElement extends FakeNode {
      style: Record<string, string> = {};
    }
    class FakeText extends FakeNode {
      constructor(public nodeValue: string) {
        super();
      }
    }

    Object.assign(globalThis, {
      Node: FakeNode,
      Element: FakeElement,
      HTMLElement: FakeElement,
      SVGElement: FakeElement,
      Text: FakeText,
    });

    try {
      const rootFiber = createHostRootFiber();
      const container = new FakeElement();
      const root: FiberRoot = {
        containerInfo: container as unknown as Element,
        current: rootFiber,
        finishedWork: null,
        pendingLanes: 0,
        callbackNode: null,
        callbackPriority: 0,
        next: null,
      };
      rootFiber.stateNode = root;

      const currentOffscreen = new FiberNode(OffscreenComponent, { mode: "hidden" }, null);
      currentOffscreen.memoizedState = { baseLanes: NoLanes, cachePool: null };
      currentOffscreen.return = rootFiber;

      const visibleOffscreen = createWorkInProgress(currentOffscreen, { mode: "visible" });
      visibleOffscreen.memoizedState = null;
      visibleOffscreen.return = rootFiber;

      const div = new FakeElement();
      const textNode = new FakeText("");
      const host = new FiberNode(HostComponent, { style: { display: "inline-flex" } }, null);
      host.type = "div";
      host.stateNode = div;
      host.return = visibleOffscreen;
      const text = new FiberNode(HostText, { text: "ready" }, null);
      text.stateNode = textNode;
      text.return = visibleOffscreen;
      host.sibling = text;
      visibleOffscreen.child = host;

      commitMutationEffects(root, visibleOffscreen);

      expect(div.parentNode).toBe(container);
      expect(textNode.parentNode).toBe(container);
      expect(div.style.display).toBe("inline-flex");
      expect(textNode.nodeValue).toBe("ready");

      const hiddenOffscreen = createWorkInProgress(visibleOffscreen, { mode: "hidden" });
      hiddenOffscreen.memoizedState = { baseLanes: NoLanes, cachePool: null };
      hiddenOffscreen.return = rootFiber;
      host.return = hiddenOffscreen;
      text.return = hiddenOffscreen;

      commitMutationEffects(root, hiddenOffscreen);

      expect(div.style.display).toBe("none");
      expect(textNode.nodeValue).toBe("");
    } finally {
      Object.assign(globalThis, {
        Node: previousNode,
        Element: previousElement,
        HTMLElement: previousHTMLElement,
        SVGElement: previousSVGElement,
        Text: previousText,
      });
    }
  });

  it("Offscreen 显隐会穿透 Portal，但不会进入已经隐藏的 nested Offscreen", () => {
    const previousNode = globalThis.Node;
    const previousElement = globalThis.Element;
    const previousHTMLElement = globalThis.HTMLElement;
    const previousSVGElement = globalThis.SVGElement;
    const previousText = globalThis.Text;

    class FakeNode {
      parentNode: FakeNode | null = null;
      children: FakeNode[] = [];
      appendChild(node: FakeNode) {
        node.parentNode = this;
        this.children.push(node);
        return node;
      }
      removeChild(node: FakeNode) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
      }
      contains(node: FakeNode) {
        return this.children.includes(node);
      }
    }
    class FakeElement extends FakeNode {
      style: Record<string, string> = {};
    }
    class FakeText extends FakeNode {
      constructor(public nodeValue: string) {
        super();
      }
    }

    Object.assign(globalThis, {
      Node: FakeNode,
      Element: FakeElement,
      HTMLElement: FakeElement,
      SVGElement: FakeElement,
      Text: FakeText,
    });

    try {
      const rootFiber = createHostRootFiber();
      const container = new FakeElement();
      const portalContainer = new FakeElement();
      const root: FiberRoot = {
        containerInfo: container as unknown as Element,
        current: rootFiber,
        finishedWork: null,
        pendingLanes: 0,
        callbackNode: null,
        callbackPriority: 0,
        next: null,
      };
      rootFiber.stateNode = root;

      const currentOffscreen = new FiberNode(OffscreenComponent, { mode: "visible" }, null);
      currentOffscreen.memoizedState = null;
      currentOffscreen.return = rootFiber;
      const hiddenOffscreen = createWorkInProgress(currentOffscreen, { mode: "hidden" });
      hiddenOffscreen.memoizedState = { baseLanes: NoLanes, cachePool: null };
      hiddenOffscreen.return = rootFiber;

      const hostElement = new FakeElement();
      const portalElement = new FakeElement();
      const nestedElement = new FakeElement();
      const host = new FiberNode(HostComponent, {}, null);
      host.stateNode = hostElement;
      host.return = hiddenOffscreen;
      const portal = new FiberNode(HostPortal, {}, null);
      portal.stateNode = { containerInfo: portalContainer };
      portal.return = host;
      host.child = portal;
      const portalHost = new FiberNode(HostComponent, {}, null);
      portalHost.stateNode = portalElement;
      portalHost.return = portal;
      portal.child = portalHost;
      const nestedOffscreen = new FiberNode(OffscreenComponent, { mode: "hidden" }, null);
      nestedOffscreen.memoizedState = { baseLanes: NoLanes, cachePool: null };
      nestedOffscreen.return = hiddenOffscreen;
      host.sibling = nestedOffscreen;
      const nestedHost = new FiberNode(HostComponent, {}, null);
      nestedHost.stateNode = nestedElement;
      nestedHost.return = nestedOffscreen;
      nestedOffscreen.child = nestedHost;
      hiddenOffscreen.child = host;

      commitMutationEffects(root, hiddenOffscreen);

      expect(hostElement.style.display).toBe("none");
      expect(portalElement.style.display).toBe("none");
      expect(nestedElement.style.display).toBeUndefined();
    } finally {
      Object.assign(globalThis, {
        Node: previousNode,
        Element: previousElement,
        HTMLElement: previousHTMLElement,
        SVGElement: previousSVGElement,
        Text: previousText,
      });
    }
  });

  it("Cache ref count 和 provider stack 可恢复当前 CacheContext", async () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    const cache = createCache();
    retainCache(cache);
    expect(cache.refCount).toBe(1);

    pushCacheProvider(fiber, cache);
    expect(CacheContext._currentValue).toBe(cache);
    popCacheProvider(fiber, cache);

    releaseCache(cache);
    expect(cache.refCount).toBe(0);
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(cache.controller.signal.aborted).toBe(true);
  });
});

describe("ReactFiberNewContext", () => {
  it("Provider 使用栈保存并恢复 context 当前值，Consumer 记录依赖", () => {
    const context = createContext("default");
    const provider = new FiberNode(FunctionComponent, {}, null);
    const consumer = new FiberNode(FunctionComponent, {}, null);

    pushProvider(provider, context, "provided");
    prepareToReadContext(consumer, SyncLane);
    expect(readContext(context)).toBe("provided");
    expect(consumer.dependencies?.firstContext?.context).toBe(context);

    resetContextDependencies();
    popProvider(context, provider);
    expect(context._currentValue).toBe("default");
  });
});

describe("ReactFiberClassUpdateQueue", () => {
  it("enqueueUpdate 使用 pending 环形链表并在 process 阶段合并 state", () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    createRootWithChild(fiber);
    fiber.memoizedState = { count: 0 };
    initializeUpdateQueue(fiber);

    const first = createUpdate<typeof fiber.memoizedState>(SyncLane);
    first.payload = { count: 1 };
    const second = createUpdate<typeof fiber.memoizedState>(SyncLane);
    second.payload = (state: { count: number }) => ({ count: state.count + 1 });

    expect(enqueueUpdate(fiber, first, SyncLane)).not.toBeNull();
    expect(enqueueUpdate(fiber, second, SyncLane)).not.toBeNull();

    const queue = fiber.updateQueue as UpdateQueue<{ count: number }>;
    expect(queue.shared.pending).toBe(second);
    expect(queue.shared.pending?.next).toBe(first);

    processUpdateQueue(fiber, {}, null, SyncLane);
    expect(fiber.memoizedState).toEqual({ count: 2 });
    expect(queue.shared.pending).toBeNull();
  });

  it("ReplaceState 会替换而不是浅合并 state", () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    createRootWithChild(fiber);
    fiber.memoizedState = { stale: true, count: 0 };
    initializeUpdateQueue(fiber);

    const update = createUpdate<typeof fiber.memoizedState>(SyncLane);
    update.tag = ReplaceState;
    update.payload = { count: 10 };

    enqueueUpdate(fiber, update, SyncLane);
    processUpdateQueue(fiber, {}, null, SyncLane);

    expect(fiber.memoizedState).toEqual({ count: 10 });
  });

  it("按 renderLanes 跳过低优先级 class update，并保留 baseState/baseUpdate 供重放", () => {
    const fiber = new FiberNode(ClassComponent, {}, null);
    createRootWithChild(fiber);
    fiber.memoizedState = { count: 0 };
    initializeUpdateQueue(fiber);

    const transitionUpdate = createUpdate<typeof fiber.memoizedState>(TransitionLane);
    transitionUpdate.payload = (state: { count: number }) => ({ count: state.count + 10 });
    const syncUpdate = createUpdate<typeof fiber.memoizedState>(SyncLane);
    syncUpdate.payload = (state: { count: number }) => ({ count: state.count + 1 });

    enqueueUpdate(fiber, transitionUpdate, TransitionLane);
    enqueueUpdate(fiber, syncUpdate, SyncLane);

    const queue = fiber.updateQueue as UpdateQueue<{ count: number }>;

    processUpdateQueue(fiber, {}, null, SyncLane);
    expect(fiber.memoizedState).toEqual({ count: 1 });
    expect(queue.baseState).toEqual({ count: 0 });
    expect(queue.firstBaseUpdate?.lane).toBe(TransitionLane);
    expect(queue.lastBaseUpdate?.lane).toBe(NoLane);

    processUpdateQueue(fiber, {}, null, TransitionLane);
    expect(fiber.memoizedState).toEqual({ count: 11 });
    expect(queue.baseState).toEqual({ count: 11 });
    expect(queue.firstBaseUpdate).toBeNull();
    expect(queue.lastBaseUpdate).toBeNull();
  });

  it("class shared queue 记录 transition entanglement", () => {
    const fiber = new FiberNode(ClassComponent, {}, null);
    const root = createRootWithChild(fiber);
    fiber.memoizedState = { count: 0 };
    initializeUpdateQueue(fiber);

    const update = createUpdate<typeof fiber.memoizedState>(TransitionLane);
    update.payload = { count: 1 };
    enqueueUpdate(fiber, update, TransitionLane);

    const queue = fiber.updateQueue as UpdateQueue<{ count: number }>;
    entangleTransitions(root, queue, TransitionLane);

    expect(queue.shared.lanes).toBe(TransitionLane);
    expect(root.entangledLanes).toBe(TransitionLane);
  });

  it("class update queue 处理隐藏树 update 时会剥离 OffscreenLane 再比较 renderLanes", () => {
    const fiber = new FiberNode(ClassComponent, {}, null);
    createRootWithChild(fiber);
    fiber.memoizedState = { count: 0 };
    initializeUpdateQueue(fiber);

    const update = createUpdate<typeof fiber.memoizedState>(SyncLane | OffscreenLane);
    update.payload = { count: 1 };
    enqueueUpdate(fiber, update, SyncLane | OffscreenLane);

    processUpdateQueue(fiber, {}, null, SyncLane);

    expect(fiber.memoizedState).toEqual({ count: 1 });
    const queue = fiber.updateQueue as UpdateQueue<{ count: number }>;
    expect(queue.firstBaseUpdate).toBeNull();
    expect(queue.lastBaseUpdate).toBeNull();
  });
});

describe("ReactFiberThenable", () => {
  it("pending thenable 会记录真实 thenable 并抛出 SuspenseException", () => {
    const state = createThenableState();
    const thenable = {
      then() {
        return undefined;
      },
    };

    expect(() => trackUsedThenable(state, thenable, 0)).toThrow(SuspenseException as Error);
    expect(getSuspendedThenable()).toBe(thenable);
    expect((state as { thenables: unknown[] }).thenables[0]).toBe(thenable);
  });

  it("同一位置的新 thenable 会复用旧 thenable", () => {
    const state: ThenableState = createThenableState();
    const first = {
      status: "fulfilled",
      value: "cached",
      then() {
        return undefined;
      },
    };
    const second = {
      status: "fulfilled",
      value: "new",
      then() {
        return undefined;
      },
    };

    expect(trackUsedThenable(state, first, 0)).toBe("cached");
    expect(trackUsedThenable(state, second, 0)).toBe("cached");
  });
});

describe("ReactFiberSuspenseComponent", () => {
  it("Suspense DidCapture 时渲染 hidden primary Offscreen 和 visible fallback Offscreen", () => {
    const suspense = createFiberFromElement({
      $$typeof: REACT_ELEMENT_TYPE,
      type: REACT_SUSPENSE_TYPE,
      key: null,
      props: {
        fallback: "loading",
        children: "content",
      },
    });
    suspense.flags |= DidCapture;

    const child = beginWork(null, suspense, SyncLane);

    expect(suspense.tag).toBe(SuspenseComponent);
    expect(suspense.memoizedState).not.toBeNull();
    expect(child?.tag).toBe(OffscreenComponent);
    expect(child?.pendingProps.mode).toBe("hidden");
    expect(child?.pendingProps.children).toBe("content");
    expect(child?.sibling?.tag).toBe(OffscreenComponent);
    expect(child?.sibling?.pendingProps.mode).toBe("visible");
    expect(child?.sibling?.pendingProps.children).toBe("loading");

    completeWork(null, suspense);
  });

  it("findFirstSuspended 找到第一个已挂起的 Suspense 边界", () => {
    const row = new FiberNode(HostComponent, {}, null);
    const normal = new FiberNode(HostComponent, {}, null);
    const suspense = new FiberNode(SuspenseComponent, {}, null);
    row.child = normal;
    normal.return = row;
    normal.sibling = suspense;
    suspense.return = row;
    suspense.memoizedState = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null,
    };

    expect(findFirstSuspended(row)).toBe(suspense);
  });

  it("findFirstSuspended 支持 SuspenseList DidCapture 分支", () => {
    const row = new FiberNode(HostRoot, {}, null);
    const list = new FiberNode(SuspenseListComponent, { revealOrder: "forwards" }, null);
    row.child = list;
    list.return = row;
    list.flags |= DidCapture;

    expect(findFirstSuspended(row)).toBe(list);
  });
});

describe("React reconciler auxiliary modules", () => {
  it("createCapturedValueAtFiber 对 object error 复用首个捕获栈", () => {
    const firstSource = new FiberNode(FunctionComponent, {}, null);
    const secondSource = new FiberNode(HostComponent, {}, null);
    firstSource.type = function First() {
      return null;
    };
    secondSource.type = "div";
    const error = new Error("boom");

    const first = createCapturedValueAtFiber(error, firstSource);
    const second = createCapturedValueAtFiber(error, secondSource);

    expect(second).toBe(first);
    expect(first.value).toBe(error);
    expect(first.source).toBe(firstSource);
    expect(first.stack).toContain("First");
  });

  it("createPortal 返回与官方 ReactPortal 对齐的 $$typeof/key/container 字段", () => {
    const containerInfo = { nodeType: 1 };
    const portal = createPortal("child", containerInfo, "impl", 10);

    expect(portal).toEqual({
      $$typeof: REACT_PORTAL_TYPE,
      key: "10",
      children: "child",
      containerInfo,
      implementation: "impl",
    });
  });

  it("getStackByFiberInDevAndProd 沿 return 链生成组件栈", () => {
    const root = createHostRootFiber();
    const parent = new FiberNode(FunctionComponent, {}, null);
    const child = new FiberNode(HostComponent, {}, null);
    parent.type = function Parent() {
      return null;
    };
    child.type = "button";
    parent.return = root;
    child.return = parent;

    const stack = getStackByFiberInDevAndProd(child);

    expect(stack).toContain("button");
    expect(stack).toContain("Parent");
  });

  it("clz32 与 Math.clz32 的 32 bit 前导零语义一致", () => {
    expect(clz32(0)).toBe(32);
    expect(clz32(1)).toBe(31);
    expect(clz32(0xffffffff)).toBe(0);
    expect(clz32(-1)).toBe(0);
  });

  it("ReactFiberMutationTracking 记录 root 与 view transition mutation 上下文", () => {
    MutationTracking.pushRootMutationContext();
    expect(MutationTracking.rootMutationContext).toBe(false);
    expect(MutationTracking.viewTransitionMutationContext).toBe(false);

    MutationTracking.trackHostMutation();
    expect(MutationTracking.rootMutationContext).toBe(true);
    expect(MutationTracking.viewTransitionMutationContext).toBe(true);

    const previous = MutationTracking.pushMutationContext();
    expect(previous).toBe(true);
    expect(MutationTracking.viewTransitionMutationContext).toBe(false);

    MutationTracking.trackHostMutation();
    MutationTracking.popMutationContext(previous);
    expect(MutationTracking.rootMutationContext).toBe(true);
    expect(MutationTracking.viewTransitionMutationContext).toBe(true);
  });

  it("ReactProfilerTimer 记录 commit/update/profiler 关键时间点", () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    fiber.type = function TimedComponent() {
      return null;
    };

    ProfilerTimer.startUpdateTimerByLane(SyncLane, "setState", fiber);
    expect(ProfilerTimer.blockingUpdateTime).toBeGreaterThanOrEqual(0);
    expect(ProfilerTimer.blockingUpdateMethodName).toBe("setState");
    expect(ProfilerTimer.blockingUpdateComponentName).toBe("TimedComponent");

    ProfilerTimer.startCommitTimer();
    ProfilerTimer.stopCommitTimer();
    expect(ProfilerTimer.commitStartTime).toBeGreaterThanOrEqual(0);
    expect(ProfilerTimer.commitEndTime).toBeGreaterThanOrEqual(ProfilerTimer.commitStartTime);

    const before = ProfilerTimer.profilerEffectDuration;
    ProfilerTimer.startProfilerTimer(fiber);
    ProfilerTimer.stopProfilerTimerIfRunningAndRecordDuration(fiber);
    expect(ProfilerTimer.profilerEffectDuration).toBeGreaterThanOrEqual(before);
    expect(ProfilerTimer.profilerStartTime).toBe(-1.1);
  });

  it("ReactFiberDevToolsHook 注入 hook 后转发 root/unmount/profiling 回调", () => {
    const calls: string[] = [];
    const hook = {
      supportsFiber: true,
      inject() {
        calls.push("inject");
        return 7;
      },
      onScheduleFiberRoot(rendererID: number | null) {
        calls.push(`schedule:${rendererID}`);
      },
      onCommitFiberRoot(rendererID: number | null) {
        calls.push(`commit:${rendererID}`);
      },
      onPostCommitFiberRoot(rendererID: number | null) {
        calls.push(`post:${rendererID}`);
      },
      onCommitFiberUnmount(rendererID: number | null) {
        calls.push(`unmount:${rendererID}`);
      },
      setStrictMode(rendererID: number | null, value: boolean) {
        calls.push(`strict:${rendererID}:${value}`);
      },
    };
    Object.assign(globalThis, { __REACT_DEVTOOLS_GLOBAL_HOOK__: hook });

    const fiber = createHostRootFiber();
    const root = createRootWithChild(fiber);
    const profilingCalls: string[] = [];

    expect(DevToolsHook.injectInternals({ version: "ts-replica" })).toBe(false);
    DevToolsHook.onScheduleRoot(root, "child");
    DevToolsHook.onCommitRoot(root);
    DevToolsHook.onPostCommitRoot(root);
    DevToolsHook.onCommitUnmount(fiber);
    DevToolsHook.setIsStrictModeForDevtools(true);
    DevToolsHook.injectProfilingHooks({
      markCommitStarted(lanes: number) {
        profilingCalls.push(`profiling:${lanes}`);
      },
    });
    DevToolsHook.markCommitStarted(SyncLane);

    expect(calls).toEqual([
      "inject",
      "schedule:7",
      "commit:7",
      "post:7",
      "unmount:7",
      "strict:7:true",
    ]);
    expect(profilingCalls).toEqual([`profiling:${SyncLane}`]);
  });
});

describe("ReactFiberTreeContext / LegacyContext / Hydration", () => {
  it("TreeContext 按 fork slot 生成稳定 base32 tree id，并支持恢复 suspended context", () => {
    const parent = new FiberNode(FunctionComponent, {}, null);
    const child = new FiberNode(FunctionComponent, {}, null);
    child.return = parent;
    child.flags |= Forked;

    pushTreeFork(parent, 3);
    expect(getForksAtLevel(parent)).toBe(3);
    expect(isForkedChild(child)).toBe(true);

    pushTreeId(child, 3, 1);
    const treeId = getTreeId();
    const suspended = getSuspendedTreeContext();
    expect(treeId).not.toBe("0");
    expect(suspended).not.toBeNull();

    popTreeContext(child);
    expect(getTreeId()).toBe("0");

    restoreSuspendedTreeContext(child, suspended!);
    expect(getTreeId()).toBe(treeId);
    popTreeContext(child);
    popTreeContext(parent);
  });

  it("pushMaterializedTreeId 为 materialized useId 单独分配一层", () => {
    const parent = new FiberNode(FunctionComponent, {}, null);
    const child = new FiberNode(FunctionComponent, {}, null);
    child.return = parent;

    pushMaterializedTreeId(child);
    expect(getSuspendedTreeContext()).not.toBeNull();
    expect(getTreeId()).toBe("1");
    popTreeContext(child);
  });

  it("LegacyContext 支持 top-level context、masked context 和 provider childContext 合并", () => {
    class Provider {
      static childContextTypes = { theme: true };
      static contextTypes = { locale: true };
      getChildContext() {
        return { theme: "dark" };
      }
    }
    const root = createHostRootFiber();
    const provider = new FiberNode(ClassComponent, {}, null);
    provider.type = Provider;
    provider.stateNode = new Provider();
    provider.return = root;

    pushTopLevelContextObject(root, { locale: "zh-CN" }, false);
    expect(hasContextChanged()).toBe(false);
    expect(isContextProvider(Provider)).toBe(true);
    expect(getUnmaskedContext(provider, Provider, false)).toEqual({ locale: "zh-CN" });
    expect(getMaskedContext(provider, { locale: "zh-CN", theme: "light" })).toEqual({ locale: "zh-CN" });

    expect(pushContextProvider(provider)).toBe(true);
    invalidateContextProvider(provider, Provider, true);
    expect(hasContextChanged()).toBe(true);
    expect(findCurrentUnmaskedContext(provider)).toEqual({ locale: "zh-CN", theme: "dark" });

    popContext(provider);
    popTopLevelContextObject(root);
    expect(processChildContext(provider, Provider, emptyContextObject)).toEqual({ theme: "dark" });
  });

  it("LegacyContext 校验 getChildContext 只能返回 childContextTypes 声明的 key", () => {
    class BadProvider {
      static childContextTypes = { theme: true };
      getChildContext() {
        return { missing: true };
      }
    }
    const fiber = new FiberNode(ClassComponent, {}, null);
    fiber.type = BadProvider;
    fiber.stateNode = new BadProvider();

    expect(() => processChildContext(fiber, BadProvider, emptyContextObject)).toThrow(
      /missing.*childContextTypes/,
    );
  });

  it("HydrationContext 进入、声明文本节点、记录可恢复错误并 reset", () => {
    const previousNode = globalThis.Node;
    class TestNode {
      static TEXT_NODE = 3;
      static COMMENT_NODE = 8;
      nodeType: number;
      firstChild: TestNode | null = null;
      nextSibling: TestNode | null = null;
      constructor(nodeType: number) {
        this.nodeType = nodeType;
      }
    }
    Object.assign(globalThis, { Node: TestNode });
    try {
      const rootFiber = createHostRootFiber();
      const textFiber = new FiberNode(HostComponent, {}, null);
      const textNode = new TestNode(TestNode.TEXT_NODE);
      const container = { firstChild: textNode };
      rootFiber.stateNode = { containerInfo: container };

      expect(enterHydrationState(rootFiber)).toBe(true);
      expect(getIsHydrating()).toBe(true);

      tryToClaimNextHydratableTextInstance(textFiber);
      expect(textFiber.stateNode).toBe(textNode);
      expect(popHydrationState(rootFiber)).toBe(true);

      markDidThrowWhileHydratingDEV();
      expect(getDidSuspendOrErrorDEV()).toBe(true);

      const error = createCapturedValueAtFiber(new Error("hydrate"), rootFiber);
      queueHydrationError(error);
      expect(upgradeHydrationErrorsToRecoverable()).toEqual([error]);

      resetHydrationState();
      expect(getIsHydrating()).toBe(false);
    } finally {
      Object.assign(globalThis, { Node: previousNode });
    }
  });

  it("Suspense hydration 初次挂载会 claim dehydrated comment 并延后下钻 children", () => {
    const previousNode = globalThis.Node;
    class TestNode {
      static TEXT_NODE = 3;
      static COMMENT_NODE = 8;
      static DOCUMENT_FRAGMENT_NODE = 11;
      nodeType: number;
      firstChild: TestNode | null = null;
      nextSibling: TestNode | null = null;
      constructor(nodeType: number) {
        this.nodeType = nodeType;
      }
    }
    Object.assign(globalThis, { Node: TestNode });
    try {
      const rootFiber = createHostRootFiber();
      const suspense = createFiberFromElement({
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_SUSPENSE_TYPE,
        key: null,
        props: {
          fallback: "loading",
          children: "content",
        },
      });
      const dehydrated = new TestNode(TestNode.COMMENT_NODE);
      rootFiber.stateNode = { containerInfo: { firstChild: dehydrated } };
      suspense.return = rootFiber;

      expect(enterHydrationState(rootFiber)).toBe(true);
      expect(beginWork(null, suspense, SyncLane)).toBeNull();

      const suspenseState = suspense.memoizedState as { dehydrated: unknown } | null;
      expect(suspenseState?.dehydrated).toBe(dehydrated);
      expect(suspense.lanes).toBe(OffscreenLane);
      expect(suspense.child).toBeNull();

      completeWork(null, suspense);
      resetHydrationState();
    } finally {
      Object.assign(globalThis, { Node: previousNode });
    }
  });

  it("dehydrated Suspense 用 OffscreenLane 重试时 re-enter hydration 并恢复 primary Offscreen", () => {
    const previousNode = globalThis.Node;
    class TestNode {
      static TEXT_NODE = 3;
      static COMMENT_NODE = 8;
      static DOCUMENT_FRAGMENT_NODE = 11;
      nodeType: number;
      firstChild: TestNode | null = null;
      nextSibling: TestNode | null = null;
      constructor(nodeType: number) {
        this.nodeType = nodeType;
      }
    }
    Object.assign(globalThis, { Node: TestNode });
    try {
      const dehydrated = new TestNode(TestNode.COMMENT_NODE);
      const hydratableChild = new TestNode(TestNode.TEXT_NODE);
      dehydrated.nextSibling = hydratableChild;
      const props = {
        fallback: "loading",
        children: "content",
      };
      const current = createFiberFromElement({
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_SUSPENSE_TYPE,
        key: null,
        props,
      });
      current.memoizedProps = props;
      current.lanes = OffscreenLane;
      current.memoizedState = {
        dehydrated,
        treeContext: null,
        retryLane: NoLane,
        hydrationErrors: null,
      };
      const workInProgress = createWorkInProgress(current, props);

      const child = beginWork(current, workInProgress, OffscreenLane);

      expect(getIsHydrating()).toBe(true);
      expect(workInProgress.memoizedState).toBeNull();
      expect(child?.tag).toBe(OffscreenComponent);
      expect(child?.pendingProps.mode).toBe("visible");
      expect(child?.pendingProps.children).toBe("content");

      completeWork(current, workInProgress);
      resetHydrationState();
    } finally {
      Object.assign(globalThis, { Node: previousNode });
    }
  });

  it("dehydrated Suspense comment data 可区分 pending/fallback 并读取服务端错误信息", () => {
    const pendingLoading = {
      data: "$?",
      ownerDocument: { readyState: "loading" },
      nextSibling: null,
    } as unknown as Comment;
    const pendingComplete = {
      data: "$?",
      ownerDocument: { readyState: "complete" },
      nextSibling: null,
    } as unknown as Comment;
    const fallback = {
      data: "$!",
      ownerDocument: { readyState: "loading" },
      nextSibling: {
        dataset: {
          dgst: "digest",
          msg: "server failed",
          stck: "server stack",
          cstck: "component stack",
        },
      },
    } as unknown as Comment;

    expect(isSuspenseInstancePending(pendingLoading)).toBe(true);
    expect(isSuspenseInstanceFallback(pendingLoading)).toBe(false);
    expect(isSuspenseInstanceFallback(pendingComplete)).toBe(true);
    expect(isSuspenseInstanceFallback(fallback)).toBe(true);
    expect(getSuspenseInstanceFallbackErrorDetails(fallback)).toEqual({
      digest: "digest",
      message: "server failed",
      stack: "server stack",
      componentStack: "component stack",
    });
  });

  it("dehydrated fallback Suspense 会记录 recoverable hydration error 并切到 client primary", () => {
    upgradeHydrationErrorsToRecoverable();
    const dehydrated = {
      data: "$!",
      nextSibling: {
        dataset: {
          dgst: "server-digest",
          msg: "server fallback",
        },
      },
      ownerDocument: { readyState: "complete" },
    } as unknown as Comment;
    const props = {
      fallback: "loading",
      children: "content",
    };
    const current = createFiberFromElement({
      $$typeof: REACT_ELEMENT_TYPE,
      type: REACT_SUSPENSE_TYPE,
      key: null,
      props,
    });
    current.memoizedProps = props;
    current.lanes = OffscreenLane;
    current.memoizedState = {
      dehydrated,
      treeContext: null,
      retryLane: NoLane,
      hydrationErrors: null,
    };
    const workInProgress = createWorkInProgress(current, props);

    const child = beginWork(current, workInProgress, OffscreenLane);
    const recoverableErrors = upgradeHydrationErrorsToRecoverable();

    expect(workInProgress.memoizedState).toBeNull();
    expect(child?.tag).toBe(OffscreenComponent);
    expect(child?.pendingProps.children).toBe("content");
    expect(recoverableErrors?.[0]?.value).toBeInstanceOf(Error);
    expect((recoverableErrors?.[0]?.value as Error & { digest?: string }).message).toBe("server fallback");
    expect((recoverableErrors?.[0]?.value as Error & { digest?: string }).digest).toBe("server-digest");

    completeWork(current, workInProgress);
  });

  it("dehydrated pending Suspense 保留 dehydrated child 并标记 DidCapture 等待后续 retry", () => {
    const dehydrated = {
      data: "$?",
      nextSibling: null,
      ownerDocument: { readyState: "loading" },
    } as unknown as Comment;
    const props = {
      fallback: "loading",
      children: "content",
    };
    const current = createFiberFromElement({
      $$typeof: REACT_ELEMENT_TYPE,
      type: REACT_SUSPENSE_TYPE,
      key: null,
      props,
    });
    const dehydratedChild = new FiberNode(DehydratedFragment, {}, null);
    current.child = dehydratedChild;
    current.memoizedProps = props;
    current.lanes = OffscreenLane;
    current.memoizedState = {
      dehydrated,
      treeContext: null,
      retryLane: NoLane,
      hydrationErrors: null,
    };
    const workInProgress = createWorkInProgress(current, props);

    expect(beginWork(current, workInProgress, OffscreenLane)).toBeNull();
    expect((workInProgress.flags & DidCapture)).toBe(DidCapture);
    expect(workInProgress.memoizedState).toBe(current.memoizedState);
    expect(workInProgress.child).toBe(dehydratedChild);

    completeWork(current, workInProgress);
  });

  it("选择性 hydration 遇到更新时升级 lane 并抛出中断信号", async () => {
    const previousNode = globalThis.Node;
    const previousElement = globalThis.Element;
    class TestNode {
      static TEXT_NODE = 3;
      static COMMENT_NODE = 8;
      static DOCUMENT_FRAGMENT_NODE = 11;
      nodeType = 1;
      namespaceURI = "http://www.w3.org/1999/xhtml";
      firstChild: TestNode | null = null;
      nextSibling: TestNode | null = null;
    }
    class TestElement extends TestNode {}
    Object.assign(globalThis, {
      Node: TestNode,
      Element: TestElement,
    });

    try {
      const rootFiber = createHostRootFiber();
      const dehydrated = {
        data: "$",
        nextSibling: new TestNode(),
        ownerDocument: { readyState: "loading" },
      } as unknown as Comment;
      const oldProps = {
        fallback: "old loading",
        children: "old content",
      };
      const newProps = {
        fallback: "new loading",
        children: "new content",
      };
      const currentSuspense = createFiberFromElement({
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_SUSPENSE_TYPE,
        key: null,
        props: oldProps,
      });
      currentSuspense.return = rootFiber;
      currentSuspense.memoizedProps = oldProps;
      currentSuspense.memoizedState = {
        dehydrated,
        treeContext: null,
        retryLane: NoLane,
        hydrationErrors: null,
      };
      rootFiber.child = currentSuspense;
      rootFiber.memoizedProps = { children: null };
      rootFiber.pendingProps = {
        children: {
          $$typeof: REACT_ELEMENT_TYPE,
          type: REACT_SUSPENSE_TYPE,
          key: null,
          props: newProps,
        },
      };
      const root: FiberRoot = {
        containerInfo: new TestElement() as unknown as Element,
        current: rootFiber,
        finishedWork: null,
        pendingLanes: SyncLane,
        callbackNode: null,
        callbackPriority: 0,
        next: null,
      };
      rootFiber.stateNode = root;

      expect(() => performConcurrentWorkOnRoot(root)).toThrow(SelectiveHydrationException);
      expect((currentSuspense.memoizedState as { retryLane: number }).retryLane).toBe(DefaultLane);
      expect(includesSomeLane(root.pendingLanes, DefaultLane)).toBe(true);
      expect(getBumpedLaneForHydration(root, SyncLane)).toBe(DefaultLane);

      root.pendingLanes = NoLanes;
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      Object.assign(globalThis, {
        Node: previousNode,
        Element: previousElement,
      });
    }
  });

  it("ReactFiberShellHydration 根据 root.current.memoizedState.isDehydrated 判断 shell 状态", () => {
    const rootFiber = createHostRootFiber();
    rootFiber.memoizedState = { isDehydrated: true };
    const root = createRootWithChild(rootFiber);
    root.current = rootFiber;

    expect(isRootDehydrated(root)).toBe(true);
    rootFiber.memoizedState = { isDehydrated: false };
    expect(isRootDehydrated(root)).toBe(false);
  });
});

describe("ReactFiberAsyncAction / AsyncDispatcher / Transition", () => {
  it("entangleAsyncAction 让并发 async action 共享 transition lane，并在全部完成后通知 thenable listener", async () => {
    let firstResolve: () => void = () => {};
    let secondResolve: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      firstResolve = resolve;
    });
    const second = new Promise<void>((resolve) => {
      secondResolve = resolve;
    });

    entangleAsyncAction({ name: "load" }, first as any);
    entangleAsyncAction({ name: "load" }, second as any);
    const entangledThenable = peekEntangledActionThenable();
    const calls: string[] = [];
    entangledThenable?.then(() => calls.push("done"), () => calls.push("error"));

    const entangledLane = peekEntangledActionLane();
    expect(includesSomeLane(entangledLane, TransitionLanes)).toBe(true);
    firstResolve();
    await Promise.resolve();
    expect(peekEntangledActionLane()).toBe(entangledLane);
    expect(calls).toEqual([]);

    secondResolve();
    await Promise.resolve();
    expect(calls).toEqual(["done"]);
    expect(peekEntangledActionLane()).toBe(0);
    expect(peekEntangledActionThenable()).toBeNull();
  });

  it("chainThenableValue 将原 thenable 的完成值替换为指定 result", async () => {
    let resolveSource: (value: string) => void = () => {};
    const source = new Promise<string>((resolve) => {
      resolveSource = resolve;
    });
    const chained = chainThenableValue(source as any, "override");
    const values: string[] = [];
    chained.then((value) => values.push(value), () => undefined);

    resolveSource("source");
    await Promise.resolve();

    expect(chained.status).toBe("fulfilled");
    expect(chained.value).toBe("override");
    expect(values).toEqual(["override"]);
  });

  it("DefaultAsyncDispatcher 从 CacheContext 读取并复用 resourceType cache", () => {
    const fiber = new FiberNode(FunctionComponent, {}, null);
    const cache = createCache();
    pushCacheProvider(fiber, cache);
    prepareToReadContext(fiber, SyncLane);

    const resourceType = () => ({ id: Math.random() });
    const first = DefaultAsyncDispatcher.getCacheForType(resourceType);
    const second = DefaultAsyncDispatcher.getCacheForType(resourceType);

    expect(second).toBe(first);
    expect(DefaultAsyncDispatcher.cacheSignal()).toBe(cache.controller.signal);

    resetContextDependencies();
    popCacheProvider(fiber, cache);
  });

  it("ReactFiberTransition 接入 ReactSharedInternals.S 并暴露当前 transition", async () => {
    let resolveAction: () => void = () => {};
    const action = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    const transition = { name: "route", types: ["route"] };
    ReactSharedInternals.T = transition;

    expect(requestCurrentTransition()).toBe(transition);
    ReactSharedInternals.S?.(transition, action);
    const entangledLane = peekEntangledActionLane();
    expect(includesSomeLane(entangledLane, TransitionLanes)).toBe(true);

    resolveAction();
    await Promise.resolve();
    expect(peekEntangledActionLane()).toBe(0);

    ReactSharedInternals.T = NoTransition;
  });

  it("pending async action 期间 requestUpdateLane 复用 entangled lane", async () => {
    let resolveAction: () => void = () => {};
    const action = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    entangleAsyncAction({ name: "after-await" }, action as any);
    const entangledLane = peekEntangledActionLane();

    try {
      expect(requestUpdateLane()).toBe(entangledLane);
    } finally {
      resolveAction();
      await Promise.resolve();
    }
  });

  it("class update 读取 entangled async action lane 后在调用点抛出 thenable", async () => {
    let resolveAction: () => void = () => {};
    const action = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    entangleAsyncAction({ name: "class-action" }, action as any);
    const thenable = peekEntangledActionThenable();
    const entangledLane = peekEntangledActionLane();

    const fiber = new FiberNode(ClassComponent, {}, null);
    createRootWithChild(fiber);
    fiber.memoizedState = { count: 0 };
    initializeUpdateQueue(fiber);

    const update = createUpdate<typeof fiber.memoizedState>(entangledLane);
    update.payload = { count: 1 };
    enqueueUpdate(fiber, update, entangledLane);

    try {
      processUpdateQueue(fiber, {}, null, entangledLane);
      let thrown: unknown = null;
      try {
        suspendIfUpdateReadFromEntangledAsyncAction();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(thenable);
    } finally {
      resolveAction();
      await Promise.resolve();
    }
  });

  it("ReactFiberTransitionTypes claim 后清空 root.transitionTypes", () => {
    const rootFiber = createHostRootFiber();
    const root: FiberRoot = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: TransitionLane,
      callbackNode: null,
      callbackPriority: 0,
      next: null,
      transitionTypes: ["fade", "route"],
    };
    rootFiber.stateNode = root;

    entangleAsyncTransitionTypes(["fade"]);
    clearEntangledAsyncTransitionTypes();
    expect(claimQueuedTransitionTypes(root)).toEqual(["fade", "route"]);
    expect(root.transitionTypes).toBeNull();
  });
});

describe("ReactFiberErrorLogger / PostPaint / CallUserSpace / HydrationDiffs", () => {
  it("ErrorLogger 将 uncaught/caught/recoverable error 转发给 root 回调", () => {
    const rootFiber = createHostRootFiber();
    const source = new FiberNode(FunctionComponent, {}, null);
    const boundary = new FiberNode(ClassComponent, {}, null);
    source.type = function Broken() {
      return null;
    };
    boundary.type = class Boundary {};
    boundary.stateNode = { boundary: true };
    const calls: string[] = [];
    const root: FiberRoot & {
      onUncaughtError: (error: unknown, info: { componentStack?: string | null }) => void;
      onCaughtError: (error: unknown, info: { errorBoundary?: unknown }) => void;
      onRecoverableError: (error: unknown, info: { componentStack?: string | null }) => void;
    } = {
      containerInfo: {} as Element,
      current: rootFiber,
      finishedWork: null,
      pendingLanes: 0,
      callbackNode: null,
      callbackPriority: 0,
      next: null,
      onUncaughtError(error, info) {
        calls.push(`uncaught:${(error as Error).message}:${info.componentStack}`);
      },
      onCaughtError(error, info) {
        calls.push(`caught:${(error as Error).message}:${info.errorBoundary === boundary.stateNode}`);
      },
      onRecoverableError(error, info) {
        calls.push(`recoverable:${(error as Error).message}:${info.componentStack}`);
      },
    };
    const uncaught = createCapturedValueAtFiber(new Error("root"), source);
    const caught = createCapturedValueAtFiber(new Error("boundary"), source);
    const recoverable = createCapturedValueAtFiber(new Error("recover"), source);

    logUncaughtError(root, uncaught);
    logCaughtError(root, boundary, caught);
    logRecoverableError(root, recoverable);

    expect(calls[0]).toContain("uncaught:root:");
    expect(calls[1]).toBe("caught:boundary:true");
    expect(calls[2]).toContain("recoverable:recover:");
  });

  it("schedulePostPaintCallback 合并同一轮 post-paint 回调", async () => {
    const calls: number[] = [];
    schedulePostPaintCallback((time) => calls.push(time));
    schedulePostPaintCallback((time) => calls.push(time));

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(calls[1]);
  });

  it("CallUserSpace 包装 render/lifecycle/destroy/lazy init，并在异常时记录到 ancestor updateQueue", () => {
    const fiber = new FiberNode(ClassComponent, {}, null);
    const ancestor = new FiberNode(ClassComponent, {}, null);
    fiber.return = ancestor;
    const instance = {
      render: () => "view",
      componentDidMount: () => {
        throw new Error("mount");
      },
      componentDidCatch(error: unknown, info: { componentStack: string }) {
        return `${(error as Error).message}:${info.componentStack}`;
      },
    };

    const componentResult = callComponentInDEV((props: { value: number }) => props.value + 1, { value: 1 }, null);
    expect(componentResult).toBe(2);
    expect(isRendering).toBe(false);
    expect(callRenderInDEV(instance)).toBe("view");

    callComponentDidMountInDEV(fiber, instance);
    expect(ancestor.updateQueue).toBeInstanceOf(Error);
    callDestroyInDEV(fiber, ancestor, () => {
      throw new Error("destroy");
    });
    expect(ancestor.updateQueue).toBeInstanceOf(Error);

    const captured = createCapturedValueAtFiber(new Error("caught"), fiber);
    let didCatch = "";
    callComponentDidCatchInDEV(
      {
        render: () => null,
        componentDidCatch(error, info) {
          didCatch = `${(error as Error).message}:${info.componentStack.includes("Boundary")}`;
        },
      },
      { ...captured, stack: "\n    at Boundary" },
    );
    expect(didCatch).toBe("caught:true");
    expect(callLazyInitInDEV({ _payload: 10, _init: (value) => (value as number) + 5 })).toBe(15);
  });

  it("HydrationDiffs 输出 client/server prop 和尾部节点差异", () => {
    const fiber = new FiberNode(HostComponent, { id: "client", children: null }, null);
    fiber.type = "div";
    const text = new FiberNode(HostText, { text: "client text" }, null);
    text.return = fiber;
    fiber.child = text;
    const diff = describeDiff({
      fiber,
      children: [
        {
          fiber: text,
          children: [],
          serverProps: "server text",
          serverTail: [],
          distanceFromLeaf: 0,
        },
      ],
      serverProps: { id: "server" },
      serverTail: [{ type: "span", props: { id: "old" } }],
      distanceFromLeaf: 1,
    });

    expect(diff).toContain("<div");
    expect(diff).toContain("+   id=\"client\"");
    expect(diff).toContain("-   id=\"server\"");
    expect(diff).toContain("+   client text");
    expect(diff).toContain("-   server text");
    expect(diff).toContain("-   <span");
  });
});

describe("ReactFiberConfigWithNo* fallback modules", () => {
  it("导出 unsupported capability flag，并在误调用 host 方法时抛出对应错误", () => {
    expect(NoMutation.supportsMutation).toBe(false);
    expect(() => NoMutation.appendChild()).toThrow(/mutation/);

    expect(NoPersistence.supportsPersistence).toBe(false);
    expect(() => NoPersistence.cloneInstance()).toThrow(/persistence/);

    expect(NoHydration.supportsHydration).toBe(false);
    expect(() => NoHydration.hydrateInstance()).toThrow(/hydration/);

    expect(NoResources.supportsResources).toBe(false);
    expect(() => NoResources.acquireResource()).toThrow(/Resources/);

    expect(NoSingletons.supportsSingletons).toBe(false);
    expect(() => NoSingletons.resolveSingletonInstance()).toThrow(/Singletons/);

    expect(NoMicrotasks.supportsMicrotasks).toBe(false);
    expect(() => NoMicrotasks.scheduleMicrotask()).toThrow(/microtasks/);

    expect(() => NoScopes.prepareScopeUpdate()).toThrow(/React Scopes/);

    expect(NoTestSelectors.supportsTestSelectors).toBe(false);
    expect(() => NoTestSelectors.findFiberRoot()).toThrow(/test selectors/);
  });
});

describe("Scope / Act / Performance / StrictMode / TestSelectors / HotReloading", () => {
  it("ReactFiberScope 查询 scope 子树内 host node，并收集 context provider value", () => {
    const context = createContext("default");
    const scopeFiber = new FiberNode(ScopeComponent, {}, null);
    const provider = new FiberNode(ContextProvider, { value: "provided" }, null);
    const host = new FiberNode(HostComponent, { role: "button" }, null);
    const node = { id: "button" };
    provider.type = context.Provider;
    provider.memoizedProps = { value: "provided" };
    host.type = "button";
    host.memoizedProps = { role: "button" };
    host.stateNode = node;
    scopeFiber.child = provider;
    provider.return = scopeFiber;
    provider.child = host;
    host.return = provider;

    const scope = createScopeInstance();
    attachScopeFiber(scope, scopeFiber);

    expect(scope.DO_NOT_USE_queryFirstNode((type) => type === "button")).toBe(node);
    expect(scope.DO_NOT_USE_queryAllNodes((_type, props) => props.role === "button")).toEqual([node]);
    expect(scope.containsNode(node)).toBe(true);
    expect(scope.getChildContextValues(context)).toEqual(["provided"]);
  });

  it("ReactFiberAct 根据全局 IS_REACT_ACT_ENVIRONMENT/jest 判断 act 环境", () => {
    const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    const previousJest = (globalThis as { jest?: unknown }).jest;
    (globalThis as { jest?: unknown }).jest = {};
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = undefined;

    expect(isLegacyActEnvironment(createHostRootFiber())).toBe(true);

    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    expect(isLegacyActEnvironment(createHostRootFiber())).toBe(false);

    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    expect(isConcurrentActEnvironment()).toBe(true);

    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
    (globalThis as { jest?: unknown }).jest = previousJest;
  });

  it("ReactFiberPerformanceTrack 记录组件 render 事件并恢复 deep equality 状态", () => {
    performanceTrackEvents.length = 0;
    const fiber = new FiberNode(FunctionComponent, {}, null);
    fiber.type = function PerfComponent() {
      return null;
    };

    setCurrentTrackFromLanes(SyncLane);
    const previous = pushDeepEquality();
    logComponentRender(fiber, 1, 2);
    popDeepEquality(previous);
    logComponentRender(fiber, 3, 4);

    expect(performanceTrackEvents.map((event) => event.type)).toEqual([
      "render:deep-equality",
      "render",
    ]);
    expect(performanceTrackEvents[0].name).toBe("PerfComponent");
  });

  it("ReactStrictModeWarnings 记录并 flush unsafe lifecycle warning", () => {
    const fiber = new FiberNode(ClassComponent, {}, null);
    fiber.type = class Unsafe {};
    const calls: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      calls.push(args.join(" "));
    };
    try {
      ReactStrictModeWarnings.recordUnsafeLifecycleWarnings(fiber, {
        componentWillMount() {},
      });
      ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
      expect(calls[0]).toContain("Unsafe");
    } finally {
      console.warn = originalWarn;
      ReactStrictModeWarnings.discardPendingWarnings();
    }
  });

  it("ReactTestSelectors 支持 component/role/text/testname 查询和 focusWithin", () => {
    function Button() {
      return null;
    }
    const root = createHostRootFiber();
    const component = new FiberNode(FunctionComponent, {}, null);
    const host = new FiberNode(HostComponent, { role: "button", "data-testname": "save" }, null);
    const node = {
      textContent: "Save file",
      focused: false,
      focus() {
        this.focused = true;
      },
      getBoundingClientRect() {
        return { x: 1, y: 2, width: 3, height: 4 };
      },
    };
    component.type = Button;
    host.type = "button";
    host.memoizedProps = host.pendingProps;
    host.stateNode = node;
    root.child = component;
    component.return = root;
    component.child = host;
    host.return = component;

    const selectors = [
      createComponentSelector(Button),
      createRoleSelector("button"),
      createTextSelector("Save"),
      createTestNameSelector("save"),
    ];
    expect(findAllNodes(root, selectors)).toEqual([node]);
    expect(getFindAllNodesFailureDescription(root, selectors)).toBeNull();
    expect(focusWithin(root, selectors)).toBe(true);
    expect(node.focused).toBe(true);
  });

  it("ReactFiberHotReloading 根据 refresh family 解析新实现并判断兼容 family", () => {
    function Old() {
      return null;
    }
    function New() {
      return null;
    }
    const family = { current: New };
    setRefreshHandler((type) => (type === Old || type === New ? family : undefined));

    expect(resolveFunctionForHotReloading(Old)).toBe(New);

    const forwardRef = { render: Old };
    expect(resolveForwardRefForHotReloading(forwardRef).render).toBe(New);

    const fiber = new FiberNode(FunctionComponent, {}, null);
    fiber.elementType = Old;
    fiber.type = Old;
    const element = {
      $$typeof: Symbol.for("react.element"),
      type: New,
      key: null,
      props: {},
    };
    expect(isCompatibleFamilyForHotReloading(fiber, element)).toBe(true);
    setRefreshHandler(null);
  });
});

describe("ViewTransition / Gesture / TracingMarker / FiberConfig forks", () => {
  it("NoViewTransition fallback 保持官方 unsupported shim 行为", () => {
    expect(() => NoViewTransition.startViewTransition()).toThrow(/view transitions/);
    expect(() => NoViewTransition.createViewTransitionInstance()).toThrow(/view transitions/);
  });

  it("ViewTransitionComponent 生成 auto name，并按 transition type 合并 className", () => {
    const state = createViewTransitionState();
    const firstName = getViewTransitionName({ name: "auto" }, state);

    expect(firstName).toMatch(/^_front_t_/);
    expect(getViewTransitionName({}, state)).toBe(firstName);
    expect(getViewTransitionName({ name: "explicit" }, state)).toBe("explicit");

    setPendingTransitionTypesForTest(["route", "modal"]);
    expect(
      getViewTransitionClassName(
        { default: "base", route: "route-class", modal: "modal-class" },
        { default: "event", route: "event-route" },
      ),
    ).toBe("event-route");
    expect(getViewTransitionClassName("auto", undefined)).toBeNull();
    setPendingTransitionTypesForTest(null);
  });

  it("CommitViewTransitions 记录 enter/measure 状态并维护 cancelable scope", () => {
    const fiber = new FiberNode(HostComponent, { name: "card" }, null);
    const state = createViewTransitionState();
    committedViewTransitions.length = 0;
    measuredViewTransitions.length = 0;
    resetShouldStartViewTransition();

    const previous = pushViewTransitionCancelableScope();
    expect(previous).toBeNull();
    popViewTransitionCancelableScope(previous);

    trackAppearingViewTransition("card", state);
    commitEnterViewTransitions(fiber);
    measureViewTransitionHostInstances(fiber);

    expect(shouldStartViewTransition).toBe(true);
    expect(committedViewTransitions.at(-1)?.type).toBe("commit-enter");
    expect(measuredViewTransitions.at(-1)?.type).toBe("measure-host");
  });

  it("DuplicateViewTransitions 按 name 跟踪同名 view transition Fiber 数量", () => {
    const first = new FiberNode(HostComponent, { name: "shared" }, null);
    const second = new FiberNode(HostComponent, { name: "shared" }, null);
    first.memoizedProps = first.pendingProps;
    second.memoizedProps = second.pendingProps;

    trackNamedViewTransition(first);
    trackNamedViewTransition(second);
    expect(getViewTransitionNameCount("shared")).toBe(2);

    untrackNamedViewTransition(first);
    expect(getViewTransitionNameCount("shared")).toBe(1);
    untrackNamedViewTransition(second);
    expect(getViewTransitionNameCount("shared")).toBe(0);
  });

  it("GestureScheduler 和 ApplyGesture 记录 gesture 生命周期", () => {
    const root = createRootWithChild(new FiberNode(FunctionComponent, {}, null));
    const provider = { id: "gesture" };
    gestureApplicationRecords.length = 0;

    const scheduled = scheduleGesture(root, provider, { axis: "x" }, ["route"]);
    expect(getScheduledGestures(root)).toContain(scheduled);

    const started = startScheduledGesture(root, provider, { axis: "y" }, ["route"]);
    expect(started).toBe(scheduled);
    expect(started?.pending).toBe(false);

    insertDestinationClones(root, scheduled);
    applyDepartureTransitions(root, scheduled);
    startGestureAnimations(root, scheduled);
    expect(gestureApplicationRecords.map((record) => record.type)).toEqual([
      "insert-destination-clones",
      "departure",
      "animation",
    ]);

    scheduleGestureCommit(root);
    stopCommittedGesture(root);
    expect(getScheduledGestures(root)).toEqual([]);

    const restarted = startScheduledGesture(root, provider);
    expect(restarted).not.toBeNull();
    cancelScheduledGesture(root, restarted!);
    expect(getScheduledGestures(root)).toEqual([]);
  });

  it("TracingMarker 处理 transition callbacks，并用 FiberStack 维护 marker instance", () => {
    const rootFiber = createHostRootFiber();
    const markerFiber = new FiberNode(FunctionComponent, {}, null);
    const transition = { name: "load", startTime: 1 };
    const calls: string[] = [];

    processTransitionCallbacks(
      {
        transitionStart: [transition],
        transitionProgress: new Map([[transition, new Map([[{}, { name: "Suspense" }]])]]),
        transitionComplete: [transition],
        markerProgress: new Map([
          ["route", { pendingBoundaries: new Map(), transitions: new Set([transition]) }],
        ]),
        markerIncomplete: new Map([
          ["route", { aborts: [{ reason: "marker", name: "route" }], transitions: new Set([transition]) }],
        ]),
        markerComplete: new Map([["route", new Set([transition])]]),
      },
      5,
      {
        onTransitionStart: (name) => calls.push(`start:${name}`),
        onTransitionProgress: (name, _start, _end, pending) => calls.push(`progress:${name}:${pending.length}`),
        onTransitionComplete: (name) => calls.push(`complete:${name}`),
        onMarkerProgress: (name, marker) => calls.push(`marker-progress:${name}:${marker}`),
        onMarkerIncomplete: (name, marker, _start, aborts) => calls.push(`marker-incomplete:${name}:${marker}:${aborts.length}`),
        onMarkerComplete: (name, marker) => calls.push(`marker-complete:${name}:${marker}`),
      },
    );

    expect(calls).toEqual([
      "start:load",
      "progress:load:1",
      "complete:load",
      "marker-progress:load:route",
      "marker-complete:load:route",
      "marker-incomplete:load:route:1",
    ]);

    pushRootMarkerInstance(rootFiber);
    expect(getMarkerInstances()?.[0]?.tag).toBe(0);
    pushMarkerInstance(markerFiber, "route");
    expect(getMarkerInstances()?.map((marker) => marker.name)).toEqual([null, "route"]);
    popMarkerInstance(markerFiber);
    popRootMarkerInstance(rootFiber);
  });

  it("ReactFiberConfig forks 复用当前 DOM host config", () => {
    expect(typeof DomFiberConfigFork.getRootHostContext).toBe("function");
    expect(typeof DomFiberConfigFork.createInstance).toBe("function");
  });
});
