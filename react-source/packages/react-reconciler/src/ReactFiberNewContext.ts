/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { objectIs } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ContextDependency, Dependencies, Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostTransitionContext, isPrimaryRenderer } from "./ReactFiberConfig.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ContextProvider } from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DidPropagateContext, NeedsPropagation, NoFlags } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isSubsetOfLanes, mergeLanes, NoLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getHostTransitionProvider } from "./ReactFiberHostContext.js";

// @beginner: 声明 valueCursor：保存当前步骤需要读取或更新的数据。
const valueCursor: StackCursor<unknown> = createCursor(null);
// @beginner: 声明 currentlyRenderingFiber：保存当前步骤需要读取或更新的数据。
let currentlyRenderingFiber: Fiber | null = null;
// @beginner: 声明 lastContextDependency：保存当前步骤需要读取或更新的数据。
let lastContextDependency: ContextDependency | null = null;

// @beginner: 进入 resetContextDependencies：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetContextDependencies(): void {
  currentlyRenderingFiber = null;
  lastContextDependency = null;
}

// @beginner: 进入 prepareToReadContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function prepareToReadContext(workInProgress: Fiber, _renderLanes: Lanes): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;

  // @beginner: 声明 dependencies：保存当前步骤需要读取或更新的数据。
  const dependencies = workInProgress.dependencies;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dependencies !== null) {
    dependencies.firstContext = null;
  }
}

// @beginner: 进入 pushProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isPrimaryRenderer) {
    push(valueCursor, context._currentValue, providerFiber);
    context._currentValue = nextValue;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    push(valueCursor, context._currentValue2, providerFiber);
    context._currentValue2 = nextValue;
  }
}

// @beginner: 进入 popProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popProvider(context: ReactContext<unknown>, providerFiber: Fiber): void {
  // @beginner: 声明 currentValue：保存当前步骤需要读取或更新的数据。
  const currentValue = valueCursor.current;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isPrimaryRenderer) {
    context._currentValue = currentValue;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    context._currentValue2 = currentValue;
  }

  pop(valueCursor, providerFiber);
}

// @beginner: 进入 scheduleContextWorkOnParentPath：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function scheduleContextWorkOnParentPath(
  parent: Fiber | null,
  renderLanes: Lanes,
  propagationRoot: Fiber,
): void {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node = parent;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 声明 alternate：保存当前步骤需要读取或更新的数据。
    const alternate = node.alternate;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
      node.childLanes = mergeLanes(node.childLanes, renderLanes);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLanes)) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node === propagationRoot) {
      break;
    }
    node = node.return;
  }
}

// @beginner: 进入 propagateContextChange：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function propagateContextChange<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes,
): void {
  propagateContextChanges(workInProgress, [context], renderLanes, true);
}

// @beginner: 进入 propagateContextChanges：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function propagateContextChanges(
  workInProgress: Fiber,
  contexts: Array<ReactContext<unknown>>,
  renderLanes: Lanes,
  forcePropagateEntireTree: boolean,
): void {
  // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
  let fiber = workInProgress.child;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber !== null) {
    fiber.return = workInProgress;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (fiber !== null) {
    // @beginner: 声明 nextFiber：保存当前步骤需要读取或更新的数据。
    let nextFiber: Fiber | null = fiber.child;
    // @beginner: 声明 dependencies：保存当前步骤需要读取或更新的数据。
    const dependencies = fiber.dependencies;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (dependencies !== null) {
      // @beginner: 声明 dependency：保存当前步骤需要读取或更新的数据。
      let dependency = dependencies.firstContext;
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (dependency !== null) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (contexts.includes(dependency.context)) {
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (fiber.alternate !== null) {
            fiber.alternate.lanes = mergeLanes(fiber.alternate.lanes, renderLanes);
          }
          scheduleContextWorkOnParentPath(fiber.return, renderLanes, workInProgress);
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (!forcePropagateEntireTree) {
            nextFiber = null;
          }
          break;
        }
        dependency = dependency.next;
      }
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nextFiber !== null) {
      nextFiber.return = fiber;
      fiber = nextFiber;
      continue;
    }

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (fiber !== null) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (fiber === workInProgress) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (fiber.sibling !== null) {
        fiber.sibling.return = fiber.return;
        fiber = fiber.sibling;
        break;
      }
      fiber = fiber.return;
    }
  }
}

