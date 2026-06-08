/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 isInsideEventHandler：保存当前步骤需要读取或更新的数据。
let isInsideEventHandler = false;

// @beginner: 进入 batchedUpdates：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function batchedUpdates<T>(fn: () => T): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isInsideEventHandler) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fn();
  }

  isInsideEventHandler = true;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fn();
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    isInsideEventHandler = false;
  }
}

// @beginner: 进入 discreteUpdates：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function discreteUpdates<T>(fn: () => T): T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return batchedUpdates(fn);
}
