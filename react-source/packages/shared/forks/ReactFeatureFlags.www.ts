export * from "../ReactFeatureFlags.js";
export * from "./ReactFeatureFlags.www-dynamic.js";

export const enableTrustedTypesIntegration = true;
export const enableSuspenseAvoidThisFallback = true;
export const enableAsyncDebugInfo = true;
export const enableCPUSuspense = true;
export const enableLegacyFBSupport = true;
export const enableComponentPerformanceTrack = true;
export const enableLegacyCache = true;
export const disableCommentsAsDOMContainers = false;
export const enableCreateEventHandleAPI = true;
export const enableScopeAPI = true;
export const enableSuspenseCallback = true;
export const enableLegacyHidden = true;
export const enableFizzExternalRuntime = true;
export const disableClientCache = true;
export const disableLegacyMode = true;
export const enableEagerAlternateStateNodeCleanup = true;
export const enableFizzBlockingRender = true;
export const enableDefaultTransitionIndicator = true;
export const ownerStackLimit = 1e4;
export const enableFragmentRefsInstanceHandles = true;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
