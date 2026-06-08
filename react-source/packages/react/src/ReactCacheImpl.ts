/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";

// @beginner: 声明 UNTERMINATED：保存当前步骤需要读取或更新的数据。
const UNTERMINATED = 0;
// @beginner: 声明 TERMINATED：保存当前步骤需要读取或更新的数据。
const TERMINATED = 1;
// @beginner: 声明 ERRORED：保存当前步骤需要读取或更新的数据。
const ERRORED = 2;

// @beginner: 定义 Primitive：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Primitive = string | number | null | undefined | symbol | boolean | bigint;

// @beginner: 定义 CacheNode：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type CacheNode<T> = {
  s: 0 | 1 | 2;
  v: T | unknown;
  o: WeakMap<object | Function, CacheNode<T>> | null;
  p: Map<Primitive, CacheNode<T>> | null;
};

// @beginner: 进入 createCacheRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createCacheRoot<T>(): WeakMap<object | Function, CacheNode<T>> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return new WeakMap();
}

// @beginner: 进入 createCacheNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createCacheNode<T>(): CacheNode<T> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
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
// @beginner: 进入 cache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function cache<Args extends unknown[], T>(fn: (...args: Args) => T): (...args: Args) => T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return function cachedFunction(...args: Args): T {
    // @beginner: 声明 dispatcher：保存当前步骤需要读取或更新的数据。
    const dispatcher = ReactSharedInternals.A;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!dispatcher) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return fn.apply(null, args);
    }

    // @beginner: 声明 fnMap：保存当前步骤需要读取或更新的数据。
    const fnMap = dispatcher.getCacheForType(createCacheRoot<T>);
    // @beginner: 声明 existingNode：保存当前步骤需要读取或更新的数据。
    const existingNode = fnMap.get(fn);
    // @beginner: 声明 cacheNode：保存当前步骤需要读取或更新的数据。
    let cacheNode: CacheNode<T>;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (existingNode === undefined) {
      cacheNode = createCacheNode<T>();
      fnMap.set(fn, cacheNode);
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      cacheNode = existingNode;
    }

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = 0; i < args.length; i += 1) {
      // @beginner: 声明 arg：保存当前步骤需要读取或更新的数据。
      const arg = args[i];
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof arg === "function" || (typeof arg === "object" && arg !== null)) {
        // @beginner: 声明 objectCache：保存当前步骤需要读取或更新的数据。
        let objectCache: WeakMap<object | Function, CacheNode<T>> | null = cacheNode.o;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (objectCache === null) {
          cacheNode.o = objectCache = new WeakMap();
        }
        // @beginner: 声明 objectNode：保存当前步骤需要读取或更新的数据。
        let objectNode: CacheNode<T> | undefined = objectCache.get(arg as object | Function);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (objectNode === undefined) {
          objectNode = createCacheNode<T>();
          objectCache.set(arg as object | Function, objectNode);
        }
        cacheNode = objectNode;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 声明 primitiveCache：保存当前步骤需要读取或更新的数据。
        let primitiveCache: Map<Primitive, CacheNode<T>> | null = cacheNode.p;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (primitiveCache === null) {
          cacheNode.p = primitiveCache = new Map();
        }
        // @beginner: 声明 primitive：保存当前步骤需要读取或更新的数据。
        const primitive = arg as Primitive;
        // @beginner: 声明 primitiveNode：保存当前步骤需要读取或更新的数据。
        let primitiveNode = primitiveCache.get(primitive);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (primitiveNode === undefined) {
          primitiveNode = createCacheNode<T>();
          primitiveCache.set(primitive, primitiveNode);
        }
        cacheNode = primitiveNode;
      }
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (cacheNode.s === TERMINATED) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return cacheNode.v as T;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (cacheNode.s === ERRORED) {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw cacheNode.v;
    }

    // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
    try {
      // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
      const result = fn.apply(null, args);
      cacheNode.s = TERMINATED;
      cacheNode.v = result;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return result;
    // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
    } catch (error) {
      cacheNode.s = ERRORED;
      cacheNode.v = error;
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw error;
    }
  };
}

// @beginner: 进入 cacheSignal：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function cacheSignal(): AbortSignal | null {
  // @beginner: 声明 dispatcher：保存当前步骤需要读取或更新的数据。
  const dispatcher = ReactSharedInternals.A;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher ? dispatcher.cacheSignal() : null;
}
