import type { RendererTask } from "shared/ReactSharedInternals.js";
import ReactSharedInternals from "shared/ReactSharedInternals.js";
import queueMacrotask from "shared/enqueueTask.js";
import { disableLegacyMode } from "shared/ReactFeatureFlags.js";

type Thenable<T> = {
  then(resolve: (value: T) => void, reject?: (error: unknown) => void): void;
};

let actScopeDepth = 0;
let didWarnNoAwaitAct = false;
let isFlushing = false;

function isThenable<T>(value: unknown): value is Thenable<T> {
  return value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";
}

function aggregateErrors(errors: unknown[]): unknown {
  return errors.length > 1 && typeof AggregateError === "function" ? new AggregateError(errors) : errors[0];
}

function popActScope(prevActQueue: RendererTask[] | null, prevActScopeDepth: number): void {
  if (prevActScopeDepth !== actScopeDepth - 1) {
    console.error(
      "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one.",
    );
  }
  actScopeDepth = prevActScopeDepth;
  if (prevActScopeDepth > 0) {
    ReactSharedInternals.actQueue = prevActQueue;
  }
}

function flushActQueue(queue: RendererTask[]): void {
  if (isFlushing) {
    return;
  }

  isFlushing = true;
  let i = 0;
  try {
    for (; i < queue.length; i += 1) {
      let callback: RendererTask = queue[i];
      do {
        ReactSharedInternals.didUsePromise = false;
        const continuation = callback(false);
        if (continuation !== null) {
          if (ReactSharedInternals.didUsePromise) {
            queue[i] = callback;
            queue.splice(0, i);
            return;
          }
          callback = continuation;
        } else {
          break;
        }
      } while (true);
    }
    queue.length = 0;
  } catch (error) {
    queue.splice(0, i + 1);
    ReactSharedInternals.thrownErrors.push(error);
  } finally {
    isFlushing = false;
  }
}

function recursivelyFlushAsyncActWork<T>(
  returnValue: T,
  resolve: (value: T) => void,
  reject: (error: unknown) => void,
): void {
  const queue = ReactSharedInternals.actQueue;
  if (queue !== null) {
    if (queue.length !== 0) {
      try {
        flushActQueue(queue);
        queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
        return;
      } catch (error) {
        ReactSharedInternals.thrownErrors.push(error);
      }
    } else {
      ReactSharedInternals.actQueue = null;
    }
  }

  if (ReactSharedInternals.thrownErrors.length > 0) {
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    reject(thrownError);
  } else {
    resolve(returnValue);
  }
}

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
export function act<T>(callback: () => T | Promise<T> | Thenable<T>): Thenable<T> {
  const prevIsBatchingLegacy = !disableLegacyMode ? ReactSharedInternals.isBatchingLegacy : false;
  const prevActQueue = ReactSharedInternals.actQueue;
  const prevActScopeDepth = actScopeDepth;
  actScopeDepth += 1;
  const queue = (ReactSharedInternals.actQueue = prevActQueue !== null ? prevActQueue : []);

  if (!disableLegacyMode) {
    ReactSharedInternals.isBatchingLegacy = true;
    ReactSharedInternals.didScheduleLegacyUpdate = false;
  }

  let result: T | Promise<T> | Thenable<T> | undefined;
  let didAwaitActCall = false;

  try {
    result = callback();
    if (!disableLegacyMode && !prevIsBatchingLegacy && ReactSharedInternals.didScheduleLegacyUpdate) {
      flushActQueue(queue);
    }
    if (!disableLegacyMode) {
      ReactSharedInternals.isBatchingLegacy = prevIsBatchingLegacy;
    }
  } catch (error) {
    if (!disableLegacyMode) {
      ReactSharedInternals.isBatchingLegacy = prevIsBatchingLegacy;
    }
    ReactSharedInternals.thrownErrors.push(error);
  }

  if (ReactSharedInternals.thrownErrors.length > 0) {
    popActScope(prevActQueue, prevActScopeDepth);
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    throw thrownError;
  }

  if (isThenable<T>(result)) {
    queueSeveralMicrotasks(() => {
      if (!didAwaitActCall && !didWarnNoAwaitAct) {
        didWarnNoAwaitAct = true;
        console.error("You called act(async () => ...) without await.");
      }
    });

    return {
      then(resolve, reject = () => undefined) {
        didAwaitActCall = true;
        result.then(
          (returnValue) => {
            popActScope(prevActQueue, prevActScopeDepth);
            if (prevActScopeDepth === 0) {
              try {
                flushActQueue(queue);
                queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
              } catch (error) {
                ReactSharedInternals.thrownErrors.push(error);
              }
              if (ReactSharedInternals.thrownErrors.length > 0) {
                const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                ReactSharedInternals.thrownErrors.length = 0;
                reject(thrownError);
              }
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

  const returnValue = result as T;
  popActScope(prevActQueue, prevActScopeDepth);
  if (prevActScopeDepth === 0) {
    flushActQueue(queue);
    ReactSharedInternals.actQueue = null;
  }

  if (ReactSharedInternals.thrownErrors.length > 0) {
    const thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
    ReactSharedInternals.thrownErrors.length = 0;
    throw thrownError;
  }

  return {
    then(resolve, reject = () => undefined) {
      didAwaitActCall = true;
      if (prevActScopeDepth === 0) {
        ReactSharedInternals.actQueue = queue;
        queueMacrotask(() => recursivelyFlushAsyncActWork(returnValue, resolve, reject));
      } else {
        resolve(returnValue);
      }
    },
  };
}
