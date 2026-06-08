/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 IS_EVENT_HANDLE_NON_MANAGED_NODE：保存当前步骤需要读取或更新的数据。
export const IS_EVENT_HANDLE_NON_MANAGED_NODE = 1;
// @beginner: 声明 IS_NON_DELEGATED：保存当前步骤需要读取或更新的数据。
export const IS_NON_DELEGATED = 1 << 1;
// @beginner: 声明 IS_CAPTURE_PHASE：保存当前步骤需要读取或更新的数据。
export const IS_CAPTURE_PHASE = 1 << 2;
// @beginner: 声明 SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS：保存当前步骤需要读取或更新的数据。
export const SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS = 1 << 3;

// @beginner: 定义 EventSystemFlags：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type EventSystemFlags = number;
