/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 shim：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shim(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error(
    "The current renderer does not support Resources. This error is likely caused by a bug in React.",
  );
}

// @beginner: 定义 HoistableRoot：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type HoistableRoot = unknown;
// @beginner: 定义 Resource：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Resource = unknown;

// @beginner: 声明 supportsResources：保存当前步骤需要读取或更新的数据。
export const supportsResources = false;
// @beginner: 声明 isHostHoistableType：保存当前步骤需要读取或更新的数据。
export const isHostHoistableType = shim;
// @beginner: 声明 getHoistableRoot：保存当前步骤需要读取或更新的数据。
export const getHoistableRoot = shim;
// @beginner: 声明 getResource：保存当前步骤需要读取或更新的数据。
export const getResource = shim;
// @beginner: 声明 acquireResource：保存当前步骤需要读取或更新的数据。
export const acquireResource = shim;
// @beginner: 声明 releaseResource：保存当前步骤需要读取或更新的数据。
export const releaseResource = shim;
// @beginner: 声明 hydrateHoistable：保存当前步骤需要读取或更新的数据。
export const hydrateHoistable = shim;
// @beginner: 声明 mountHoistable：保存当前步骤需要读取或更新的数据。
export const mountHoistable = shim;
// @beginner: 声明 unmountHoistable：保存当前步骤需要读取或更新的数据。
export const unmountHoistable = shim;
// @beginner: 声明 createHoistableInstance：保存当前步骤需要读取或更新的数据。
export const createHoistableInstance = shim;
// @beginner: 声明 prepareToCommitHoistables：保存当前步骤需要读取或更新的数据。
export const prepareToCommitHoistables = shim;
// @beginner: 声明 mayResourceSuspendCommit：保存当前步骤需要读取或更新的数据。
export const mayResourceSuspendCommit = shim;
// @beginner: 声明 preloadResource：保存当前步骤需要读取或更新的数据。
export const preloadResource = shim;
// @beginner: 声明 suspendResource：保存当前步骤需要读取或更新的数据。
export const suspendResource = shim;
