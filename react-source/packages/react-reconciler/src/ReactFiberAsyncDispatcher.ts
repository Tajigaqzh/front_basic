/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AsyncDispatcher, Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Cache } from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { CacheContext } from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { readContext } from "./ReactFiberNewContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { current as currentOwner } from "./ReactCurrentFiber.js";

// @beginner: 进入 getCacheForType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getCacheForType<T>(resourceType: () => T): T {
  // @beginner: 声明 cache：保存当前步骤需要读取或更新的数据。
  const cache: Cache = readContext(CacheContext);
  // @beginner: 声明 cacheForType：保存当前步骤需要读取或更新的数据。
  let cacheForType = cache.data.get(resourceType) as T | undefined;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cacheForType === undefined) {
    cacheForType = resourceType();
    cache.data.set(resourceType, cacheForType);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return cacheForType;
}

// @beginner: 进入 cacheSignal：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function cacheSignal(): AbortSignal | null {
  // @beginner: 声明 cache：保存当前步骤需要读取或更新的数据。
  const cache: Cache = readContext(CacheContext);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return cache.controller.signal;
}

// @beginner: 声明 DefaultAsyncDispatcher：保存当前步骤需要读取或更新的数据。
export const DefaultAsyncDispatcher: AsyncDispatcher = {
  getCacheForType,
  cacheSignal,
  getOwner(): Fiber | null {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return currentOwner;
  },
};
