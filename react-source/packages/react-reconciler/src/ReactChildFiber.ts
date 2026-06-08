/**
 * @beginner-module: 源码导读
 * 本文件实现 children 调和：比较新旧子节点，决定复用、插入、更新或删除。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isArray, REACT_PORTAL_TYPE } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isValidElement } from "react";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props, ReactNode } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ChildDeletion, Placement, Update } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createFiberFromElement, createFiberFromPortal, createFiberFromText, createWorkInProgress } from "./ReactFiber.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostPortal, HostText } from "./ReactWorkTags.js";

// @beginner: 进入 reconcileChildFibers：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reconcileChildFibers(returnFiber: Fiber, currentFirstChild: Fiber | null, newChild: ReactNode): Fiber | null {
  // 调和 children 的目标：把“本次 render 返回的 ReactNode”变成“新的 Fiber 子链表”。
  // 同时对比旧 Fiber 子链表，决定哪些节点复用、插入、删除或更新。
  // @beginner: newChildren 是规范化后的新子节点数组，方便统一按顺序 diff。
  const newChildren = normalizeChildren(newChild);
  // oldFiber 指向旧子链表当前节点。
  // @beginner: oldFiber 指向旧子链表中当前正在比较的位置。
  let oldFiber = currentFirstChild;
  // previousNewFiber 用来把新 Fiber 串成 sibling 链表。
  // @beginner: previousNewFiber 是新链表的尾节点，用来串 sibling。
  let previousNewFiber: Fiber | null = null;
  // @beginner: resultingFirstChild 保存新链表的头节点，最后赋给父 Fiber.child。
  let resultingFirstChild: Fiber | null = null;

  // @beginner: 逐个比较新 children 和旧 Fiber；复刻版采用顺序 diff。
  for (let newIndex = 0; newIndex < newChildren.length; newIndex += 1) {
    // @beginner: child 是当前位置的新 ReactNode。
    const child = newChildren[newIndex];
    // 复刻版采用“同层顺序对比”：新旧当前位置 type/key 相同就复用，否则创建新 Fiber。
    // 完整 React 还会用 key map 处理移动节点，这里保留最容易理解的主干。
    // @beginner: same 表示旧 Fiber 和新 child 是否可复用。
    const same = oldFiber !== null && sameType(oldFiber, child);
    // @beginner: newFiber 是本轮为 child 准备的新工作节点，可能复用旧 Fiber。
    let newFiber: Fiber | null = null;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (same && oldFiber !== null) {
      // 复用旧 Fiber 的 alternate/stateNode/memoizedState，只更新 pendingProps。
      newFiber = createWorkInProgress(oldFiber, propsFromChild(child));
      // 标记 Update，commit 阶段会对真实 DOM 做属性或文本更新。
      newFiber.flags |= Update;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (child !== null) {
        // 新 child 没有可复用旧 Fiber，创建全新 Fiber，并标记 Placement。
        newFiber = createFiberFromNode(child);
        newFiber.flags |= Placement;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (oldFiber !== null) {
        // 当前位置旧 Fiber 不能复用，需要把它挂到父 Fiber.deletions。
        deleteChild(returnFiber, oldFiber);
      }
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (oldFiber !== null) {
      // 旧链表指针后移，继续和下一个新 child 对比。
      oldFiber = oldFiber.sibling;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (newFiber === null) {
      continue;
    }

    newFiber.return = returnFiber;
    newFiber.index = newIndex;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (previousNewFiber === null) {
      // 第一个新 Fiber 成为父 Fiber.child。
      resultingFirstChild = newFiber;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // 后续新 Fiber 挂到前一个 sibling。
      previousNewFiber.sibling = newFiber;
    }

    previousNewFiber = newFiber;
  }

  // @beginner: 新 children 已结束后，旧链表剩余节点全部进入删除列表。
  while (oldFiber !== null) {
    // 新 children 已经遍历完，旧链表还剩的节点都需要删除。
    deleteChild(returnFiber, oldFiber);
    oldFiber = oldFiber.sibling;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resultingFirstChild;
}

// @beginner: 进入 mountChildFibers：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function mountChildFibers(returnFiber: Fiber, newChild: ReactNode): Fiber | null {
  // @beginner: mounted 是 mount 阶段生成的新子 Fiber 链表。
  const mounted = reconcileChildFibers(returnFiber, null, newChild);
  // @beginner: node 用来遍历新链表，为每个新节点补 Placement 标记。
  let node = mounted;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    node.flags |= Placement;
    node = node.sibling;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return mounted;
}

// @beginner: 进入 cloneChildFibers：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function cloneChildFibers(current: Fiber | null, workInProgress: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null && workInProgress.child !== current.child) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Resuming work is not implemented in this TypeScript source recreation.");
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgress.child === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // 官方 bailout 路径会复用 current.child 指针；一旦发现子树仍有工作，
  // 这里才逐个 clone 成 workInProgress child，避免直接修改已提交树。
  // @beginner: currentChild 从当前 child 开始，逐个克隆旧子 Fiber。
  let currentChild = workInProgress.child;
  // @beginner: newChild 是克隆出来的 workInProgress 子 Fiber。
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;
  newChild.return = workInProgress;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
    newChild.return = workInProgress;
  }

  newChild.sibling = null;
}

// @beginner: 进入 deleteChild：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
  // 删除不直接改 DOM，只给父 Fiber 打 ChildDeletion。
  // commit 阶段会读取 deletions，递归找到真实 DOM 后 removeChild。
  returnFiber.flags |= ChildDeletion;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (returnFiber.deletions === null) {
    returnFiber.deletions = [childToDelete];
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    returnFiber.deletions.push(childToDelete);
  }
}

// @beginner: 进入 createFiberFromNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createFiberFromNode(child: NonNullable<ReactNode>): Fiber {
  // ReactNode 有三大主形态：ReactElement、Portal、文本。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isValidElement(child)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return createFiberFromElement(child);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isPortal(child)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return createFiberFromPortal(child);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return createFiberFromText(child as string | number);
}

// @beginner: 进入 sameType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function sameType(oldFiber: Fiber, child: NonNullable<ReactNode>): boolean {
  // 只有 key 和 type 都相同，才认为旧 Fiber 可以复用。
  // 这就是列表里 key 的意义：帮助 React 在同一层识别“这是同一个孩子”。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isValidElement(child)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return oldFiber.key === child.key && oldFiber.elementType === child.type;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isPortal(child)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return (
      oldFiber.tag === HostPortal &&
      oldFiber.key === child.key &&
      (oldFiber.stateNode as { containerInfo?: unknown } | null)?.containerInfo === child.containerInfo
    );
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return oldFiber.tag === HostText && (typeof child === "string" || typeof child === "number");
}

// @beginner: 进入 propsFromChild：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function propsFromChild(child: NonNullable<ReactNode>): Props {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isValidElement(child)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return child.props;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { text: String(child) };
}

// @beginner: 进入 isPortal：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isPortal(value: unknown): value is Extract<NonNullable<ReactNode>, { containerInfo: unknown }> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $$typeof?: symbol }).$$typeof === REACT_PORTAL_TYPE
  );
}

// @beginner: 进入 normalizeChildren：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function normalizeChildren(children: ReactNode): NonNullable<ReactNode>[] {
  // 为了让主循环简单，先把单个 child、数组 child、空值统一整理成扁平数组。
  // @beginner: result 收集扁平化后的可渲染 children。
  const result: NonNullable<ReactNode>[] = [];
  appendChild(result, children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return result;
}

// @beginner: 进入 appendChild：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function appendChild(result: NonNullable<ReactNode>[], child: ReactNode): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isArray(child)) {
    // React children 可以嵌套数组；这里递归扁平化。
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const item of child) {
      appendChild(result, item);
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (child === null || child === undefined || child === false || child === true) {
    // null/undefined/boolean 在 React 中代表“不渲染任何节点”。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  result.push(child);
}
