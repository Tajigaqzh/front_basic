import type { AsyncDispatcher, Fiber } from "./ReactInternalTypes.js";
import type { Cache } from "./ReactFiberCacheComponent.js";
import { CacheContext } from "./ReactFiberCacheComponent.js";
import { readContext } from "./ReactFiberNewContext.js";
import { current as currentOwner } from "./ReactCurrentFiber.js";

function getCacheForType<T>(resourceType: () => T): T {
  const cache: Cache = readContext(CacheContext);
  let cacheForType = cache.data.get(resourceType) as T | undefined;
  if (cacheForType === undefined) {
    cacheForType = resourceType();
    cache.data.set(resourceType, cacheForType);
  }
  return cacheForType;
}

function cacheSignal(): AbortSignal | null {
  const cache: Cache = readContext(CacheContext);
  return cache.controller.signal;
}

export const DefaultAsyncDispatcher: AsyncDispatcher = {
  getCacheForType,
  cacheSignal,
  getOwner(): Fiber | null {
    return currentOwner;
  },
};
