/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";

// @beginner: 进入 describeFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeFiber(fiber: Fiber): string {
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = getComponentNameFromFiber(fiber);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return name === null ? "" : `\n    at ${name}`;
}

// @beginner: 进入 getStackByFiberInDevAndProd：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getStackByFiberInDevAndProd(workInProgress: Fiber): string {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 info：保存当前步骤需要读取或更新的数据。
    let info = "";
    // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
    let node: Fiber | null = workInProgress;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (node !== null) {
      info += describeFiber(node);
      node = node.return;
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return info;
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    // @beginner: 声明 message：保存当前步骤需要读取或更新的数据。
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return `\nError generating stack: ${message}`;
  }
}

// @beginner: 进入 getOwnerStackByFiberInDev：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getOwnerStackByFiberInDev(workInProgress: Fiber): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getStackByFiberInDevAndProd(workInProgress);
}
