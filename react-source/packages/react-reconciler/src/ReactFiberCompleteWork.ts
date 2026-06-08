/**
 * @beginner-module: 源码导读
 * 本文件负责 completeWork，也就是 render 阶段向上回溯、创建 DOM 并汇总 flags。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  createInstance,
  createTextInstance,
  setInitialProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  precacheFiberNode,
  updateFiberProps,
} from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  CacheComponent,
  ContextProvider,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  Mode,
  OffscreenComponent,
  Profiler,
  SuspenseComponent,
} from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popProvider } from "./ReactFiberNewContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popHostContainer, popHostContext } from "./ReactFiberHostContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { mergeLanes, NoLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popCacheProvider, type CacheComponentState } from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popHiddenContext } from "./ReactFiberHiddenContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popSuspenseHandler } from "./ReactFiberSuspenseContext.js";

// @beginner: 进入 completeWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function completeWork(_current: Fiber | null, workInProgress: Fiber): void {
  // completeWork 是 render 阶段的“向上归并”。
  // beginWork 负责创建/复用 child Fiber；completeWork 负责创建真实 DOM、
  // 收集子树 flags/lanes，并把 context 栈弹回父级状态。
  // @beginner: 按 Fiber tag 决定 complete 阶段要创建 DOM、弹出 context，还是只汇总 flags。
  switch (workInProgress.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      // DOM 元素节点，例如 div/button。首次 complete 时创建真实 Element。
      completeHostComponent(workInProgress);
      popHostContext(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostText:
      // 文本节点没有 children，只需要创建/复用 Text。
      completeHostText(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
      // HostRoot 本身没有 DOM 节点，但要汇总整棵树的 flags。
      bubbleProperties(workInProgress);
      popHostContainer(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      bubbleProperties(workInProgress);
      popHostContainer(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextProvider:
      popProvider(
        (workInProgress.type as { _context: Parameters<typeof popProvider>[0] })._context,
        workInProgress,
      );
      bubbleProperties(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case CacheComponent: {
      // @beginner: CacheComponent 的 memoizedState 保存当前 cache 实例。
      const state = workInProgress.memoizedState as CacheComponentState | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (state !== null) {
        popCacheProvider(workInProgress, state.cache);
      }
      bubbleProperties(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case Mode:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case Profiler:
      bubbleProperties(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SuspenseComponent:
      popSuspenseHandler(workInProgress);
      bubbleProperties(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case OffscreenComponent:
      popSuspenseHandler(workInProgress);
      popHiddenContext(workInProgress);
      bubbleProperties(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      bubbleProperties(workInProgress);
  }
}

// @beginner: 进入 completeHostComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function completeHostComponent(workInProgress: Fiber): void {
  // @beginner: stateNode 为空说明是 mount，需要第一次创建真实 DOM。
  if (workInProgress.stateNode === null) {
    // mount：还没有真实 DOM，创建对应标签的 Element。
    // @beginner: instance 是当前 HostComponent 对应的真实 DOM Element。
    const instance = createInstance(String(workInProgress.type));
    // 把 Fiber 和 DOM 互相关联，事件系统可从 DOM 反查 Fiber。
    precacheFiberNode(workInProgress, instance);
    // 保存最新 props，事件委托读取 listener 时会用到。
    updateFiberProps(instance, workInProgress.pendingProps);
    // 应用初始属性、style、事件等。
    setInitialProperties(instance, String(workInProgress.type), workInProgress.pendingProps);
    // 子 Fiber 的 DOM 已经在各自 complete 阶段创建，这里把它们挂到当前 DOM 下。
    appendAllChildren(instance, workInProgress);
    workInProgress.stateNode = instance;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // update：DOM 已经存在，真正的属性 diff 会在 commit 阶段做。
    // 这里只更新事件系统读取的 props 缓存。
    updateFiberProps(workInProgress.stateNode as Node, workInProgress.pendingProps);
  }

  workInProgress.memoizedProps = workInProgress.pendingProps;
  bubbleProperties(workInProgress);
}

// @beginner: 进入 completeHostText：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function completeHostText(workInProgress: Fiber): void {
  // @beginner: 文本 Fiber 首次完成时创建真实 Text 节点。
  if (workInProgress.stateNode === null) {
    // 文本 Fiber 的 pendingProps.text 是最终文本内容。
    workInProgress.stateNode = createTextInstance(String(workInProgress.pendingProps.text ?? ""));
  }

  workInProgress.memoizedProps = workInProgress.pendingProps;
}

// @beginner: 进入 appendAllChildren：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function appendAllChildren(parent: Node, workInProgress: Fiber): void {
  // 从当前 Fiber 的 child 开始 DFS，找到所有 HostComponent/HostText。
  // 函数组件、Fragment 这类非 DOM Fiber 自己没有 stateNode，要继续往下找。
  // @beginner: node 指向正在搜索的子 Fiber，用来找到所有真实 DOM 后代。
  let node = workInProgress.child;

  // @beginner: 手写 DFS 遍历 Fiber 子树，把真实 DOM 子节点 append 到 parent。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.tag === HostPortal) {
      // Portal 子树提交到独立容器，不能在普通宿主父节点创建时 append 进去。
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (node.tag === OffscreenComponent && node.memoizedState !== null) {
      // hidden Offscreen 子树仍完成 Fiber，但不把 host node 挂到当前可见宿主父节点。
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (node.tag === HostComponent || node.tag === HostText) {
      // 找到真实 DOM 子节点，直接挂到 parent。
      parent.appendChild(node.stateNode as Node);
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (node.child !== null) {
      // 非宿主节点继续下钻。
      node.child.return = node;
      node = node.child;
      continue;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node === workInProgress) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (node.sibling === null) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (node.return === null || node.return === workInProgress) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

// @beginner: 进入 bubbleProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function bubbleProperties(completedWork: Fiber): void {
  // 子节点完成后，把子树上的 flags 和 lanes 汇总到父节点。
  // commit 阶段靠 subtreeFlags 快速判断某棵子树是否有 DOM/effect 工作。
  // @beginner: subtreeFlags 汇总所有子 Fiber 的副作用标记。
  let subtreeFlags = 0;
  // @beginner: newChildLanes 汇总子树里还没处理完的更新优先级。
  let newChildLanes = NoLanes;
  // @beginner: child 用来遍历当前 Fiber 的直接子节点链表。
  let child = completedWork.child;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    child.return = completedWork;
    child = child.sibling;
  }

  completedWork.subtreeFlags |= subtreeFlags;
  completedWork.childLanes = newChildLanes;
  completedWork.memoizedProps = completedWork.pendingProps;
}
