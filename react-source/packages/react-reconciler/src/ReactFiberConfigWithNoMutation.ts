/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 shim：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shim(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error(
    "The current renderer does not support mutation. This error is likely caused by a bug in React.",
  );
}

// @beginner: 声明 supportsMutation：保存当前步骤需要读取或更新的数据。
export const supportsMutation = false;
// @beginner: 声明 cloneMutableInstance：保存当前步骤需要读取或更新的数据。
export const cloneMutableInstance = shim;
// @beginner: 声明 cloneMutableTextInstance：保存当前步骤需要读取或更新的数据。
export const cloneMutableTextInstance = shim;
// @beginner: 声明 appendChild：保存当前步骤需要读取或更新的数据。
export const appendChild = shim;
// @beginner: 声明 appendChildToContainer：保存当前步骤需要读取或更新的数据。
export const appendChildToContainer = shim;
// @beginner: 声明 commitTextUpdate：保存当前步骤需要读取或更新的数据。
export const commitTextUpdate = shim;
// @beginner: 声明 commitMount：保存当前步骤需要读取或更新的数据。
export const commitMount = shim;
// @beginner: 声明 commitUpdate：保存当前步骤需要读取或更新的数据。
export const commitUpdate = shim;
// @beginner: 声明 insertBefore：保存当前步骤需要读取或更新的数据。
export const insertBefore = shim;
// @beginner: 声明 insertInContainerBefore：保存当前步骤需要读取或更新的数据。
export const insertInContainerBefore = shim;
// @beginner: 声明 removeChild：保存当前步骤需要读取或更新的数据。
export const removeChild = shim;
// @beginner: 声明 removeChildFromContainer：保存当前步骤需要读取或更新的数据。
export const removeChildFromContainer = shim;
// @beginner: 声明 resetTextContent：保存当前步骤需要读取或更新的数据。
export const resetTextContent = shim;
// @beginner: 声明 hideInstance：保存当前步骤需要读取或更新的数据。
export const hideInstance = shim;
// @beginner: 声明 hideTextInstance：保存当前步骤需要读取或更新的数据。
export const hideTextInstance = shim;
// @beginner: 声明 unhideInstance：保存当前步骤需要读取或更新的数据。
export const unhideInstance = shim;
// @beginner: 声明 unhideTextInstance：保存当前步骤需要读取或更新的数据。
export const unhideTextInstance = shim;
// @beginner: 声明 clearContainer：保存当前步骤需要读取或更新的数据。
export const clearContainer = shim;

// @beginner: 定义 GestureTimeline：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type GestureTimeline = unknown;
// @beginner: 声明 getCurrentGestureOffset：保存当前步骤需要读取或更新的数据。
export const getCurrentGestureOffset = shim;
