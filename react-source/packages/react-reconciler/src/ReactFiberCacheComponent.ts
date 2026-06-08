import type { ReactContext } from "shared";
import { REACT_CONTEXT_TYPE } from "shared";
import type { Fiber } from "./ReactInternalTypes.js";
import { pushProvider, popProvider } from "./ReactFiberNewContext.js";

const AbortControllerLocal =
  typeof AbortController !== "undefined"
    ? AbortController
    : class AbortControllerShim {
        signal = {
          aborted: false,
          listeners: [] as Array<() => void>,
          addEventListener: (_type: string, listener: () => void) => {
            this.signal.listeners.push(listener);
          },
        };

        abort() {
          this.signal.aborted = true;
          this.signal.listeners.forEach((listener) => listener());
        }
      };

export interface Cache {
  controller: AbortController;
  data: Map<() => unknown, unknown>;
  refCount: number;
}

export interface CacheComponentState {
  parent: Cache;
  cache: Cache;
}

export interface SpawnedCachePool {
  parent: Cache;
  pool: Cache;
}

export const CacheContext: ReactContext<Cache> = {
  $$typeof: REACT_CONTEXT_TYPE,
  _currentValue: null as unknown as Cache,
  _currentValue2: null as unknown as Cache,
  _currentRenderer: null,
  _currentRenderer2: null,
  Provider: null as unknown as ReactContext<Cache>["Provider"],
  Consumer: null as unknown as ReactContext<Cache>["Consumer"],
};

export function createCache(): Cache {
  return {
    controller: new AbortControllerLocal() as AbortController,
    data: new Map(),
    refCount: 0,
  };
}

const rootCache = createCache();
retainCache(rootCache);
CacheContext._currentValue = rootCache;
CacheContext._currentValue2 = rootCache;

export function retainCache(cache: Cache): void {
  cache.refCount += 1;
}

export function releaseCache(cache: Cache): void {
  cache.refCount -= 1;
  if (cache.refCount === 0) {
    queueMicrotask(() => cache.controller.abort());
  }
}

export function pushCacheProvider(workInProgress: Fiber, cache: Cache): void {
  pushProvider(workInProgress, CacheContext, cache);
}

export function popCacheProvider(workInProgress: Fiber, _cache: Cache): void {
  popProvider(CacheContext, workInProgress);
}
