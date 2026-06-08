/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import objectIs from "./objectIs.js";

export default function shallowEqual(objA: unknown, objB: unknown): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (objectIs(objA, objB)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isObject(objA) || !isObject(objB)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 keysA：保存当前步骤需要读取或更新的数据。
  const keysA = Object.keys(objA);
  // @beginner: 声明 keysB：保存当前步骤需要读取或更新的数据。
  const keysB = Object.keys(objB);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (keysA.length !== keysB.length) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const key of keysA) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !objectIs(objA[key], objB[key])) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 isObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isObject(value: unknown): value is Record<string, unknown> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof value === "object" && value !== null;
}
