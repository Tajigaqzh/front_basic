export * from "../ReactFeatureFlags.js";
export * from "./ReactFeatureFlags.native-fb-dynamic.js";

export const disableClientCache = true;
export const disableCommentsAsDOMContainers = true;
export const enableAsyncDebugInfo = true;
export const enableCPUSuspense = true;
export const enableMoveBefore = true;
export const enableFizzExternalRuntime = true;
export const enableProfilerCommitHooks = false;
export const enableProfilerNestedUpdatePhase = false;
export const enableProfilerTimer = false;
export const enableSchedulingProfiler = false;
export const enableSuspenseCallback = true;
export const enableTaint = true;
export const enableTrustedTypesIntegration = true;
export const retryLaneExpirationMs = 5000;
export const syncLaneExpirationMs = 250;
export const transitionLaneExpirationMs = 5000;
export const enableViewTransition = true;
export const enableScrollEndPolyfill = true;
export const enableFizzBlockingRender = true;
export const enableHydrationChangeEvent = true;
export const enableDefaultTransitionIndicator = true;
export const ownerStackLimit = 1e4;
export const enableComponentPerformanceTrack = true;
export const enablePerformanceIssueReporting = true;
export const eprh_enableUseKeyedStateCompilerLint = false;
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
