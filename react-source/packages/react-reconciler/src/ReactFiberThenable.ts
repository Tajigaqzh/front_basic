/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Thenable } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { noop } from "shared";

// @beginner: 定义 ThenableStateDev：描述对象需要具备哪些字段，方便读者理解数据形状。
interface ThenableStateDev {
  didWarnAboutUncachedPromise: boolean;
  thenables: Array<Thenable<unknown>>;
}

// @beginner: 定义 ThenableStateProd：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ThenableStateProd = Array<Thenable<unknown>>;
// @beginner: 定义 ThenableState：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ThenableState = ThenableStateDev | ThenableStateProd;

// @beginner: 定义 LazyComponentLike：描述对象需要具备哪些字段，方便读者理解数据形状。
interface LazyComponentLike<T> {
  _payload: unknown;
  _init(payload: unknown): T;
}

// @beginner: 进入 getThenablesFromState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getThenablesFromState(state: ThenableState): Array<Thenable<unknown>> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return Array.isArray(state) ? state : state.thenables;
}

// @beginner: 声明 SuspenseException：保存当前步骤需要读取或更新的数据。
export const SuspenseException: unknown = new Error(
  "Suspense Exception: This is not a real error. It is an implementation detail used to interrupt render.",
);

// @beginner: 声明 SuspenseyCommitException：保存当前步骤需要读取或更新的数据。
export const SuspenseyCommitException: unknown = new Error(
  "Suspense Exception: This is not a real error, and should not leak into userspace.",
);

// @beginner: 声明 SuspenseActionException：保存当前步骤需要读取或更新的数据。
export const SuspenseActionException: unknown = new Error(
  "Suspense Exception: useActionState interrupted the current render.",
);

// @beginner: 声明 noopSuspenseyCommitThenable：保存当前步骤需要读取或更新的数据。
export const noopSuspenseyCommitThenable: Thenable<never> = {
  then() {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return undefined;
  },
};

// @beginner: 声明 suspendedThenable：保存当前步骤需要读取或更新的数据。
let suspendedThenable: Thenable<unknown> | null = null;
// @beginner: 声明 needsToResetSuspendedThenable：保存当前步骤需要读取或更新的数据。
let needsToResetSuspendedThenable = false;

// @beginner: 进入 createThenableState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createThenableState(): ThenableState {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    didWarnAboutUncachedPromise: false,
    thenables: [],
  };
}

// @beginner: 进入 isThenableResolved：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isThenableResolved(thenable: Thenable<unknown>): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thenable.status === "fulfilled" || thenable.status === "rejected";
}

// @beginner: 进入 trackUsedThenable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackUsedThenable<T>(
  thenableState: ThenableState,
  thenable: Thenable<T>,
  index: number,
): T {
  // @beginner: 声明 trackedThenables：保存当前步骤需要读取或更新的数据。
  const trackedThenables = getThenablesFromState(thenableState);
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = trackedThenables[index] as Thenable<T> | undefined;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (previous === undefined) {
    trackedThenables.push(thenable as Thenable<unknown>);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (previous !== thenable) {
    // 官方实现会复用第一次看到的 thenable，丢弃后续同位置的新 Promise，
    // 这样组件重复渲染时不会因为“每次创建新 Promise”进入无限 ping。
    thenable.then(noop, noop);
    thenable = previous;
  }

  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (thenable.status) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "fulfilled":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return thenable.value as T;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "rejected":
      checkIfUseWrappedInAsyncCatch(thenable.reason);
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw thenable.reason;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof thenable.status === "string") {
        thenable.then(noop, noop);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 声明 pendingThenable：保存当前步骤需要读取或更新的数据。
        const pendingThenable = thenable as Thenable<T> & {
          status: "pending";
          value?: T;
          reason?: unknown;
        };
        pendingThenable.status = "pending";
        pendingThenable.then(
          (fulfilledValue) => {
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (pendingThenable.status === "pending") {
              (pendingThenable as unknown as { status: "fulfilled"; value: T }).status =
                "fulfilled";
              (pendingThenable as unknown as { value: T }).value = fulfilledValue;
            }
          },
          (error) => {
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (pendingThenable.status === "pending") {
              (pendingThenable as unknown as { status: "rejected"; reason: unknown }).status =
                "rejected";
              (pendingThenable as unknown as { reason: unknown }).reason = error;
            }
          },
        );
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (thenable.status === "fulfilled") {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return thenable.value as T;
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (thenable.status === "rejected") {
        checkIfUseWrappedInAsyncCatch(thenable.reason);
        // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
        throw thenable.reason;
      }

      suspendedThenable = thenable as Thenable<unknown>;
      needsToResetSuspendedThenable = true;
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw SuspenseException;
  }
}

// @beginner: 进入 suspendCommit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function suspendCommit(): void {
  suspendedThenable = noopSuspenseyCommitThenable;
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw SuspenseyCommitException;
}

// @beginner: 进入 resolveLazy：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resolveLazy<T>(lazyType: LazyComponentLike<T>): T {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return lazyType._init(lazyType._payload);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (error !== null && typeof error === "object" && typeof (error as { then?: unknown }).then === "function") {
      suspendedThenable = error as Thenable<unknown>;
      needsToResetSuspendedThenable = true;
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw SuspenseException;
    }
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw error;
  }
}

// @beginner: 进入 getSuspendedThenable：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSuspendedThenable(): Thenable<unknown> {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (suspendedThenable === null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Expected a suspended thenable.");
  }
  // @beginner: 声明 thenable：保存当前步骤需要读取或更新的数据。
  const thenable = suspendedThenable;
  suspendedThenable = null;
  needsToResetSuspendedThenable = false;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thenable;
}

// @beginner: 进入 checkIfUseWrappedInTryCatch：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkIfUseWrappedInTryCatch(): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (needsToResetSuspendedThenable) {
    needsToResetSuspendedThenable = false;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 checkIfUseWrappedInAsyncCatch：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkIfUseWrappedInAsyncCatch(rejectedReason: unknown): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Hooks are not supported inside an async component.");
  }
}
