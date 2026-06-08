/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { requestPostPaintCallback } from "./ReactFiberConfig.js";

// @beginner: 声明 postPaintCallbackScheduled：保存当前步骤需要读取或更新的数据。
let postPaintCallbackScheduled = false;
// @beginner: 声明 callbacks：保存当前步骤需要读取或更新的数据。
let callbacks: Array<(endTime: number) => void> = [];

// @beginner: 进入 schedulePostPaintCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function schedulePostPaintCallback(callback: (endTime: number) => void): void {
  callbacks.push(callback);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (postPaintCallbackScheduled) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  postPaintCallbackScheduled = true;
  requestPostPaintCallback((endTime) => {
    // @beginner: 声明 pendingCallbacks：保存当前步骤需要读取或更新的数据。
    const pendingCallbacks = callbacks;
    callbacks = [];
    postPaintCallbackScheduled = false;
    // 官方在 paint 后批量 flush；这里保留“同一帧只调度一次”的合并语义。
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const pendingCallback of pendingCallbacks) {
      pendingCallback(endTime);
    }
  });
}
