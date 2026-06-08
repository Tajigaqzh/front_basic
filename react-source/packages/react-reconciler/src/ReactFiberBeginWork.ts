import type { ElementType, Props, ReactElement, ReactNode } from "shared";
import {
  REACT_CONTEXT_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
} from "shared";
import shallowEqual from "shared/shallowEqual.js";
import {
  ContextConsumer,
  ContextProvider,
  ClassComponent,
  CacheComponent,
  ForwardRef,
  HostRoot,
  HostPortal,
  FunctionComponent,
  HostComponent,
  HostText,
  Fragment,
  LazyComponent,
  Mode,
  MemoComponent,
  Profiler,
  SimpleMemoComponent,
  SuspenseComponent,
  OffscreenComponent,
} from "./ReactWorkTags.js";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import { createFiberFromElement, createWorkInProgress } from "./ReactFiber.js";
import { cloneChildFibers, reconcileChildFibers } from "./ReactChildFiber.js";
import { renderWithHooks } from "./ReactFiberHooks.js";
import { resolveLazy } from "./ReactFiberThenable.js";
import {
  checkIfContextChanged,
  lazilyPropagateParentContextChanges,
  prepareToReadContext,
  pushProvider,
  readContext,
  readContextDuringReconciliation,
  resetContextDependencies,
} from "./ReactFiberNewContext.js";
import {
  getBumpedLaneForHydration,
  NoLane,
  includesSomeLane,
  NoLanes,
  OffscreenLane,
  SyncLane,
  type Lanes,
} from "./ReactFiberLane.js";
import { pushHostContainer, pushHostContext } from "./ReactFiberHostContext.js";
import {
  constructClassInstance,
  mountClassInstance,
  updateClassInstance,
} from "./ReactFiberClassComponent.js";
import { DidCapture, ForceClientRender, NoFlags, Placement } from "./ReactFiberFlags.js";
import {
  CacheContext,
  createCache,
  pushCacheProvider,
  retainCache,
  type Cache,
  type CacheComponentState,
} from "./ReactFiberCacheComponent.js";
import {
  popHiddenContext,
  pushHiddenContext,
  reuseHiddenContextOnStack,
} from "./ReactFiberHiddenContext.js";
import {
  popSuspenseHandler,
  pushFallbackTreeSuspenseHandler,
  pushOffscreenSuspenseHandler,
  pushPrimaryTreeSuspenseHandler,
} from "./ReactFiberSuspenseContext.js";
import type { OffscreenProps, OffscreenState } from "./ReactFiberOffscreenComponent.js";
import type { SuspenseInstance, SuspenseState } from "./ReactFiberSuspenseComponent.js";
import {
  getSuspenseInstanceFallbackErrorDetails,
  isSuspenseInstanceFallback,
  isSuspenseInstancePending,
} from "./ReactFiberSuspenseComponent.js";
import {
  claimNextHydratableSuspenseInstance,
  getIsHydrating,
  queueHydrationError,
  reenterHydrationStateFromDehydratedSuspenseInstance,
  warnIfHydrating,
} from "./ReactFiberHydrationContext.js";
import { getWorkInProgressRoot, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";
import { createCapturedValueAtFiber } from "./ReactCapturedValue.js";

let didReceiveUpdate = false;

export const SelectiveHydrationException = new Error("This dehydrated boundary suspended during selective hydration.");

export function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes = SyncLane): Fiber | null {
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (oldProps !== newProps) {
      didReceiveUpdate = true;
    } else {
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
      if (!hasScheduledUpdateOrContext && (workInProgress.flags & DidCapture) === NoFlags) {
        didReceiveUpdate = false;
        return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
      }
      didReceiveUpdate = false;
    }
  } else {
    didReceiveUpdate = false;
  }

  // 与官方 beginWork 一致：一旦决定进入当前 fiber 的 begin 阶段，
  // 本轮 renderLanes 已经被消费，剩余子树工作会在 complete 阶段重新 bubble。
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress);
    case HostPortal:
      return updatePortalComponent(current, workInProgress);
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress, renderLanes);
    case ForwardRef:
      return updateForwardRef(current, workInProgress, renderLanes);
    case MemoComponent:
      return updateMemoComponent(current, workInProgress, renderLanes);
    case SimpleMemoComponent:
      return updateSimpleMemoComponent(current, workInProgress, renderLanes);
    case LazyComponent:
      return mountLazyComponent(current, workInProgress, renderLanes);
    case ClassComponent:
      return updateClassComponent(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress);
    case ContextProvider:
      return updateContextProvider(current, workInProgress);
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes);
    case Fragment:
      return updateFragment(current, workInProgress);
    case Mode:
      return updateMode(current, workInProgress);
    case Profiler:
      return updateProfiler(current, workInProgress);
    case SuspenseComponent:
      return updateSuspenseComponent(current, workInProgress, renderLanes);
    case OffscreenComponent:
      return updateOffscreenComponent(current, workInProgress);
    case CacheComponent:
      return updateCacheComponent(current, workInProgress, renderLanes);
    case HostText:
      return null;
  }

  return null;
}

function updatePortalComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  pushHostContainer(
    workInProgress,
    (workInProgress.stateNode as { containerInfo: Element | DocumentFragment }).containerInfo,
  );
  reconcileChildren(current, workInProgress, workInProgress.pendingProps as unknown as ReactNode);
  return workInProgress.child;
}

function updateHostRoot(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  pushHostContainer(workInProgress, (workInProgress.stateNode as FiberRoot).containerInfo);
  const nextChildren = workInProgress.pendingProps.children;
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const Component = workInProgress.type as (props: Props) => ReactNode;
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    workInProgress.pendingProps,
    undefined,
    renderLanes,
  );
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateForwardRef(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const Component = workInProgress.type as {
    render: (props: Props, ref: unknown) => ReactNode;
  };
  const nextProps = workInProgress.pendingProps;
  const ref = nextProps.ref;
  let propsWithoutRef = nextProps;

  if ("ref" in nextProps) {
    propsWithoutRef = {};
    for (const key of Object.keys(nextProps)) {
      if (key !== "ref") {
        propsWithoutRef[key] = nextProps[key];
      }
    }
  }

  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component.render,
    propsWithoutRef,
    ref,
    renderLanes,
  );
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const Component = workInProgress.type as {
    type: ElementType;
    compare: null | ((prevProps: Props, nextProps: Props) => boolean);
  };
  const nextProps = workInProgress.pendingProps;
  const type = Component.type;

  if (current === null) {
    if (typeof type === "function" && Component.compare === null && !isClassComponent(type)) {
      workInProgress.tag = SimpleMemoComponent;
      workInProgress.type = type;
      return updateSimpleMemoComponent(null, workInProgress, renderLanes);
    }

    const child = createFiberFromElement({
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key: null,
      props: nextProps,
    });
    child.return = workInProgress;
    workInProgress.child = child;
    return child;
  }

  const currentChild = current.child;
  if (currentChild === null) {
    return null;
  }

  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
  if (!hasScheduledUpdateOrContext) {
    const prevProps = currentChild.memoizedProps ?? {};
    const compare = Component.compare ?? shallowEqual;
    if (compare(prevProps, nextProps)) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  const newChild = createWorkInProgress(currentChild, nextProps);
  newChild.return = workInProgress;
  workInProgress.child = newChild;
  return newChild;
}

function updateSimpleMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const nextProps = workInProgress.pendingProps;

  if (current !== null) {
    const prevProps = current.memoizedProps ?? {};
    if (shallowEqual(prevProps, nextProps) && !checkScheduledUpdateOrContext(current, renderLanes)) {
      workInProgress.pendingProps = current.memoizedProps ?? nextProps;
      workInProgress.lanes = current.lanes;
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  return updateFunctionComponent(current, workInProgress, renderLanes);
}

function mountLazyComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const lazyType = workInProgress.elementType as {
    _payload: unknown;
    _init(payload: unknown): ElementType;
  };
  const Component = resolveLazy(lazyType);
  workInProgress.type = Component;

  if (typeof Component === "function") {
    workInProgress.tag = isClassComponent(Component) ? ClassComponent : FunctionComponent;
    return workInProgress.tag === ClassComponent
      ? updateClassComponent(current, workInProgress, renderLanes)
      : updateFunctionComponent(current, workInProgress, renderLanes);
  }

  if (Component !== null && typeof Component === "object") {
    const $$typeof = (Component as { $$typeof?: symbol }).$$typeof;
    if ($$typeof === REACT_FORWARD_REF_TYPE) {
      workInProgress.tag = ForwardRef;
      workInProgress.type = Component;
      return updateForwardRef(current, workInProgress, renderLanes);
    }
    if ($$typeof === REACT_MEMO_TYPE) {
      workInProgress.tag = MemoComponent;
      workInProgress.type = Component;
      return updateMemoComponent(current, workInProgress, renderLanes);
    }
    if ($$typeof === REACT_CONTEXT_TYPE) {
      workInProgress.tag = ContextConsumer;
      workInProgress.type = Component;
      return updateContextConsumer(current, workInProgress, renderLanes);
    }
  }

  throw new Error("Lazy element type must resolve to a class or function component.");
}

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const Component = workInProgress.type as Parameters<typeof constructClassInstance>[1];
  const props = workInProgress.pendingProps;

  prepareToReadContext(workInProgress, renderLanes);
  let instance = workInProgress.stateNode as ReturnType<typeof constructClassInstance> | null;
  if (instance === null) {
    instance = constructClassInstance(workInProgress, Component, props);
    mountClassInstance(workInProgress, Component, props, renderLanes);
  } else if (current !== null) {
    const shouldUpdate = updateClassInstance(current, workInProgress, Component, props, renderLanes);
    if (!shouldUpdate) {
      resetContextDependencies();
      return null;
    }
  }

  const nextChildren = instance.render();
  resetContextDependencies();
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateHostComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  pushHostContext(workInProgress);
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  return workInProgress.child;
}

function updateContextProvider(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  const providerType = workInProgress.type as { _context: unknown };
  const context = providerType._context as Parameters<typeof pushProvider>[1];
  pushProvider(workInProgress, context, workInProgress.pendingProps.value);
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  return workInProgress.child;
}

function updateContextConsumer(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const consumerType = workInProgress.type as {
    _context?: Parameters<typeof readContextDuringReconciliation>[1];
  };
  const context = consumerType._context ?? (workInProgress.type as Parameters<typeof readContextDuringReconciliation>[1]);
  const render = workInProgress.pendingProps.children as unknown as (value: unknown) => ReactNode;
  const value = readContextDuringReconciliation(workInProgress, context, renderLanes);
  reconcileChildren(current, workInProgress, render(value));
  return workInProgress.child;
}

function updateFragment(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  return workInProgress.child;
}

function updateMode(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  return workInProgress.child;
}

function updateProfiler(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  return workInProgress.child;
}

function updateSuspenseComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const nextProps = workInProgress.pendingProps;
  const showFallback = (workInProgress.flags & DidCapture) !== NoFlags;

  if (current === null && getIsHydrating()) {
    if (showFallback) {
      pushFallbackTreeSuspenseHandler(workInProgress);
    } else {
      pushPrimaryTreeSuspenseHandler(workInProgress);
    }
    const dehydrated = claimNextHydratableSuspenseInstance(workInProgress);
    return mountDehydratedSuspenseComponent(workInProgress, dehydrated);
  }

  const previousState = current?.memoizedState as SuspenseState | null | undefined;
  if (current !== null && previousState?.dehydrated !== null && previousState?.dehydrated !== undefined) {
    return updateDehydratedSuspenseComponent(current, workInProgress, previousState, showFallback, renderLanes);
  }

  if (current !== null && (workInProgress.flags & ForceClientRender) !== NoFlags) {
    pushPrimaryTreeSuspenseHandler(workInProgress);
    workInProgress.flags &= ~ForceClientRender;
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  if (showFallback) {
    pushFallbackTreeSuspenseHandler(workInProgress);
    workInProgress.memoizedState = createSuspenseState();
    // 当前复刻版先用 Offscreen 保存 primary/fallback 的显隐关系；
    // 后续 retry lane 接入后，可在 primary hidden 树上保留更完整的恢复状态。
    reconcileChildren(current, workInProgress, [
      createOffscreenElement("primary", "hidden", nextProps.children),
      createOffscreenElement("fallback", "visible", (nextProps.fallback ?? null) as ReactNode),
    ]);
    return workInProgress.child;
  }

  pushPrimaryTreeSuspenseHandler(workInProgress);
  workInProgress.memoizedState = null;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  return workInProgress.child;
}

