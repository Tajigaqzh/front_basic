/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactSymbols.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactTypes.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as ReactSharedInternals } from "./ReactSharedInternals.js";
export type { AsyncCacheDispatcher, RendererTask } from "./ReactSharedInternals.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as ReactDOMSharedInternals } from "./ReactDOMSharedInternals.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as assign } from "./assign.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as isArray } from "./isArray.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as objectIs } from "./objectIs.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as shallowEqual } from "./shallowEqual.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as hasOwnProperty } from "./hasOwnProperty.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as noop } from "./noop.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as getPrototypeOf } from "./getPrototypeOf.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as getComponentNameFromType } from "./getComponentNameFromType.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactFeatureFlags.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ExecutionEnvironment.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * as ReactInstanceMap from "./ReactInstanceMap.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./CheckStringCoercion.js";
export type { ReactElement as ReactElementType } from "./ReactElementType.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ConsolePatchingDev.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as DefaultPrepareStackTrace } from "./DefaultPrepareStackTrace.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as DefaultPrepareStackTraceV8 } from "./DefaultPrepareStackTraceV8.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactComponentStackFrame.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactOwnerStackFrames.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactComponentInfoStack.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactFlightPropertyAccess.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactIODescription.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as binaryToComparableString } from "./binaryToComparableString.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { default as normalizeConsoleFormat } from "./normalizeConsoleFormat.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactSerializationErrors.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactPerformanceTrackProperties.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactDOMFragmentRefShared.js";
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export * from "./ReactOwnerStackReset.js";
