/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "../ReactFeatureFlags.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactFeatureFlags.native-fb-dynamic.js";

// @beginner: 声明 disableClientCache：保存当前步骤需要读取或更新的数据。
export const disableClientCache = true;
// @beginner: 声明 disableCommentsAsDOMContainers：保存当前步骤需要读取或更新的数据。
export const disableCommentsAsDOMContainers = true;
// @beginner: 声明 enableAsyncDebugInfo：保存当前步骤需要读取或更新的数据。
export const enableAsyncDebugInfo = true;
// @beginner: 声明 enableCPUSuspense：保存当前步骤需要读取或更新的数据。
export const enableCPUSuspense = true;
// @beginner: 声明 enableMoveBefore：保存当前步骤需要读取或更新的数据。
export const enableMoveBefore = true;
// @beginner: 声明 enableFizzExternalRuntime：保存当前步骤需要读取或更新的数据。
export const enableFizzExternalRuntime = true;
// @beginner: 声明 enableProfilerCommitHooks：保存当前步骤需要读取或更新的数据。
export const enableProfilerCommitHooks = false;
// @beginner: 声明 enableProfilerNestedUpdatePhase：保存当前步骤需要读取或更新的数据。
export const enableProfilerNestedUpdatePhase = false;
// @beginner: 声明 enableProfilerTimer：保存当前步骤需要读取或更新的数据。
export const enableProfilerTimer = false;
// @beginner: 声明 enableSchedulingProfiler：保存当前步骤需要读取或更新的数据。
export const enableSchedulingProfiler = false;
// @beginner: 声明 enableSuspenseCallback：保存当前步骤需要读取或更新的数据。
export const enableSuspenseCallback = true;
// @beginner: 声明 enableTaint：保存当前步骤需要读取或更新的数据。
export const enableTaint = true;
// @beginner: 声明 enableTrustedTypesIntegration：保存当前步骤需要读取或更新的数据。
export const enableTrustedTypesIntegration = true;
// @beginner: 声明 retryLaneExpirationMs：保存当前步骤需要读取或更新的数据。
export const retryLaneExpirationMs = 5000;
// @beginner: 声明 syncLaneExpirationMs：保存当前步骤需要读取或更新的数据。
export const syncLaneExpirationMs = 250;
// @beginner: 声明 transitionLaneExpirationMs：保存当前步骤需要读取或更新的数据。
export const transitionLaneExpirationMs = 5000;
// @beginner: 声明 enableViewTransition：保存当前步骤需要读取或更新的数据。
export const enableViewTransition = true;
// @beginner: 声明 enableScrollEndPolyfill：保存当前步骤需要读取或更新的数据。
export const enableScrollEndPolyfill = true;
// @beginner: 声明 enableFizzBlockingRender：保存当前步骤需要读取或更新的数据。
export const enableFizzBlockingRender = true;
// @beginner: 声明 enableHydrationChangeEvent：保存当前步骤需要读取或更新的数据。
export const enableHydrationChangeEvent = true;
// @beginner: 声明 enableDefaultTransitionIndicator：保存当前步骤需要读取或更新的数据。
export const enableDefaultTransitionIndicator = true;
// @beginner: 声明 ownerStackLimit：保存当前步骤需要读取或更新的数据。
export const ownerStackLimit = 1e4;
// @beginner: 声明 enableComponentPerformanceTrack：保存当前步骤需要读取或更新的数据。
export const enableComponentPerformanceTrack = true;
// @beginner: 声明 enablePerformanceIssueReporting：保存当前步骤需要读取或更新的数据。
export const enablePerformanceIssueReporting = true;
// @beginner: 声明 eprh_enableUseKeyedStateCompilerLint：保存当前步骤需要读取或更新的数据。
export const eprh_enableUseKeyedStateCompilerLint = false;
// @beginner: 声明 eprh_enableVerboseNoSetStateInEffectCompilerLint：保存当前步骤需要读取或更新的数据。
export const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
// @beginner: 声明 eprh_enableExhaustiveEffectDependenciesCompilerLint：保存当前步骤需要读取或更新的数据。
export const eprh_enableExhaustiveEffectDependenciesCompilerLint:
  | "off"
  | "all"
  | "extra-only"
  | "missing-only" = "off";
