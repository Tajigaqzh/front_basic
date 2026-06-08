/**
 * @beginner-module: 源码导读
 * 本文件负责 commit 阶段：把 Fiber flags 翻译成真实 DOM 操作和 effect 处理。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  hideDehydratedBoundary,
  hideInstance,
  hideTextInstance,
  unhideDehydratedBoundary,
  unhideInstance,
  unhideTextInstance,
  updateProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { updateFiberProps } from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ChildDeletion, MutationMask, Placement, Update } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ClassComponent,
  DehydratedFragment,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  commitHookLayoutEffects,
  commitHookLayoutUnmountEffects,
  commitHookPassiveMountEffects,
  commitHookPassiveUnmountEffects,
} from "./ReactFiberCommitEffects.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { commitUpdateQueue, type UpdateQueue } from "./ReactFiberClassUpdateQueue.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { resolveRetryWakeable } from "./ReactFiberWorkLoop.js";

// @beginner: 进入 commitMutationEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber): void {
  // commit 阶段是真正改 DOM 的阶段。
  // render 阶段只在 Fiber 上打 flags；这里遍历 flags，把它们翻译成 DOM 操作。
  recursivelyTraverseMutationEffects(root, finishedWork);
}

// @beginner: 进入 recursivelyTraverseMutationEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function recursivelyTraverseMutationEffects(root: FiberRoot, parentFiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (parentFiber.flags & ChildDeletion) {
    // 删除要优先处理，因为被删子树不一定还会被普通遍历访问到。
    commitChildDeletionEffects(root, parentFiber);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!(parentFiber.tag === OffscreenComponent && parentFiber.memoizedState !== null)) {
    // hidden Offscreen 子树不提交可见 DOM mutation。
    // @beginner: child 用来遍历当前 Fiber 的子树，寻找带 mutation flags 的节点。
    let child = parentFiber.child;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (child !== null) {
      // subtreeFlags 是 completeWork 汇总出来的加速信息，没有 mutation 就跳过整棵子树。
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if ((child.subtreeFlags & MutationMask) !== 0 || (child.flags & MutationMask) !== 0) {
        recursivelyTraverseMutationEffects(root, child);
      }
      child = child.sibling;
    }
  }

  commitReconciliationEffects(parentFiber);
}

// @beginner: 进入 commitReconciliationEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitReconciliationEffects(finishedWork: Fiber): void {
  // 当前 Fiber 自己的 flags 在这里处理。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.flags & ChildDeletion) {
    commitChildDeletionEffects(null, finishedWork);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.flags & Placement) {
    // Placement 表示新插入的 host node。非 host Fiber 会在其子树里找到真实 DOM。
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
      commitPlacement(finishedWork);
    }
    finishedWork.flags &= ~Placement;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.flags & Update) {
    // Update 对 DOM 来说就是 patch props 或更新文本内容。
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.tag === ClassComponent && finishedWork.updateQueue !== null) {
    commitUpdateQueue(
      finishedWork,
      finishedWork.updateQueue as UpdateQueue<unknown>,
      finishedWork.stateNode,
    );
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.tag === SuspenseComponent && finishedWork.updateQueue !== null) {
    attachSuspenseRetryListeners(finishedWork, finishedWork.updateQueue as RetryQueue);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.tag === OffscreenComponent) {
    commitOffscreenVisibility(finishedWork);
  }

  commitHookLayoutEffects(finishedWork);
  commitHookPassiveMountEffects(finishedWork);
}

// @beginner: 进入 commitOffscreenVisibility：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitOffscreenVisibility(finishedWork: Fiber): void {
  // @beginner: wasHidden 表示 Offscreen 上一次提交后是否隐藏。
  const wasHidden = finishedWork.alternate?.memoizedState !== null;
  // @beginner: isHidden 表示 Offscreen 本次提交后是否隐藏。
  const isHidden = finishedWork.memoizedState !== null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (wasHidden === isHidden) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isHidden) {
    hideOrUnhideAllChildren(finishedWork, true);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    hideOrUnhideAllChildren(finishedWork, false);
  }
}

// @beginner: 进入 hideOrUnhideAllChildren：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hideOrUnhideAllChildren(fiber: Fiber, isHidden: boolean): void {
  // @beginner: child 用来遍历 Offscreen 子树中的 host 节点。
  let child = fiber.child;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    hideOrUnhideAllChildrenOnFiber(child, isHidden);
    child = child.sibling;
  }
}

// @beginner: 进入 hideOrUnhideAllChildrenOnFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hideOrUnhideAllChildrenOnFiber(fiber: Fiber, isHidden: boolean): void {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (fiber.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent: {
      // @beginner: instance 是需要隐藏或恢复显示的真实 DOM Element。
      const instance = fiber.stateNode as Element | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (instance !== null) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (!isHidden) {
          ensureHostNodeMounted(fiber, instance);
          unhideInstance(instance, fiber.pendingProps);
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          hideInstance(instance);
        }
      }
      hideOrUnhideNearestPortals(fiber, isHidden);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostText: {
      // @beginner: instance 是需要清空或恢复内容的真实 Text 节点。
      const instance = fiber.stateNode as Text | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (instance !== null) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (!isHidden) {
          ensureHostNodeMounted(fiber, instance);
          unhideTextInstance(instance, String(fiber.pendingProps.text ?? ""));
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          hideTextInstance(instance);
        }
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case DehydratedFragment: {
      // @beginner: instance 是 hydration Suspense 边界的注释节点。
      const instance = fiber.stateNode as Comment | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (instance !== null) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (isHidden) {
          hideDehydratedBoundary(instance);
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          unhideDehydratedBoundary(instance);
        }
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      hideOrUnhideAllChildren(fiber, isHidden);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case OffscreenComponent:
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (fiber.memoizedState !== null) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }
      hideOrUnhideAllChildren(fiber, isHidden);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      hideOrUnhideAllChildren(fiber, isHidden);
  }
}

// @beginner: 进入 hideOrUnhideNearestPortals：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hideOrUnhideNearestPortals(parentFiber: Fiber, isHidden: boolean): void {
  // @beginner: child 用来寻找最近一层 Portal 子树并切换它的可见性。
  let child = parentFiber.child;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (child.tag === HostPortal) {
      hideOrUnhideAllChildren(child, isHidden);
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (child.tag === OffscreenComponent) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (child.memoizedState === null) {
        hideOrUnhideNearestPortals(child, isHidden);
      }
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      hideOrUnhideNearestPortals(child, isHidden);
    }
    child = child.sibling;
  }
}

// @beginner: 进入 ensureHostNodeMounted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function ensureHostNodeMounted(fiber: Fiber, node: Node): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node.parentNode !== null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: parent 是当前 host 节点应该挂载到的宿主父 Fiber。
  const parent = getHostParentFiber(fiber);
  // @beginner: parentNode 是真实 DOM 父节点或 portal/root 容器。
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);
  parentNode.appendChild(node);
}

// @beginner: 进入 attachSuspenseRetryListeners：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function attachSuspenseRetryListeners(finishedWork: Fiber, wakeables: RetryQueue): void {
  // @beginner: retryCache 记录已经为该 Suspense Fiber 注册过 retry 的 wakeable。
  let retryCache = finishedWork.suspenseRetryCache;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (retryCache === undefined) {
    retryCache = finishedWork.suspenseRetryCache = new WeakSet();
  }

  wakeables.forEach((wakeable) => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (retryCache.has(wakeable)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    retryCache.add(wakeable);
    // Suspense commit 阶段保存的 retryQueue 会在 wakeable settle 后重新调度边界。
    // WeakSet 与官方 retry cache 目的相同：同一 thenable 多次 commit 时只注册一次 listener。
    // @beginner: 定义 retry：wakeable resolve 后调用它，让 Suspense 边界重新尝试渲染。
    const retry = () => resolveRetryWakeable(finishedWork, wakeable);
    wakeable.then(retry, retry);
  });
}

// @beginner: 进入 commitChildDeletionEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitChildDeletionEffects(root: FiberRoot | null, parentFiber: Fiber): void {
  // deletions 挂在父 Fiber 上，因为删除时需要知道宿主父节点。
  // @beginner: deletions 是父 Fiber 上记录的待删除子 Fiber 列表。
  const deletions = parentFiber.deletions ?? [];
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const childToDelete of deletions) {
    commitDeletionEffects(root, parentFiber, childToDelete);
  }
  parentFiber.deletions = null;
  parentFiber.flags &= ~ChildDeletion;
}

// @beginner: 进入 commitPlacement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitPlacement(finishedWork: Fiber): void {
  // 插入前先向上找到最近的宿主父节点：
  // HostRoot -> containerInfo，HostPortal -> portal container，HostComponent -> DOM Element。
  // @beginner: parent 是 Placement 节点要插入到的最近宿主父 Fiber。
  const parent = getHostParentFiber(finishedWork);
  // @beginner: parentNode 是真实插入操作的 DOM 父节点。
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);
  // 复刻版简化为 appendChild；完整 React 还会寻找稳定 host sibling 做 insertBefore。
  // @beginner: node 是当前 Fiber 子树中第一个真实 DOM 节点。
  const node = getHostSiblingOrSelf(finishedWork);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node !== null) {
    parentNode.appendChild(node);
  }
}

// @beginner: 进入 commitUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitUpdate(finishedWork: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.tag === HostComponent && finishedWork.stateNode instanceof Element) {
    // DOM 元素更新：把旧 props 和新 props 交给 DOM bindings 做属性、事件、style diff。
    updateProperties(
      finishedWork.stateNode,
      String(finishedWork.type),
      finishedWork.alternate?.memoizedProps ?? {},
      finishedWork.pendingProps,
    );
    updateFiberProps(finishedWork.stateNode, finishedWork.pendingProps);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finishedWork.tag === HostText && finishedWork.stateNode instanceof Text) {
    // 文本更新直接写 nodeValue。
    // @beginner: nextText 是文本 Fiber 本次应该显示的字符串。
    const nextText = String(finishedWork.pendingProps.text ?? "");
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (finishedWork.stateNode.nodeValue !== nextText) {
      finishedWork.stateNode.nodeValue = nextText;
    }
  }
}

// @beginner: 进入 commitDeletionEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitDeletionEffects(_root: FiberRoot | null, nearestMountedAncestor: Fiber, deletedFiber: Fiber): void {
  // 删除时从最近仍挂载的祖先找宿主父节点，再递归删除子树里的真实 DOM。
  // @beginner: parent 是删除操作开始时仍挂载在树上的宿主父 Fiber。
  const parent = getHostParentFiber(nearestMountedAncestor);
  // @beginner: parentNode 是执行 removeChild 的真实 DOM 父节点。
  const parentNode =
    parent.tag === HostRoot
      ? (parent.stateNode as FiberRoot).containerInfo
      : parent.tag === HostPortal
        ? (parent.stateNode as { containerInfo: Node }).containerInfo
      : (parent.stateNode as Node);

  recursivelyDeleteHostNodes(parentNode, deletedFiber);
}

// @beginner: 进入 recursivelyDeleteHostNodes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function recursivelyDeleteHostNodes(parentNode: Node, fiber: Fiber): void {
  // 删除子树前先执行 effect cleanup，避免 DOM 已删除后副作用还引用旧节点。
  commitHookLayoutUnmountEffects(fiber);
  commitHookPassiveUnmountEffects(fiber);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === HostPortal) {
    // @beginner: portalContainer 是 Portal 子树自己的 DOM 容器。
    const portalContainer = (fiber.stateNode as { containerInfo: Node }).containerInfo;
    // @beginner: child 用来递归删除 Portal 容器中的真实 DOM 子节点。
    let child = fiber.child;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (child !== null) {
      recursivelyDeleteHostNodes(portalContainer, child);
      child = child.sibling;
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === HostComponent || fiber.tag === HostText) {
    // 找到真实 DOM 后删除；删除到 host 节点即可，不需要继续遍历它的子 DOM。
    // @beginner: node 是要从 DOM 中移除的真实 HostComponent/HostText 节点。
    const node = fiber.stateNode as Node | null;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node !== null) {
      // @beginner: actualParent 是 node 当前真实挂载的 DOM 父节点。
      const actualParent = node.parentNode;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (actualParent !== null) {
        actualParent.removeChild(node);
      // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
      } else if (parentNode.contains?.(node)) {
        parentNode.removeChild(node);
      }
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: child 用来继续向下寻找需要删除的真实 DOM 后代。
  let child = fiber.child;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    recursivelyDeleteHostNodes(parentNode, child);
    child = child.sibling;
  }
}

// @beginner: 进入 getHostParentFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getHostParentFiber(fiber: Fiber): Fiber {
  // Fiber 树里有很多非 DOM 节点：函数组件、Fragment、Context 等。
  // commit DOM 操作需要向上跳过这些节点，找到最近的 HostRoot/HostPortal/HostComponent。
  // @beginner: parent 沿 return 指针向上查找最近宿主父节点。
  let parent = fiber.return;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (parent !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (parent.tag === HostComponent || parent.tag === HostRoot || parent.tag === HostPortal) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return parent;
    }
    parent = parent.return;
  }

  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Expected to find a host parent.");
}

// @beginner: 进入 getHostSiblingOrSelf：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getHostSiblingOrSelf(fiber: Fiber): Node | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === OffscreenComponent && fiber.memoizedState !== null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === HostComponent || fiber.tag === HostText) {
    // 当前 Fiber 自己就是真实 DOM。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fiber.stateNode as Node | null;
  }

  // 非 host Fiber 继续向下找第一个真实 DOM 后代。
  // @beginner: child 用来向下查找第一个真实 DOM 后代。
  let child = fiber.child;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    // @beginner: node 是递归查找到的真实 DOM 节点。
    const node = getHostSiblingOrSelf(child);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node !== null) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return node;
    }
    child = child.sibling;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}
