/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_CONTEXT_TYPE } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { pushProvider, popProvider } from "./ReactFiberNewContext.js";

// @beginner: 声明 AbortControllerLocal：保存当前步骤需要读取或更新的数据。
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

// @beginner: 定义 Cache：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Cache {
  controller: AbortController;
  data: Map<() => unknown, unknown>;
  refCount: number;
}

// @beginner: 定义 CacheComponentState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface CacheComponentState {
  parent: Cache;
  cache: Cache;
}

// @beginner: 定义 SpawnedCachePool：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SpawnedCachePool {
  parent: Cache;
  pool: Cache;
}

// @beginner: 声明 CacheContext：保存当前步骤需要读取或更新的数据。
export const CacheContext: ReactContext<Cache> = {
  $$typeof: REACT_CONTEXT_TYPE,
  _currentValue: null as unknown as Cache,
  _currentValue2: null as unknown as Cache,
  _currentRenderer: null,
  _currentRenderer2: null,
  Provider: null as unknown as ReactContext<Cache>["Provider"],
  Consumer: null as unknown as ReactContext<Cache>["Consumer"],
};

// @beginner: 进入 createCache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createCache(): Cache {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    controller: new AbortControllerLocal() as AbortController,
    data: new Map(),
    refCount: 0,
  };
}

// @beginner: 声明 rootCache：保存当前步骤需要读取或更新的数据。
const rootCache = createCache();
retainCache(rootCache);
CacheContext._currentValue = rootCache;
CacheContext._currentValue2 = rootCache;

// @beginner: 进入 retainCache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function retainCache(cache: Cache): void {
  cache.refCount += 1;
}

// @beginner: 进入 releaseCache：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function releaseCache(cache: Cache): void {
  cache.refCount -= 1;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cache.refCount === 0) {
    queueMicrotask(() => cache.controller.abort());
  }
}

// @beginner: 进入 pushCacheProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushCacheProvider(workInProgress: Fiber, cache: Cache): void {
  pushProvider(workInProgress, CacheContext, cache);
}

// @beginner: 进入 popCacheProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popCacheProvider(workInProgress: Fiber, _cache: Cache): void {
  popProvider(CacheContext, workInProgress);
}
