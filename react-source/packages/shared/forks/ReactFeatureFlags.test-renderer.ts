export * from "../ReactFeatureFlags.js";

export const enableAsyncDebugInfo = true;
export const enableComponentPerformanceTrack = true;
export const enablePerformanceIssueReporting = false;
export const enableTaint = true;
export const disableCommentsAsDOMContainers = true;
export const enableTrustedTypesIntegration = true;
export const enableFizzExternalRuntime = true;
export const alwaysThrottleRetries = true;
export const disableClientCache = true;
export const enableEagerAlternateStateNodeCleanup = true;
export const enableYieldingBeforePassive = true;
export const enableViewTransition = true;
export const enableScrollEndPolyfill = true;
export const enableFizzBlockingRender = true;
export const ownerStackLimit = 1e4;
export const enableFragmentRefs = true;
export const enableFragmentRefsScrollIntoView = true;
export const enableFragmentRefsInstanceHandles = true;
export const enableFragmentRefsTextNodes = true;
export const disableLegacyMode = true;
export const disableLegacyContext = true;
export const disableLegacyContextForFunctionComponents = true;
export const enableReactTestRendererWarning = true;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
