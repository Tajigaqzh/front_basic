/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Key, Props, ReactContext, Wakeable } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Flags } from "./ReactFiberFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane, Lanes } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { WorkTag } from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TypeOfMode } from "./ReactTypeOfMode.js";

// @beginner: 定义 Update：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Update<S = unknown, A = unknown> {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A> | null;
}

// @beginner: 定义 UpdateQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface UpdateQueue<S = unknown, A = unknown> {
  pending: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => void) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
}

// @beginner: 定义 Hook：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Hook<S = any> {
  memoizedState: S;
  baseState: S;
  baseQueue: Update<S, any> | null;
  queue: UpdateQueue<S, any>;
  next: Hook | null;
}

// @beginner: 定义 Effect：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Effect {
  tag: number;
  create: () => void | (() => void);
  destroy: void | (() => void);
  deps: unknown[] | null;
  next: Effect | null;
}

// @beginner: 定义 FunctionComponentUpdateQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface FunctionComponentUpdateQueue {
  lastEffect: Effect | null;
}

// @beginner: 定义 ContextDependency：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ContextDependency<T = unknown> {
  context: ReactContext<T>;
  memoizedValue: T;
  next: ContextDependency | null;
}

// @beginner: 定义 Dependencies：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Dependencies {
  lanes: Lanes;
  firstContext: ContextDependency | null;
}

// @beginner: 定义 FiberRoot：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 AsyncDispatcher：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface AsyncDispatcher {
  getCacheForType<T>(resourceType: () => T): T;
  cacheSignal(): AbortSignal | null;
  getOwner?: () => Fiber | null;
}

// @beginner: 定义 Fiber：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Fiber {
  tag: WorkTag;
  key: Key;
  type: unknown;
  elementType: unknown;
  stateNode: unknown;
  mode: TypeOfMode;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
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
