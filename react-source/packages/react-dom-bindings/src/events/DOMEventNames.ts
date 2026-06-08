/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 DOMEventName：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type DOMEventName = keyof GlobalEventHandlersEventMap | string;

// @beginner: 声明 ANIMATION_END：保存当前步骤需要读取或更新的数据。
export const ANIMATION_END = "animationend";
// @beginner: 声明 ANIMATION_ITERATION：保存当前步骤需要读取或更新的数据。
export const ANIMATION_ITERATION = "animationiteration";
// @beginner: 声明 ANIMATION_START：保存当前步骤需要读取或更新的数据。
export const ANIMATION_START = "animationstart";
// @beginner: 声明 TRANSITION_RUN：保存当前步骤需要读取或更新的数据。
export const TRANSITION_RUN = "transitionrun";
// @beginner: 声明 TRANSITION_START：保存当前步骤需要读取或更新的数据。
export const TRANSITION_START = "transitionstart";
// @beginner: 声明 TRANSITION_CANCEL：保存当前步骤需要读取或更新的数据。
export const TRANSITION_CANCEL = "transitioncancel";
// @beginner: 声明 TRANSITION_END：保存当前步骤需要读取或更新的数据。
export const TRANSITION_END = "transitionend";
