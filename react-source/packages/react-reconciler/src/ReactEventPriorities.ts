/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DefaultLane, SyncLane, type Lane } from "./ReactFiberLane.js";

// @beginner: 定义 EventPriority：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type EventPriority = Lane;

// @beginner: 声明 DiscreteEventPriority：保存当前步骤需要读取或更新的数据。
export const DiscreteEventPriority = SyncLane;
// @beginner: 声明 ContinuousEventPriority：保存当前步骤需要读取或更新的数据。
export const ContinuousEventPriority = DefaultLane;
// @beginner: 声明 DefaultEventPriority：保存当前步骤需要读取或更新的数据。
export const DefaultEventPriority = DefaultLane;
// @beginner: 声明 IdleEventPriority：保存当前步骤需要读取或更新的数据。
export const IdleEventPriority = 0b0100;

// @beginner: 声明 currentUpdatePriority：保存当前步骤需要读取或更新的数据。
let currentUpdatePriority: EventPriority = DefaultEventPriority;

// @beginner: 进入 getCurrentUpdatePriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getCurrentUpdatePriority(): EventPriority {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentUpdatePriority;
}

// @beginner: 进入 setCurrentUpdatePriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setCurrentUpdatePriority(newPriority: EventPriority): void {
  currentUpdatePriority = newPriority;
}

// @beginner: 进入 higherEventPriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function higherEventPriority(a: EventPriority, b: EventPriority): EventPriority {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return a !== 0 && a < b ? a : b;
}

// @beginner: 进入 lanesToEventPriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function lanesToEventPriority(lanes: Lane): EventPriority {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return lanes & SyncLane ? DiscreteEventPriority : DefaultEventPriority;
}
