/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Wakeable } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TreeContext } from "./ReactFiberTreeContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DidCapture, NoFlags } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { SuspenseComponent, SuspenseListComponent } from "./ReactWorkTags.js";

// @beginner: 定义 SuspenseInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SuspenseInstance = Comment;

// @beginner: 定义 SuspenseState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SuspenseState {
  dehydrated: SuspenseInstance | null;
  treeContext: TreeContext | null;
  retryLane: Lane;
  hydrationErrors: Array<unknown> | null;
}

// @beginner: 定义 SuspenseListRenderState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SuspenseListRenderState {
  isBackwards: boolean;
  rendering: Fiber | null;
  renderingStartTime: number;
  last: Fiber | null;
  tail: Fiber | null;
  tailMode: "collapsed" | "hidden" | undefined;
  treeForkCount: number;
}

// @beginner: 定义 RetryQueue：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type RetryQueue = Set<Wakeable>;

// @beginner: 声明 SUSPENSE_PENDING_START_DATA：保存当前步骤需要读取或更新的数据。
const SUSPENSE_PENDING_START_DATA = "$?";
// @beginner: 声明 SUSPENSE_QUEUED_START_DATA：保存当前步骤需要读取或更新的数据。
const SUSPENSE_QUEUED_START_DATA = "$~";
// @beginner: 声明 SUSPENSE_FALLBACK_START_DATA：保存当前步骤需要读取或更新的数据。
const SUSPENSE_FALLBACK_START_DATA = "$!";

// @beginner: 进入 isSuspenseInstancePending：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isSuspenseInstancePending(instance: SuspenseInstance): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return instance.data === SUSPENSE_PENDING_START_DATA || instance.data === SUSPENSE_QUEUED_START_DATA;
}

// @beginner: 进入 isSuspenseInstanceFallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isSuspenseInstanceFallback(instance: SuspenseInstance): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    instance.data === SUSPENSE_FALLBACK_START_DATA ||
    (instance.data === SUSPENSE_PENDING_START_DATA &&
      instance.ownerDocument?.readyState !== "loading")
  );
}

// @beginner: 进入 getSuspenseInstanceFallbackErrorDetails：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSuspenseInstanceFallbackErrorDetails(instance: SuspenseInstance): {
  digest?: string;
  message?: string;
  stack?: string;
  componentStack?: string;
} {
  // @beginner: 声明 dataset：保存当前步骤需要读取或更新的数据。
  const dataset = (instance.nextSibling as HTMLElement | null)?.dataset;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    digest: dataset?.dgst,
    message: dataset?.msg,
    stack: dataset?.stck,
    componentStack: dataset?.cstck,
  };
}

// @beginner: 进入 findFirstSuspended：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function findFirstSuspended(row: Fiber): Fiber | null {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Fiber | null = row;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === SuspenseComponent) {
      // @beginner: 声明 state：保存当前步骤需要读取或更新的数据。
      const state = node.memoizedState as SuspenseState | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (state !== null) {
        // @beginner: 声明 dehydrated：保存当前步骤需要读取或更新的数据。
        const dehydrated = state.dehydrated;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (
          dehydrated === null ||
          isSuspenseInstancePending(dehydrated) ||
          isSuspenseInstanceFallback(dehydrated)
        ) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return node;
        }
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (
      node.tag === SuspenseListComponent &&
      (node.memoizedProps?.revealOrder as string | undefined) !== "independent"
    ) {
      // @beginner: 声明 didSuspend：保存当前步骤需要读取或更新的数据。
      const didSuspend = (node.flags & DidCapture) !== NoFlags;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (didSuspend) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return node;
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node === row) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    }

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (node.sibling === null) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (node.return === null || node.return === row) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return null;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}
