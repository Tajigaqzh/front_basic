/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createContext } from "react";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ReactSharedInternals } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createLRU, type Entry } from "./LRU.js";

// @beginner: 定义 Suspender：描述对象需要具备哪些字段，方便读者理解数据形状。
interface Suspender {
  then(resolve: () => unknown, reject: () => unknown): unknown;
}

// @beginner: 定义 PendingResult：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type PendingResult = {
  status: 0;
  value: Suspender;
};

// @beginner: 定义 ResolvedResult：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ResolvedResult<V> = {
  status: 1;
  value: V;
};

// @beginner: 定义 RejectedResult：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type RejectedResult = {
  status: 2;
  value: unknown;
};

// @beginner: 定义 Result：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Result<V> = PendingResult | ResolvedResult<V> | RejectedResult;

// @beginner: 定义 Resource：描述对象需要具备哪些字段，方便读者理解数据形状。
interface Resource<I, V> {
  read(input: I): V;
  preload(input: I): void;
}

// @beginner: 声明 Pending：保存当前步骤需要读取或更新的数据。
const Pending = 0;
// @beginner: 声明 Resolved：保存当前步骤需要读取或更新的数据。
const Resolved = 1;
// @beginner: 声明 Rejected：保存当前步骤需要读取或更新的数据。
const Rejected = 2;

// @beginner: 进入 readContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function readContext(Context: ReactContext<unknown>): unknown {
  // @beginner: 声明 dispatcher：保存当前步骤需要读取或更新的数据。
  const dispatcher = ReactSharedInternals.H;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher === null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error(
      "react-cache: read and preload may only be called from within a component's render. They are not supported in event handlers or lifecycle methods.",
    );
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher.readContext(Context);
}

// @beginner: 进入 identityHashFn：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function identityHashFn<I>(input: I): I {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return input;
}

// @beginner: 声明 CACHE_LIMIT：保存当前步骤需要读取或更新的数据。
const CACHE_LIMIT = 500;
// @beginner: 声明 lru：保存当前步骤需要读取或更新的数据。
const lru = createLRU<Result<unknown>>(CACHE_LIMIT);
// @beginner: 声明 entries：保存当前步骤需要读取或更新的数据。
const entries: Map<Resource<unknown, unknown>, Map<unknown, Entry<Result<unknown>>>> = new Map();

// @beginner: 声明 CacheContext：保存当前步骤需要读取或更新的数据。
const CacheContext = createContext<unknown>(null);

// @beginner: 进入 accessResult：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function accessResult<I, K, V>(
  resource: Resource<I, V>,
  fetch: (input: I) => Promise<V>,
  input: I,
  key: K,
): Result<V> {
  // @beginner: 声明 entriesForResource：保存当前步骤需要读取或更新的数据。
  let entriesForResource = entries.get(resource as Resource<unknown, unknown>);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (entriesForResource === undefined) {
    entriesForResource = new Map();
    entries.set(resource as Resource<unknown, unknown>, entriesForResource);
  }

  // @beginner: 声明 entry：保存当前步骤需要读取或更新的数据。
  const entry = entriesForResource.get(key);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (entry === undefined) {
    // @beginner: 声明 thenable：保存当前步骤需要读取或更新的数据。
    const thenable = fetch(input);
    // @beginner: 声明 newResult：保存当前步骤需要读取或更新的数据。
    const newResult: PendingResult = {
      status: Pending,
      value: thenable,
    };

    thenable.then(
      (value) => {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newResult.status === Pending) {
          (newResult as unknown as ResolvedResult<V>).status = Resolved;
          (newResult as unknown as ResolvedResult<V>).value = value;
        }
      },
      (error) => {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (newResult.status === Pending) {
          (newResult as unknown as RejectedResult).status = Rejected;
          (newResult as unknown as RejectedResult).value = error;
        }
      },
    );

    // @beginner: 声明 newEntry：保存当前步骤需要读取或更新的数据。
    const newEntry = lru.add(
      newResult as Result<unknown>,
      deleteEntry.bind(null, resource as Resource<unknown, unknown>, key),
    );
    entriesForResource.set(key, newEntry);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return newResult as Result<V>;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return lru.access(entry) as Result<V>;
}

// @beginner: 进入 deleteEntry：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function deleteEntry(resource: Resource<unknown, unknown>, key: unknown): void {
  // @beginner: 声明 entriesForResource：保存当前步骤需要读取或更新的数据。
  const entriesForResource = entries.get(resource);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (entriesForResource !== undefined) {
    entriesForResource.delete(key);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (entriesForResource.size === 0) {
      entries.delete(resource);
    }
  }
}

// @beginner: 进入 unstable_createResource：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_createResource<I, K extends string | number | symbol | boolean | null | undefined, V>(
  fetch: (input: I) => Promise<V>,
  maybeHashInput?: (input: I) => K,
): Resource<I, V> {
  // @beginner: 声明 hashInput：保存当前步骤需要读取或更新的数据。
  const hashInput = maybeHashInput !== undefined ? maybeHashInput : identityHashFn<I>;

  // @beginner: 声明 resource：保存当前步骤需要读取或更新的数据。
  const resource: Resource<I, V> = {
    read(input: I): V {
      // react-cache 当前不依赖 context 值，但官方会读取它来限制只能在 render 期间访问。
      readContext(CacheContext);
      // @beginner: 声明 key：保存当前步骤需要读取或更新的数据。
      const key = hashInput(input);
      // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
      const result = accessResult(resource, fetch, input, key);
      // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
      switch (result.status) {
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case Pending:
          // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
          throw result.value;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case Resolved:
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return result.value;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case Rejected:
          // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
          throw result.value;
      }
    },

    preload(input: I): void {
      readContext(CacheContext);
      // @beginner: 声明 key：保存当前步骤需要读取或更新的数据。
      const key = hashInput(input);
      accessResult(resource, fetch, input, key);
    },
  };

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resource;
}

// @beginner: 进入 unstable_setGlobalCacheLimit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unstable_setGlobalCacheLimit(limit: number): void {
  lru.setLimit(limit);
}
