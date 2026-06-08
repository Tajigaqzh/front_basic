/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Dispatcher } from "./ReactTypes.js";

// @beginner: 定义 Transition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Transition = {
  name?: string | null;
  types?: string[] | null;
  gesture?: unknown;
  startTime?: number;
  _updatedFibers?: Set<unknown>;
} | null;

// @beginner: 定义 RendererTask：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type RendererTask = (didTimeout: boolean) => RendererTask | null;

// @beginner: 定义 AsyncCacheDispatcher：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface AsyncCacheDispatcher {
  getCacheForType<T>(resourceType: () => T): T;
  cacheSignal(): AbortSignal | null;
}

// @beginner: 定义 SharedStateClient：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SharedStateClient {
  /**
   * H 对应官方 ReactCurrentDispatcher。
   * React 包只负责读取当前 dispatcher，真正的 Hook mount/update 逻辑由 reconciler 注入。
   */
  H: Dispatcher | null;
  A: AsyncCacheDispatcher | null;
  T: Transition;
  S: null | ((transition: Transition, returnValue: unknown) => void);
  G: null | ((transition: Transition, provider: unknown, options: unknown) => () => void);
  getCurrentStack: null | (() => string);
  recentlyCreatedOwnerStacks: number;
  actQueue: null | RendererTask[];
  asyncTransitions: number;
  isBatchingLegacy: boolean;
  didScheduleLegacyUpdate: boolean;
  didUsePromise: boolean;
  thrownErrors: unknown[];
}

// @beginner: 声明 ReactSharedInternalsKey：保存当前步骤需要读取或更新的数据。
const ReactSharedInternalsKey = Symbol.for("front.react.sharedInternals");
// @beginner: 声明 globalWithReactSharedInternals：保存当前步骤需要读取或更新的数据。
const globalWithReactSharedInternals = globalThis as typeof globalThis & {
  [ReactSharedInternalsKey]?: SharedStateClient;
};

// @beginner: 声明 ReactSharedInternals：保存当前步骤需要读取或更新的数据。
const ReactSharedInternals: SharedStateClient = (globalWithReactSharedInternals[ReactSharedInternalsKey] ??= {
  H: null,
  A: null,
  T: null,
  S: null,
  G: null,
  getCurrentStack: null,
  recentlyCreatedOwnerStacks: 0,
  actQueue: null,
  asyncTransitions: 0,
  isBatchingLegacy: false,
  didScheduleLegacyUpdate: false,
  didUsePromise: false,
  thrownErrors: [],
});

export default ReactSharedInternals;
