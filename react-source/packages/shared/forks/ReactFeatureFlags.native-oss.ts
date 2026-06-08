export * from "../ReactFeatureFlags.js";

export const disableClientCache = true;
export const disableCommentsAsDOMContainers = true;
export const disableLegacyContext = true;
export const disableLegacyContextForFunctionComponents = true;
export const enableAsyncDebugInfo = true;
export const enableMoveBefore = true;
export const enableFizzExternalRuntime = true;
export const enableEagerAlternateStateNodeCleanup = true;
export const enableTaint = true;
export const enableTrustedTypesIntegration = true;
export const retryLaneExpirationMs = 5000;
export const syncLaneExpirationMs = 250;
export const transitionLaneExpirationMs = 5000;
export const enableViewTransition = true;
export const enableScrollEndPolyfill = true;
export const enableFizzBlockingRender = true;
export const ownerStackLimit = 1e4;
export const enableFragmentRefs = true;
export const enableFragmentRefsScrollIntoView = false;
export const enableFragmentRefsInstanceHandles = true;
export const enableFragmentRefsTextNodes = true;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
