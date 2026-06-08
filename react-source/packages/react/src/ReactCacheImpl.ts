import ReactSharedInternals from "shared/ReactSharedInternals.js";

const UNTERMINATED = 0;
const TERMINATED = 1;
const ERRORED = 2;

type Primitive = string | number | null | undefined | symbol | boolean | bigint;

type CacheNode<T> = {
  s: 0 | 1 | 2;
  v: T | unknown;
  o: WeakMap<object | Function, CacheNode<T>> | null;
  p: Map<Primitive, CacheNode<T>> | null;
};

function createCacheRoot<T>(): WeakMap<object | Function, CacheNode<T>> {
  return new WeakMap();
}

function createCacheNode<T>(): CacheNode<T> {
  return {
    s: UNTERMINATED,
    v: undefined,
    o: null,
    p: null,
  };
}

/**
 * 官方 `cache(fn)` 的参数树结构：函数本身先进 WeakMap，每一层参数再按
 * object/function 进 WeakMap、primitive 进 Map。叶子节点缓存返回值或第一次错误。
 */
export function cache<Args extends unknown[], T>(fn: (...args: Args) => T): (...args: Args) => T {
  return function cachedFunction(...args: Args): T {
    const dispatcher = ReactSharedInternals.A;
    if (!dispatcher) {
      return fn.apply(null, args);
    }

    const fnMap = dispatcher.getCacheForType(createCacheRoot<T>);
    const existingNode = fnMap.get(fn);
    let cacheNode: CacheNode<T>;
    if (existingNode === undefined) {
      cacheNode = createCacheNode<T>();
      fnMap.set(fn, cacheNode);
    } else {
      cacheNode = existingNode;
    }

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === "function" || (typeof arg === "object" && arg !== null)) {
        let objectCache: WeakMap<object | Function, CacheNode<T>> | null = cacheNode.o;
        if (objectCache === null) {
          cacheNode.o = objectCache = new WeakMap();
        }
        let objectNode: CacheNode<T> | undefined = objectCache.get(arg as object | Function);
        if (objectNode === undefined) {
          objectNode = createCacheNode<T>();
          objectCache.set(arg as object | Function, objectNode);
        }
        cacheNode = objectNode;
      } else {
        let primitiveCache: Map<Primitive, CacheNode<T>> | null = cacheNode.p;
        if (primitiveCache === null) {
          cacheNode.p = primitiveCache = new Map();
        }
        const primitive = arg as Primitive;
        let primitiveNode = primitiveCache.get(primitive);
        if (primitiveNode === undefined) {
          primitiveNode = createCacheNode<T>();
          primitiveCache.set(primitive, primitiveNode);
        }
        cacheNode = primitiveNode;
      }
    }

    if (cacheNode.s === TERMINATED) {
      return cacheNode.v as T;
    }
    if (cacheNode.s === ERRORED) {
      throw cacheNode.v;
    }

    try {
      const result = fn.apply(null, args);
      cacheNode.s = TERMINATED;
      cacheNode.v = result;
      return result;
    } catch (error) {
      cacheNode.s = ERRORED;
      cacheNode.v = error;
      throw error;
    }
  };
}

export function cacheSignal(): AbortSignal | null {
  const dispatcher = ReactSharedInternals.A;
  return dispatcher ? dispatcher.cacheSignal() : null;
}
