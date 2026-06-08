import {
  createInstance,
  createTextInstance,
  setInitialProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";
import {
  precacheFiberNode,
  updateFiberProps,
} from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
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
import type { Fiber } from "./ReactInternalTypes.js";
import { popProvider } from "./ReactFiberNewContext.js";
import { popHostContainer, popHostContext } from "./ReactFiberHostContext.js";
import { mergeLanes, NoLanes } from "./ReactFiberLane.js";
import { popCacheProvider, type CacheComponentState } from "./ReactFiberCacheComponent.js";
import { popHiddenContext } from "./ReactFiberHiddenContext.js";
import { popSuspenseHandler } from "./ReactFiberSuspenseContext.js";

export function completeWork(_current: Fiber | null, workInProgress: Fiber): void {
  switch (workInProgress.tag) {
    case HostComponent:
      completeHostComponent(workInProgress);
      popHostContext(workInProgress);
      return;
    case HostText:
      completeHostText(workInProgress);
      return;
    case HostRoot:
      bubbleProperties(workInProgress);
      popHostContainer(workInProgress);
      return;
    case HostPortal:
      bubbleProperties(workInProgress);
      popHostContainer(workInProgress);
      return;
    case ContextProvider:
      popProvider(
        (workInProgress.type as { _context: Parameters<typeof popProvider>[0] })._context,
        workInProgress,
      );
      bubbleProperties(workInProgress);
      return;
    case CacheComponent: {
      const state = workInProgress.memoizedState as CacheComponentState | null;
      if (state !== null) {
        popCacheProvider(workInProgress, state.cache);
      }
      bubbleProperties(workInProgress);
      return;
    }
    case Mode:
    case Profiler:
      bubbleProperties(workInProgress);
      return;
    case SuspenseComponent:
      popSuspenseHandler(workInProgress);
      bubbleProperties(workInProgress);
      return;
    case OffscreenComponent:
      popSuspenseHandler(workInProgress);
      popHiddenContext(workInProgress);
      bubbleProperties(workInProgress);
      return;
    default:
      bubbleProperties(workInProgress);
  }
}

function completeHostComponent(workInProgress: Fiber): void {
  if (workInProgress.stateNode === null) {
    const instance = createInstance(String(workInProgress.type));
    precacheFiberNode(workInProgress, instance);
    updateFiberProps(instance, workInProgress.pendingProps);
    setInitialProperties(instance, String(workInProgress.type), workInProgress.pendingProps);
    appendAllChildren(instance, workInProgress);
    workInProgress.stateNode = instance;
  } else {
    updateFiberProps(workInProgress.stateNode as Node, workInProgress.pendingProps);
  }

  workInProgress.memoizedProps = workInProgress.pendingProps;
  bubbleProperties(workInProgress);
}

function completeHostText(workInProgress: Fiber): void {
  if (workInProgress.stateNode === null) {
    workInProgress.stateNode = createTextInstance(String(workInProgress.pendingProps.text ?? ""));
  }

  workInProgress.memoizedProps = workInProgress.pendingProps;
}

function appendAllChildren(parent: Node, workInProgress: Fiber): void {
  let node = workInProgress.child;

  while (node !== null) {
    if (node.tag === HostPortal) {
      // Portal 子树提交到独立容器，不能在普通宿主父节点创建时 append 进去。
    } else if (node.tag === OffscreenComponent && node.memoizedState !== null) {
      // hidden Offscreen 子树仍完成 Fiber，但不把 host node 挂到当前可见宿主父节点。
    } else if (node.tag === HostComponent || node.tag === HostText) {
      parent.appendChild(node.stateNode as Node);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === workInProgress) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function bubbleProperties(completedWork: Fiber): void {
  let subtreeFlags = 0;
  let newChildLanes = NoLanes;
  let child = completedWork.child;

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
