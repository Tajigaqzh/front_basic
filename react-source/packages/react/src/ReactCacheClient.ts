import { disableClientCache } from "shared/ReactFeatureFlags.js";
import { cache as cacheImpl, cacheSignal as cacheSignalImpl } from "./ReactCacheImpl.js";

function noopCache<Args extends unknown[], T>(fn: (...args: Args) => T): (...args: Args) => T {
  return function uncachedFunction(...args: Args): T {
    return fn.apply(null, args);
  };
}

function noopCacheSignal(): AbortSignal | null {
  return null;
}

export const cache = disableClientCache ? noopCache : cacheImpl;
export const cacheSignal = disableClientCache ? noopCacheSignal : cacheSignalImpl;
