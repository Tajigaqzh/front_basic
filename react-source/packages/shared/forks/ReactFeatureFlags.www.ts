/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "../ReactFeatureFlags.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactFeatureFlags.www-dynamic.js";

// @beginner: 声明 enableTrustedTypesIntegration：保存当前步骤需要读取或更新的数据。
export const enableTrustedTypesIntegration = true;
// @beginner: 声明 enableSuspenseAvoidThisFallback：保存当前步骤需要读取或更新的数据。
export const enableSuspenseAvoidThisFallback = true;
// @beginner: 声明 enableAsyncDebugInfo：保存当前步骤需要读取或更新的数据。
export const enableAsyncDebugInfo = true;
// @beginner: 声明 enableCPUSuspense：保存当前步骤需要读取或更新的数据。
export const enableCPUSuspense = true;
// @beginner: 声明 enableLegacyFBSupport：保存当前步骤需要读取或更新的数据。
export const enableLegacyFBSupport = true;
// @beginner: 声明 enableComponentPerformanceTrack：保存当前步骤需要读取或更新的数据。
export const enableComponentPerformanceTrack = true;
// @beginner: 声明 enableLegacyCache：保存当前步骤需要读取或更新的数据。
export const enableLegacyCache = true;
// @beginner: 声明 disableCommentsAsDOMContainers：保存当前步骤需要读取或更新的数据。
export const disableCommentsAsDOMContainers = false;
// @beginner: 声明 enableCreateEventHandleAPI：保存当前步骤需要读取或更新的数据。
export const enableCreateEventHandleAPI = true;
// @beginner: 声明 enableScopeAPI：保存当前步骤需要读取或更新的数据。
export const enableScopeAPI = true;
// @beginner: 声明 enableSuspenseCallback：保存当前步骤需要读取或更新的数据。
export const enableSuspenseCallback = true;
// @beginner: 声明 enableLegacyHidden：保存当前步骤需要读取或更新的数据。
export const enableLegacyHidden = true;
// @beginner: 声明 enableFizzExternalRuntime：保存当前步骤需要读取或更新的数据。
export const enableFizzExternalRuntime = true;
// @beginner: 声明 disableClientCache：保存当前步骤需要读取或更新的数据。
export const disableClientCache = true;
// @beginner: 声明 disableLegacyMode：保存当前步骤需要读取或更新的数据。
export const disableLegacyMode = true;
// @beginner: 声明 enableEagerAlternateStateNodeCleanup：保存当前步骤需要读取或更新的数据。
export const enableEagerAlternateStateNodeCleanup = true;
// @beginner: 声明 enableFizzBlockingRender：保存当前步骤需要读取或更新的数据。
export const enableFizzBlockingRender = true;
// @beginner: 声明 enableDefaultTransitionIndicator：保存当前步骤需要读取或更新的数据。
export const enableDefaultTransitionIndicator = true;
// @beginner: 声明 ownerStackLimit：保存当前步骤需要读取或更新的数据。
export const ownerStackLimit = 1e4;
// @beginner: 声明 enableFragmentRefsInstanceHandles：保存当前步骤需要读取或更新的数据。
export const enableFragmentRefsInstanceHandles = true;
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
