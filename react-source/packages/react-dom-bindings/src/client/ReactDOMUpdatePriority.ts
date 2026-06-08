/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DefaultEventPriority, type EventPriority } from "react-reconciler/src/ReactEventPriorities.js";

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

// @beginner: 进入 runWithPriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function runWithPriority<T>(priority: EventPriority, fn: () => T): T {
  // @beginner: 声明 previousPriority：保存当前步骤需要读取或更新的数据。
  const previousPriority = currentUpdatePriority;
  currentUpdatePriority = priority;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fn();
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    currentUpdatePriority = previousPriority;
  }
}
