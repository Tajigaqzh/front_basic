/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";

// @beginner: 定义 StackCursor：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface StackCursor<T> {
  current: T;
}

// @beginner: 声明 valueStack：保存当前步骤需要读取或更新的数据。
const valueStack: unknown[] = [];
// @beginner: 声明 fiberStack：保存当前步骤需要读取或更新的数据。
const fiberStack: Array<Fiber | null> = [];
// @beginner: 声明 index：保存当前步骤需要读取或更新的数据。
let index = -1;

// @beginner: 进入 createCursor：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createCursor<T>(defaultValue: T): StackCursor<T> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { current: defaultValue };
}

// @beginner: 进入 push：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index += 1;
  // 先保存旧值，再把 cursor 切到新值；pop 时按相反顺序恢复。
  // 这就是官方 React 在 HostContext、ContextProvider 等地方复用的通用栈模型。
  valueStack[index] = cursor.current;
  fiberStack[index] = fiber;
  cursor.current = value;
}

// @beginner: 进入 pop：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (index < 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiberStack[index] !== fiber) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Unexpected Fiber popped from ReactFiberStack.");
  }

  cursor.current = valueStack[index] as T;
  valueStack[index] = null;
  fiberStack[index] = null;
  index -= 1;
}
