import type { Thenable } from "shared";
import { noop } from "shared";

interface ThenableStateDev {
  didWarnAboutUncachedPromise: boolean;
  thenables: Array<Thenable<unknown>>;
}

type ThenableStateProd = Array<Thenable<unknown>>;
export type ThenableState = ThenableStateDev | ThenableStateProd;

interface LazyComponentLike<T> {
  _payload: unknown;
  _init(payload: unknown): T;
}

function getThenablesFromState(state: ThenableState): Array<Thenable<unknown>> {
  return Array.isArray(state) ? state : state.thenables;
}

export const SuspenseException: unknown = new Error(
  "Suspense Exception: This is not a real error. It is an implementation detail used to interrupt render.",
);

export const SuspenseyCommitException: unknown = new Error(
  "Suspense Exception: This is not a real error, and should not leak into userspace.",
);

export const SuspenseActionException: unknown = new Error(
  "Suspense Exception: useActionState interrupted the current render.",
);

export const noopSuspenseyCommitThenable: Thenable<never> = {
  then() {
    return undefined;
  },
};

let suspendedThenable: Thenable<unknown> | null = null;
let needsToResetSuspendedThenable = false;

export function createThenableState(): ThenableState {
  return {
    didWarnAboutUncachedPromise: false,
    thenables: [],
  };
}

export function isThenableResolved(thenable: Thenable<unknown>): boolean {
  return thenable.status === "fulfilled" || thenable.status === "rejected";
}

export function trackUsedThenable<T>(
  thenableState: ThenableState,
  thenable: Thenable<T>,
  index: number,
): T {
  const trackedThenables = getThenablesFromState(thenableState);
  const previous = trackedThenables[index] as Thenable<T> | undefined;

  if (previous === undefined) {
    trackedThenables.push(thenable as Thenable<unknown>);
  } else if (previous !== thenable) {
    // 官方实现会复用第一次看到的 thenable，丢弃后续同位置的新 Promise，
    // 这样组件重复渲染时不会因为“每次创建新 Promise”进入无限 ping。
    thenable.then(noop, noop);
    thenable = previous;
  }

  switch (thenable.status) {
    case "fulfilled":
      return thenable.value as T;
    case "rejected":
      checkIfUseWrappedInAsyncCatch(thenable.reason);
      throw thenable.reason;
    default:
      if (typeof thenable.status === "string") {
        thenable.then(noop, noop);
      } else {
        const pendingThenable = thenable as Thenable<T> & {
          status: "pending";
          value?: T;
          reason?: unknown;
        };
        pendingThenable.status = "pending";
        pendingThenable.then(
          (fulfilledValue) => {
            if (pendingThenable.status === "pending") {
              (pendingThenable as unknown as { status: "fulfilled"; value: T }).status =
                "fulfilled";
              (pendingThenable as unknown as { value: T }).value = fulfilledValue;
            }
          },
          (error) => {
            if (pendingThenable.status === "pending") {
              (pendingThenable as unknown as { status: "rejected"; reason: unknown }).status =
                "rejected";
              (pendingThenable as unknown as { reason: unknown }).reason = error;
            }
          },
        );
      }

      if (thenable.status === "fulfilled") {
        return thenable.value as T;
      }
      if (thenable.status === "rejected") {
        checkIfUseWrappedInAsyncCatch(thenable.reason);
        throw thenable.reason;
      }

      suspendedThenable = thenable as Thenable<unknown>;
      needsToResetSuspendedThenable = true;
      throw SuspenseException;
  }
}

export function suspendCommit(): void {
  suspendedThenable = noopSuspenseyCommitThenable;
  throw SuspenseyCommitException;
}

export function resolveLazy<T>(lazyType: LazyComponentLike<T>): T {
  try {
    return lazyType._init(lazyType._payload);
  } catch (error) {
    if (error !== null && typeof error === "object" && typeof (error as { then?: unknown }).then === "function") {
      suspendedThenable = error as Thenable<unknown>;
      needsToResetSuspendedThenable = true;
      throw SuspenseException;
    }
    throw error;
  }
}

export function getSuspendedThenable(): Thenable<unknown> {
  if (suspendedThenable === null) {
    throw new Error("Expected a suspended thenable.");
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  needsToResetSuspendedThenable = false;
  return thenable;
}

export function checkIfUseWrappedInTryCatch(): boolean {
  if (needsToResetSuspendedThenable) {
    needsToResetSuspendedThenable = false;
    return true;
  }
  return false;
}

export function checkIfUseWrappedInAsyncCatch(rejectedReason: unknown): void {
  if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException) {
    throw new Error("Hooks are not supported inside an async component.");
  }
}
