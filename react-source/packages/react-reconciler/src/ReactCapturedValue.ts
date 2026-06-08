/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getStackByFiberInDevAndProd } from "./ReactFiberComponentStack.js";

// @beginner: 声明 CapturedStacks：保存当前步骤需要读取或更新的数据。
const CapturedStacks: WeakMap<object, CapturedValue<unknown>> = new WeakMap();

// @beginner: 定义 CapturedValue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface CapturedValue<T> {
  value: T;
  source: Fiber | null;
  stack: string | null;
}

// @beginner: 进入 createCapturedValueAtFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createCapturedValueAtFiber<T>(value: T, source: Fiber): CapturedValue<T> {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "object" && value !== null) {
    // @beginner: 声明 existing：保存当前步骤需要读取或更新的数据。
    const existing = CapturedStacks.get(value);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (existing !== undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return existing as CapturedValue<T>;
    }
    // @beginner: 声明 captured：保存当前步骤需要读取或更新的数据。
    const captured: CapturedValue<T> = {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source),
    };
    CapturedStacks.set(value, captured as CapturedValue<unknown>);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return captured;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    value,
    source,
    stack: getStackByFiberInDevAndProd(source),
  };
}

// @beginner: 进入 createCapturedValueFromError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createCapturedValueFromError(value: Error, stack: string | null): CapturedValue<Error> {
  // @beginner: 声明 captured：保存当前步骤需要读取或更新的数据。
  const captured: CapturedValue<Error> = {
    value,
    source: null,
    stack,
  };
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof stack === "string") {
    CapturedStacks.set(value, captured as CapturedValue<unknown>);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return captured;
}