function mountDehydratedSuspenseComponent(
  workInProgress: Fiber,
  dehydrated: SuspenseInstance,
): Fiber | null {
  // hydration 首轮不下钻 children，直接把服务端 DOM 留在原地；
  // 后续 OffscreenLane 会再次进入该边界并尝试把 primary 子树接到已有 DOM 上。
  workInProgress.memoizedState = createSuspenseState(dehydrated);
  workInProgress.lanes = OffscreenLane;
  return null;
}

function updateDehydratedSuspenseComponent(
  current: Fiber,
  workInProgress: Fiber,
  suspenseState: SuspenseState,
  showFallback: boolean,
  renderLanes: Lanes,
): Fiber | null {
  const nextProps = workInProgress.pendingProps;
  const dehydrated = suspenseState.dehydrated;

  if (dehydrated === null) {
    return null;
  }

  if (showFallback) {
    pushFallbackTreeSuspenseHandler(workInProgress);
    workInProgress.memoizedState = suspenseState;
    workInProgress.child = current.child;
    workInProgress.flags |= DidCapture;
    return null;
  }

  if ((workInProgress.flags & DidCapture) !== NoFlags) {
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  pushPrimaryTreeSuspenseHandler(workInProgress);
  warnIfHydrating();

  if (isSuspenseInstanceFallback(dehydrated)) {
    const details = getSuspenseInstanceFallbackErrorDetails(dehydrated);
    const error = new Error(
      details.message ??
        "The server could not finish this Suspense boundary. Switched to client rendering.",
    ) as Error & { digest?: string };
    error.digest = details.digest;
    if (details.stack !== undefined) {
      error.stack = details.stack;
    }
    queueHydrationError(createCapturedValueAtFiber(error, workInProgress));
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  if (didReceiveUpdate || includesSomeLane(current.childLanes, OffscreenLane)) {
    const root = getWorkInProgressRoot();
    const attemptHydrationAtLane =
      root === null ? NoLane : getBumpedLaneForHydration(root, renderLanes);

    if (attemptHydrationAtLane !== NoLane && attemptHydrationAtLane !== suspenseState.retryLane) {
      suspenseState.retryLane = attemptHydrationAtLane;
      scheduleUpdateOnFiber(current, attemptHydrationAtLane);
      throw SelectiveHydrationException;
    }

    queueHydrationError(
      createCapturedValueAtFiber(
        new Error("Hydration failed because this Suspense boundary received an update before it hydrated."),
        workInProgress,
      ),
    );
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  if (isSuspenseInstancePending(dehydrated)) {
    workInProgress.flags |= DidCapture;
    workInProgress.memoizedState = suspenseState;
    workInProgress.child = current.child;
    return null;
  }

  reenterHydrationStateFromDehydratedSuspenseInstance(
    workInProgress,
    dehydrated,
    suspenseState.treeContext,
  );
  workInProgress.memoizedState = null;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  return workInProgress.child;
}

function retrySuspenseComponentWithoutHydrating(current: Fiber, workInProgress: Fiber): Fiber | null {
  // hydration 已经无法继续时，重新 diff 当前 dehydrated child 与 client primary Offscreen；
  // reconcileChildFibers 会把旧 dehydrated child 放入 deletion，再创建新的客户端子树。
  workInProgress.memoizedState = null;
  const nextProps = workInProgress.pendingProps;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  if (workInProgress.child !== null) {
    workInProgress.child.flags |= Placement;
  }
  return workInProgress.child;
}

function updateOffscreenComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  const nextProps = workInProgress.pendingProps as OffscreenProps;
  const isHidden = nextProps.mode === "hidden" || nextProps.mode === "unstable-defer-without-hiding";

  if (isHidden) {
    const previousState = current?.memoizedState as OffscreenState | null | undefined;
    const offscreenState: OffscreenState = previousState ?? {
      baseLanes: workInProgress.childLanes,
      cachePool: null,
    };
    offscreenState.baseLanes = workInProgress.childLanes;
    workInProgress.memoizedState = offscreenState;
    pushHiddenContext(workInProgress, { baseLanes: offscreenState.baseLanes });
  } else {
    workInProgress.memoizedState = null;
    reuseHiddenContextOnStack(workInProgress);
  }

  pushOffscreenSuspenseHandler(workInProgress);
  reconcileChildren(current, workInProgress, nextProps.children);
  return workInProgress.child;
}

function updateCacheComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  prepareToReadContext(workInProgress, renderLanes);
  const parentCache = readContext(CacheContext) ?? createCache();

  let cacheState = workInProgress.memoizedState as CacheComponentState | null;
  if (current === null || cacheState === null) {
    const freshCache: Cache = createCache();
    retainCache(freshCache);
    cacheState = {
      parent: parentCache,
      cache: freshCache,
    };
    workInProgress.memoizedState = cacheState;
  } else if (cacheState.parent !== parentCache) {
    cacheState = {
      parent: parentCache,
      cache: parentCache,
    };
    workInProgress.memoizedState = cacheState;
  }

  pushCacheProvider(workInProgress, cacheState.cache);
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  resetContextDependencies();
  return workInProgress.child;
}

function reconcileChildren(current: Fiber | null, workInProgress: Fiber, nextChildren: ReactNode): void {
  workInProgress.child = reconcileChildFibers(
    workInProgress,
    current?.child ?? null,
    nextChildren,
  );
}

function isClassComponent(type: unknown): boolean {
  return (
    typeof type === "function" &&
    type.prototype !== undefined &&
    type.prototype.isReactComponent !== undefined
  );
}

function checkScheduledUpdateOrContext(current: Fiber, renderLanes: Lanes): boolean {
  if (includesSomeLane(current.lanes, renderLanes)) {
    return true;
  }

  const dependencies = current.dependencies;
  return dependencies !== null && checkIfContextChanged(dependencies);
}

function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot:
      pushHostContainer(workInProgress, (workInProgress.stateNode as FiberRoot).containerInfo);
      break;
    case HostComponent:
      pushHostContext(workInProgress);
      break;
    case HostPortal:
      pushHostContainer(
        workInProgress,
        (workInProgress.stateNode as { containerInfo: Element | DocumentFragment }).containerInfo,
      );
      break;
    case ContextProvider: {
      const providerType = workInProgress.type as { _context: Parameters<typeof pushProvider>[1] };
      pushProvider(workInProgress, providerType._context, workInProgress.memoizedProps?.value);
      break;
    }
    case CacheComponent: {
      const state = workInProgress.memoizedState as CacheComponentState | null;
      if (state !== null) {
        pushCacheProvider(workInProgress, state.cache);
      }
      break;
    }
    case SuspenseComponent:
      if (workInProgress.memoizedState !== null) {
        pushFallbackTreeSuspenseHandler(workInProgress);
      } else {
        pushPrimaryTreeSuspenseHandler(workInProgress);
      }
      break;
    case OffscreenComponent: {
      const state = workInProgress.memoizedState as OffscreenState | null;
      if (state !== null) {
        pushHiddenContext(workInProgress, { baseLanes: state.baseLanes });
      } else {
        reuseHiddenContextOnStack(workInProgress);
      }
      pushOffscreenSuspenseHandler(workInProgress);
      break;
    }
  }

  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}

function createSuspenseState(dehydrated: SuspenseInstance | null = null): SuspenseState {
  return {
    dehydrated,
    treeContext: null,
    retryLane: NoLane,
    hydrationErrors: null,
  };
}

function createOffscreenElement(
  key: string,
  mode: OffscreenProps["mode"],
  children: ReactNode,
): ReactElement {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: REACT_OFFSCREEN_TYPE,
    key,
    props: {
      mode,
      children,
    },
  };
}

function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  if (current !== null) {
    workInProgress.dependencies = current.dependencies;
  }

  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    if (current !== null) {
      // 官方 lazy context propagation：真正准备跳过子树时，再沿父链收集变更的 Provider，
      // 并把命中的 consumer lane 冒泡到 childLanes，避免全树提前扫描。
      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
        return null;
      }
    } else {
      return null;
    }
  }

  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
