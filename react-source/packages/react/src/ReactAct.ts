/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { RendererTask } from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import queueMacrotask from "shared/enqueueTask.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { disableLegacyMode } from "shared/ReactFeatureFlags.js";

// @beginner: 定义 Thenable：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Thenable<T> = {
  then(resolve: (value: T) => void, reject?: (error: unknown) => void): void;
};

// @beginner: 声明 actScopeDepth：保存当前步骤需要读取或更新的数据。
let actScopeDepth = 0;
// @beginner: 声明 didWarnNoAwaitAct：保存当前步骤需要读取或更新的数据。
let didWarnNoAwaitAct = false;
// @beginner: 声明 isFlushing：保存当前步骤需要读取或更新的数据。
let isFlushing = false;

// @beginner: 进入 isThenable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isThenable<T>(value: unknown): value is Thenable<T> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";
}

// @beginner: 进入 aggregateErrors：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function aggregateErrors(errors: unknown[]): unknown {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return errors.length > 1 && typeof AggregateError === "function" ? new AggregateError(errors) : errors[0];
}

// @beginner: 进入 popActScope：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function popActScope(prevActQueue: RendererTask[] | null, prevActScopeDepth: number): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prevActScopeDepth !== actScopeDepth - 1) {
    console.error(
      "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one.",
    );
  }
  actScopeDepth = prevActScopeDepth;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prevActScopeDepth > 0) {
    ReactSharedInternals.actQueue = prevActQueue;
  }
}

// @beginner: 进入 flushActQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function flushActQueue(queue: RendererTask[]): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isFlushing) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  isFlushing = true;
  // @beginner: 声明 i：保存当前步骤需要读取或更新的数据。
  let i = 0;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (; i < queue.length; i += 1) {
      // @beginner: 声明 callback：保存当前步骤需要读取或更新的数据。
      let callback: RendererTask = queue[i];
      // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
      do {
        ReactSharedInternals.didUsePromise = false;
        // @beginner: 声明 continuation：保存当前步骤需要读取或更新的数据。
        const continuation = callback(false);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (continuation !== null) {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (ReactSharedInternals.didUsePromise) {
            queue[i] = callback;
            queue.splice(0, i);
            // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
            return;
          }
          callback = continuation;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          break;
        }
      } while (true);
    }
    queue.length = 0;
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    queue.splice(0, i + 1);
    ReactSharedInternals.thrownErrors.push(error);
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    isFlushing = false;
  }
}

// @beginner: 进入 recursivelyFlushAsyncActWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function recursivelyFlushAsyncActWork<T>(
  returnValue: T,
  resolve: (value: T) => void,
  reject: (error: unknown) => void,
): void {
  // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
  const queue = ReactSharedInternals.actQueue;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queue !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (queue.length !== 0) {
      // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
      try {
        flushActQueue(queue);
        queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
      } catch (error) {
        ReactSharedInternals.thrownErrors.push(error);
      }
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      ReactSharedInternals.actQueue = null;
    }
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ReactSharedInternals.thrownErrors.length > 0) {
    // @beginner: 声明 thrownError：保存当前步骤需要读取或更新的数据。
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    reject(thrownError);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    resolve(returnValue);
  }
}

// @beginner: 声明 queueSeveralMicrotasks：保存当前步骤需要读取或更新的数据。
const queueSeveralMicrotasks =
  typeof queueMicrotask === "function"
    ? (callback: () => void) => {
        queueMicrotask(() => queueMicrotask(callback));
      }
    : queueMacrotask;

/**
 * 测试用 `act`：进入 act scope 时把 renderer task 收集到共享队列，离开最外层
 * scope 后同步/异步 flush。形态对齐官方 thenable API，支持 `await act(...)`。
 */
// @beginner: 进入 act：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function act<T>(callback: () => T | Promise<T> | Thenable<T>): Thenable<T> {
  // @beginner: 声明 prevIsBatchingLegacy：保存当前步骤需要读取或更新的数据。
  const prevIsBatchingLegacy = !disableLegacyMode ? ReactSharedInternals.isBatchingLegacy : false;
  // @beginner: 声明 prevActQueue：保存当前步骤需要读取或更新的数据。
  const prevActQueue = ReactSharedInternals.actQueue;
  // @beginner: 声明 prevActScopeDepth：保存当前步骤需要读取或更新的数据。
  const prevActScopeDepth = actScopeDepth;
  actScopeDepth += 1;
  // @beginner: 声明 queue：保存当前步骤需要读取或更新的数据。
  const queue = (ReactSharedInternals.actQueue = prevActQueue !== null ? prevActQueue : []);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!disableLegacyMode) {
    ReactSharedInternals.isBatchingLegacy = true;
    ReactSharedInternals.didScheduleLegacyUpdate = false;
  }

  // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
  let result: T | Promise<T> | Thenable<T> | undefined;
  // @beginner: 声明 didAwaitActCall：保存当前步骤需要读取或更新的数据。
  let didAwaitActCall = false;

  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    result = callback();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!disableLegacyMode && !prevIsBatchingLegacy && ReactSharedInternals.didScheduleLegacyUpdate) {
      flushActQueue(queue);
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!disableLegacyMode) {
      ReactSharedInternals.isBatchingLegacy = prevIsBatchingLegacy;
    }
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!disableLegacyMode) {
      ReactSharedInternals.isBatchingLegacy = prevIsBatchingLegacy;
    }
    ReactSharedInternals.thrownErrors.push(error);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ReactSharedInternals.thrownErrors.length > 0) {
    popActScope(prevActQueue, prevActScopeDepth);
    // @beginner: 声明 thrownError：保存当前步骤需要读取或更新的数据。
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw thrownError;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isThenable<T>(result)) {
    queueSeveralMicrotasks(() => {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (!didAwaitActCall && !didWarnNoAwaitAct) {
        didWarnNoAwaitAct = true;
        console.error("You called act(async () => ...) without await.");
      }
    });

    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return {
      then(resolve, reject = () => undefined) {
        didAwaitActCall = true;
        result.then(
          (returnValue) => {
            popActScope(prevActQueue, prevActScopeDepth);
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (prevActScopeDepth === 0) {
              // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
              try {
                flushActQueue(queue);
                queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
              // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
              } catch (error) {
                ReactSharedInternals.thrownErrors.push(error);
              }
              // @beginner: 条件分支：根据当前值选择不同处理路径。
              if (ReactSharedInternals.thrownErrors.length > 0) {
                // @beginner: 声明 thrownError：保存当前步骤需要读取或更新的数据。
                const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                ReactSharedInternals.thrownErrors.length = 0;
                reject(thrownError);
              }
            // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
            } else {
              resolve(returnValue);
            }
          },
          (error) => {
            popActScope(prevActQueue, prevActScopeDepth);
            reject(error);
          },
        );
      },
    };
  }

  // @beginner: 声明 returnValue：保存当前步骤需要读取或更新的数据。
  const returnValue = result as T;
  popActScope(prevActQueue, prevActScopeDepth);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prevActScopeDepth === 0) {
    flushActQueue(queue);
    ReactSharedInternals.actQueue = null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ReactSharedInternals.thrownErrors.length > 0) {
    // @beginner: 声明 thrownError：保存当前步骤需要读取或更新的数据。
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw thrownError;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    then(resolve, reject = () => undefined) {
      didAwaitActCall = true;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (prevActScopeDepth === 0) {
        ReactSharedInternals.actQueue = queue;
        queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        resolve(returnValue);
      }
    },
  };
}
