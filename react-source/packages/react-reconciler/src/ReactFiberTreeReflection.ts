/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostComponent, HostRoot, HostText, OffscreenComponent } from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";

// @beginner: 进入 getRootForUpdatedFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = sourceFiber;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node.return !== null) {
    node = node.return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node.tag !== HostRoot || node.stateNode === null) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Unable to find root from updated Fiber.");
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return node.stateNode as FiberRoot;
}

// @beginner: 进入 findFirstHostSibling：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findFirstHostSibling(fiber: Fiber | null): Fiber | null {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = fiber;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === HostComponent || node.tag === HostText) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return node;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!(node.tag === OffscreenComponent && node.memoizedState !== null) && node.child !== null) {
      // @beginner: 声明 child：保存当前步骤需要读取或更新的数据。
      const child = findFirstHostSibling(node.child);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (child !== null) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return child;
      }
    }

    node = node.sibling;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 getNextSiblingHostFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getNextSiblingHostFiber(fiber: Fiber): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return findFirstHostSibling(fiber.sibling);
}
