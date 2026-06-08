/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactNode } from "shared";

// @beginner: 进入 forEach：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function forEach(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => void,
): void {
  mapChildren(children, (child, index) => {
    fn(child, index);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  });
}

// @beginner: 进入 map：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function map<T>(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => T,
): T[] | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return mapChildren(children, fn);
}

// @beginner: 进入 count：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function count(children: ReactNode): number {
  // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
  let result = 0;
  forEach(children, () => {
    result += 1;
  });
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return result;
}

// @beginner: 进入 toArray：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function toArray(children: ReactNode): ReactNode[] {
  // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
  const result: ReactNode[] = [];
  forEach(children, (child) => result.push(child));
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return result;
}

// @beginner: 进入 only：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function only(children: ReactNode): ReactNode {
  // @beginner: 声明 array：保存当前步骤需要读取或更新的数据。
  const array = toArray(children);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (array.length !== 1) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("React.Children.only expected to receive a single React element child.");
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return array[0];
}

// @beginner: 进入 mapChildren：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mapChildren<T>(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => T,
): T[] | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (children === null || children === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 声明 result：保存当前步骤需要读取或更新的数据。
  const result: T[] = [];
  // @beginner: 声明 index：保存当前步骤需要读取或更新的数据。
  let index = 0;
  traverse(children, (child) => {
    result.push(fn(child, index++));
  });
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return result;
}

// @beginner: 进入 traverse：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function traverse(children: ReactNode, visit: (child: ReactNode) => void): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (Array.isArray(children)) {
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const child of children) {
      traverse(child, visit);
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (children === null || children === undefined || typeof children === "boolean") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  visit(children);
}