// @beginner: 进入 lazilyPropagateParentContextChanges：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function lazilyPropagateParentContextChanges(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return propagateParentContextChanges(current, workInProgress, renderLanes, false);
}

// @beginner: 进入 propagateParentContextChangesToDeferredTree：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function propagateParentContextChangesToDeferredTree(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): void {
  propagateParentContextChanges(current, workInProgress, renderLanes, true);
}

// @beginner: 进入 propagateParentContextChanges：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function propagateParentContextChanges(
  _current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
  forcePropagateEntireTree: boolean,
): boolean {
  // @beginner: 声明 contexts：保存当前步骤需要读取或更新的数据。
  let contexts: Array<ReactContext<unknown>> | null = null;
  // @beginner: 声明 parent：保存当前步骤需要读取或更新的数据。
  let parent: Fiber | null = workInProgress;
  // @beginner: 声明 isInsidePropagationBailout：保存当前步骤需要读取或更新的数据。
  let isInsidePropagationBailout = false;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (parent !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!isInsidePropagationBailout) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if ((parent.flags & NeedsPropagation) !== NoFlags) {
        isInsidePropagationBailout = true;
      // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
      } else if ((parent.flags & DidPropagateContext) !== NoFlags) {
        break;
      }
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (parent.tag === ContextProvider) {
      // @beginner: 声明 currentParent：保存当前步骤需要读取或更新的数据。
      const currentParent = parent.alternate;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (currentParent !== null) {
        // @beginner: 声明 oldProps：保存当前步骤需要读取或更新的数据。
        const oldProps = currentParent.memoizedProps;
        // @beginner: 声明 newProps：保存当前步骤需要读取或更新的数据。
        const newProps = parent.pendingProps;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (oldProps !== null && !objectIs(newProps.value, oldProps.value)) {
          // @beginner: 声明 context：保存当前步骤需要读取或更新的数据。
          const context = (parent.type as { _context?: ReactContext<unknown> })._context;
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (context !== undefined) {
            contexts = contexts === null ? [context] : [...contexts, context];
          }
        }
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (parent === getHostTransitionProvider() && parent.alternate !== null) {
      contexts = contexts === null ? [HostTransitionContext] : [...contexts, HostTransitionContext];
    }

    parent = parent.return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (contexts !== null) {
    propagateContextChanges(workInProgress, contexts, renderLanes, forcePropagateEntireTree);
  }

  workInProgress.flags |= DidPropagateContext;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return contexts !== null;
}

// @beginner: 进入 checkIfContextChanged：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkIfContextChanged(currentDependencies: Dependencies): boolean {
  // @beginner: 声明 dependency：保存当前步骤需要读取或更新的数据。
  let dependency = currentDependencies.firstContext;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (dependency !== null) {
    // @beginner: 声明 context：保存当前步骤需要读取或更新的数据。
    const context = dependency.context;
    // @beginner: 声明 newValue：保存当前步骤需要读取或更新的数据。
    const newValue = isPrimaryRenderer ? context._currentValue : context._currentValue2;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!objectIs(newValue, dependency.memoizedValue)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    }
    dependency = dependency.next;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 readContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function readContext<T>(context: ReactContext<T>): T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return readContextForConsumer(currentlyRenderingFiber, context);
}

// @beginner: 进入 readContextDuringReconciliation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function readContextDuringReconciliation<T>(
  consumer: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes,
): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentlyRenderingFiber === null) {
    prepareToReadContext(consumer, renderLanes);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return readContextForConsumer(consumer, context);
}

// @beginner: 进入 readContextForConsumer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function readContextForConsumer<T>(consumer: Fiber | null, context: ReactContext<T>): T {
  // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
  const value = isPrimaryRenderer ? context._currentValue : context._currentValue2;
  // @beginner: 声明 contextItem：保存当前步骤需要读取或更新的数据。
  const contextItem: ContextDependency<T> = {
    context,
    memoizedValue: value,
    next: null,
  };

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lastContextDependency === null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (consumer === null) {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error("Context can only be read while React is rendering.");
    }

    lastContextDependency = contextItem;
    consumer.dependencies = {
      lanes: NoLanes,
      firstContext: contextItem,
    };
    consumer.flags |= NeedsPropagation;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    lastContextDependency = lastContextDependency.next = contextItem;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value;
}
