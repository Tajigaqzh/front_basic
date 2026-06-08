import type { Dispatcher } from "./ReactTypes.js";

type Transition = {
  name?: string | null;
  types?: string[] | null;
  gesture?: unknown;
  startTime?: number;
  _updatedFibers?: Set<unknown>;
} | null;

export type RendererTask = (didTimeout: boolean) => RendererTask | null;

export interface AsyncCacheDispatcher {
  getCacheForType<T>(resourceType: () => T): T;
  cacheSignal(): AbortSignal | null;
}

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

const ReactSharedInternalsKey = Symbol.for("front.react.sharedInternals");
const globalWithReactSharedInternals = globalThis as typeof globalThis & {
  [ReactSharedInternalsKey]?: SharedStateClient;
};

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
