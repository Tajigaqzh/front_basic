export * from "../ReactFeatureFlags.js";

export const enableAsyncDebugInfo = true;
export const enableLegacyCache = true;
export const enableTaint = true;
export const disableCommentsAsDOMContainers = true;
export const enableScopeAPI = true;
export const enableSuspenseCallback = true;
export const enableSuspenseAvoidThisFallback = true;
export const enableFizzExternalRuntime = false;
export const alwaysThrottleRetries = true;
export const disableClientCache = true;
export const disableLegacyMode = true;
export const enableEagerAlternateStateNodeCleanup = true;
export const enableViewTransition = true;
export const enableScrollEndPolyfill = true;
export const enableFizzBlockingRender = true;
export const enableDefaultTransitionIndicator = true;
export const enableFragmentRefs = true;
export const enableFragmentRefsScrollIntoView = true;
export const enableFragmentRefsInstanceHandles = true;
export const enableFragmentRefsTextNodes = true;
export const ownerStackLimit = 1e4;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
