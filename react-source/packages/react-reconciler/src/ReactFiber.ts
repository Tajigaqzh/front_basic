import type { Key, Props, ReactElement, ReactPortal, Wakeable } from "shared";
import {
  REACT_CACHE_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_CONSUMER_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
  REACT_PORTAL_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_STRICT_MODE_TYPE,
} from "shared";
import { NoFlags } from "./ReactFiberFlags.js";
import { NoLanes } from "./ReactFiberLane.js";
import { NoMode, ProfileMode, StrictEffectsMode, StrictLegacyMode } from "./ReactTypeOfMode.js";
import type { Fiber } from "./ReactInternalTypes.js";
import {
  CacheComponent,
  Fragment,
  ClassComponent,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  ContextConsumer,
  ContextProvider,
  ForwardRef,
  LazyComponent,
  Mode,
  MemoComponent,
  Profiler,
  SuspenseComponent,
  OffscreenComponent,
  type WorkTag,
} from "./ReactWorkTags.js";

export class FiberNode implements Fiber {
  tag: WorkTag;
  key: Key;
  type: unknown = null;
  elementType: unknown = null;
  stateNode: unknown = null;
  mode = NoMode;

  return: Fiber | null = null;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  index = 0;

  pendingProps: Props;
  memoizedProps: Props | null = null;
  memoizedState = null;
  updateQueue: unknown = null;

  flags = NoFlags;
  subtreeFlags = NoFlags;
  deletions: Fiber[] | null = null;

  lanes = NoLanes;
  childLanes = NoLanes;
  alternate: Fiber | null = null;
  dependencies = null;
  suspenseRetryCache?: WeakSet<Wakeable>;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.pendingProps = pendingProps;
    this.key = key;
  }
}

export function createHostRootFiber(): Fiber {
  return new FiberNode(HostRoot, { children: null }, null);
}

export function createFiberFromText(content: string | number): Fiber {
  const fiber = new FiberNode(HostText, { text: String(content) }, null);
  fiber.type = "TEXT";
  return fiber;
}

export function createFiberFromElement(element: ReactElement): Fiber {
  let fiberTag: WorkTag = HostComponent;
  const type = element.type;
  let mode = NoMode;

  if (typeof type === "function") {
    fiberTag =
      type.prototype !== undefined && type.prototype.isReactComponent !== undefined
        ? ClassComponent
        : FunctionComponent;
  } else if (type === REACT_FRAGMENT_TYPE) {
    fiberTag = Fragment;
  } else if (type === REACT_STRICT_MODE_TYPE) {
    fiberTag = Mode;
    mode |= StrictLegacyMode | StrictEffectsMode;
  } else if (type === REACT_PROFILER_TYPE) {
    fiberTag = Profiler;
    mode |= ProfileMode;
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent;
  } else if (type === REACT_OFFSCREEN_TYPE) {
    fiberTag = OffscreenComponent;
  } else if (type === REACT_CACHE_TYPE) {
    fiberTag = CacheComponent;
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  } else if (
    typeof type === "object" &&
    type !== null &&
    ((type as { $$typeof?: symbol }).$$typeof === REACT_CONTEXT_TYPE ||
      (type as { $$typeof?: symbol }).$$typeof === REACT_CONSUMER_TYPE)
  ) {
    fiberTag = ContextConsumer;
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_FORWARD_REF_TYPE
  ) {
    fiberTag = ForwardRef;
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_MEMO_TYPE
  ) {
    fiberTag = MemoComponent;
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_LAZY_TYPE
  ) {
    fiberTag = LazyComponent;
  }

  const fiber = new FiberNode(fiberTag, element.props, element.key);
  fiber.elementType = type;
  fiber.type = type;
  fiber.mode = mode;
  return fiber;
}

export function createFiberFromPortal(portal: ReactPortal): Fiber {
  const fiber = new FiberNode(HostPortal, portal.children as unknown as Props, portal.key);
  fiber.elementType = REACT_PORTAL_TYPE;
  fiber.type = REACT_PORTAL_TYPE;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    implementation: portal.implementation,
  };
  return fiber;
}

export function createWorkInProgress(current: Fiber, pendingProps: Props): Fiber {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 官方 React 的双缓存模型：current 保存已提交树，workInProgress 保存本次渲染树。
    // 两棵树通过 alternate 互相指向，提交后 root.current 切到 finishedWork。
    workInProgress = new FiberNode(current.tag, pendingProps, current.key);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;
    workInProgress.mode = current.mode;
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  workInProgress.return = current.return;
  // 与官方双缓存模型一致：默认复用 current 的 child/sibling 指针。
  // 真正进入子树时，reconcile/cloneChildFibers 会按需创建 workInProgress child；
  // 如果当前 fiber bailout，则可以直接沿用这棵已经完成的子树。
  workInProgress.child = current.child;
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.lanes = current.lanes;
  workInProgress.childLanes = current.childLanes;
  workInProgress.dependencies =
    current.dependencies === null
      ? null
      : {
          lanes: current.dependencies.lanes,
          firstContext: current.dependencies.firstContext,
        };
  workInProgress.suspenseRetryCache = current.suspenseRetryCache;

  return workInProgress;
}
