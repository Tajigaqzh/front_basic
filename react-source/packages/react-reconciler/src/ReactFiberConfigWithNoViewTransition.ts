/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 shim：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shim(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error(
    "The current renderer does not support view transitions. This error is likely caused by a bug in React.",
  );
}

// @beginner: 声明 applyViewTransitionName：保存当前步骤需要读取或更新的数据。
export const applyViewTransitionName = shim;
// @beginner: 声明 restoreViewTransitionName：保存当前步骤需要读取或更新的数据。
export const restoreViewTransitionName = shim;
// @beginner: 声明 cancelViewTransitionName：保存当前步骤需要读取或更新的数据。
export const cancelViewTransitionName = shim;
// @beginner: 声明 cancelRootViewTransitionName：保存当前步骤需要读取或更新的数据。
export const cancelRootViewTransitionName = shim;
// @beginner: 声明 restoreRootViewTransitionName：保存当前步骤需要读取或更新的数据。
export const restoreRootViewTransitionName = shim;
// @beginner: 声明 cloneRootViewTransitionContainer：保存当前步骤需要读取或更新的数据。
export const cloneRootViewTransitionContainer = shim;
// @beginner: 声明 removeRootViewTransitionClone：保存当前步骤需要读取或更新的数据。
export const removeRootViewTransitionClone = shim;

// @beginner: 定义 InstanceMeasurement：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type InstanceMeasurement = unknown;
// @beginner: 声明 measureInstance：保存当前步骤需要读取或更新的数据。
export const measureInstance = shim;
// @beginner: 声明 measureClonedInstance：保存当前步骤需要读取或更新的数据。
export const measureClonedInstance = shim;
// @beginner: 声明 wasInstanceInViewport：保存当前步骤需要读取或更新的数据。
export const wasInstanceInViewport = shim;
// @beginner: 声明 hasInstanceChanged：保存当前步骤需要读取或更新的数据。
export const hasInstanceChanged = shim;
// @beginner: 声明 hasInstanceAffectedParent：保存当前步骤需要读取或更新的数据。
export const hasInstanceAffectedParent = shim;

// @beginner: 定义 RunningViewTransition：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type RunningViewTransition = unknown;
// @beginner: 声明 startViewTransition：保存当前步骤需要读取或更新的数据。
export const startViewTransition = shim;
// @beginner: 声明 startGestureTransition：保存当前步骤需要读取或更新的数据。
export const startGestureTransition = shim;
// @beginner: 声明 stopViewTransition：保存当前步骤需要读取或更新的数据。
export const stopViewTransition = shim;
// @beginner: 声明 addViewTransitionFinishedListener：保存当前步骤需要读取或更新的数据。
export const addViewTransitionFinishedListener = shim;

// @beginner: 定义 ViewTransitionInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ViewTransitionInstance = unknown;
// @beginner: 声明 createViewTransitionInstance：保存当前步骤需要读取或更新的数据。
export const createViewTransitionInstance = shim;
