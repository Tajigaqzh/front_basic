export * from "../ReactFeatureFlags.js";

export const alwaysThrottleRetries = false;
export const disableClientCache = true;
export const disableCommentsAsDOMContainers = true;
export const enableAsyncDebugInfo = true;
export const enableCPUSuspense = true;
export const enableFizzExternalRuntime = true;
export const enableTaint = true;
export const enableTrustedTypesIntegration = true;
export const retryLaneExpirationMs = 5000;
export const syncLaneExpirationMs = 250;
export const transitionLaneExpirationMs = 5000;
export const enableViewTransition = true;
export const enableScrollEndPolyfill = true;
export const enableFizzBlockingRender = true;
export const enableDefaultTransitionIndicator = true;
export const enableFragmentRefs = false;
export const enableFragmentRefsScrollIntoView = false;
export const enableFragmentRefsInstanceHandles = false;
export const enableFragmentRefsTextNodes = false;
export const ownerStackLimit = 1e4;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
