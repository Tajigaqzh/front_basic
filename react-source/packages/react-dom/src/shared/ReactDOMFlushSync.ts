import { disableLegacyMode } from "shared/ReactFeatureFlags.js";
import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
import ReactSharedInternals from "shared/ReactSharedInternals.js";
import { DiscreteEventPriority } from "react-reconciler/src/ReactEventPriorities.js";

function flushSyncImpl<R>(fn?: () => R): R | undefined {
  const previousTransition = ReactSharedInternals.T;
  const previousUpdatePriority = ReactDOMSharedInternals.p;

  try {
    // flushSync 内部的更新必须按离散事件优先级处理，并且不能继承外层 transition。
    ReactSharedInternals.T = null;
    ReactDOMSharedInternals.p = DiscreteEventPriority;
    return fn ? fn() : undefined;
  } finally {
    ReactSharedInternals.T = previousTransition;
    ReactDOMSharedInternals.p = previousUpdatePriority;
    ReactDOMSharedInternals.d.f();
  }
}

function flushSyncErrorInBuildsThatSupportLegacyMode(): never {
  throw new Error("Expected this build of React to not support legacy mode but it does. This is a bug in React.");
}

export const flushSync: typeof flushSyncImpl = disableLegacyMode
  ? flushSyncImpl
  : flushSyncErrorInBuildsThatSupportLegacyMode;
