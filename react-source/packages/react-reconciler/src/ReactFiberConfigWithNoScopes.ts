/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 shim：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shim(): never {
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error(
    "The current renderer does not support React Scopes. This error is likely caused by a bug in React.",
  );
}

// @beginner: 声明 prepareScopeUpdate：保存当前步骤需要读取或更新的数据。
export const prepareScopeUpdate = shim;
// @beginner: 声明 getInstanceFromScope：保存当前步骤需要读取或更新的数据。
export const getInstanceFromScope = shim;
