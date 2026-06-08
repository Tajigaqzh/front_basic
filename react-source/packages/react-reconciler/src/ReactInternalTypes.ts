import type { Key, Props, ReactContext, Wakeable } from "shared";
import type { Flags } from "./ReactFiberFlags.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import type { WorkTag } from "./ReactWorkTags.js";
import type { TypeOfMode } from "./ReactTypeOfMode.js";

export interface Update<S = unknown, A = unknown> {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A> | null;
}

export interface UpdateQueue<S = unknown, A = unknown> {
  pending: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => void) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
}

export interface Hook<S = any> {
  memoizedState: S;
  baseState: S;
  baseQueue: Update<S, any> | null;
  queue: UpdateQueue<S, any>;
  next: Hook | null;
}

export interface Effect {
  tag: number;
  create: () => void | (() => void);
  destroy: void | (() => void);
  deps: unknown[] | null;
  next: Effect | null;
}

export interface FunctionComponentUpdateQueue {
  lastEffect: Effect | null;
}

export interface ContextDependency<T = unknown> {
  context: ReactContext<T>;
  memoizedValue: T;
  next: ContextDependency | null;
}

export interface Dependencies {
  lanes: Lanes;
  firstContext: ContextDependency | null;
}

export interface FiberRoot {
  containerInfo: Element | DocumentFragment;
  current: Fiber;
  finishedWork: Fiber | null;
  pendingLanes: Lanes;
  suspendedLanes?: Lanes;
  callbackNode: unknown;
  callbackPriority: Lane;
  next: FiberRoot | null;
  pingedLanes?: Lanes;
  pingCache?: WeakMap<Wakeable, Set<Lanes>>;
  pooledCache?: unknown;
  pooledCacheLanes?: Lanes;
  transitionTypes?: string[] | null;
  entangledLanes?: Lanes;
}

export interface AsyncDispatcher {
  getCacheForType<T>(resourceType: () => T): T;
  cacheSignal(): AbortSignal | null;
  getOwner?: () => Fiber | null;
}

export interface Fiber {
  tag: WorkTag;
  key: Key;
  type: unknown;
  elementType: unknown;
  stateNode: unknown;
  mode: TypeOfMode;

  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;

  pendingProps: Props;
  memoizedProps: Props | null;
  memoizedState: any;
  updateQueue: unknown;

  flags: Flags;
  subtreeFlags: Flags;
  deletions: Fiber[] | null;

  lanes: Lanes;
  childLanes: Lanes;
  alternate: Fiber | null;
  dependencies: Dependencies | null;
  suspenseRetryCache?: WeakSet<Wakeable>;
  _debugNeedsRemount?: boolean;
}
