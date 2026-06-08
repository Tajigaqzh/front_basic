/**
 * @beginner-module: 源码导读
 * 本文件定义 Fiber 节点和 ReactElement/Portal/Text 到 Fiber 的创建逻辑。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Key, Props, ReactElement, ReactPortal, Wakeable } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  REACT_CACHE_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_CONSUMER_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
  REACT_PORTAL_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_STRICT_MODE_TYPE,
} from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoFlags } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoMode, ProfileMode, StrictEffectsMode, StrictLegacyMode } from "./ReactTypeOfMode.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  CacheComponent,
  Fragment,
  ClassComponent,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  ContextConsumer,
  ContextProvider,
  ForwardRef,
  LazyComponent,
  Mode,
  MemoComponent,
  Profiler,
  SuspenseComponent,
  OffscreenComponent,
  type WorkTag,
} from "./ReactWorkTags.js";

// @beginner: 定义 FiberNode：把相关状态和方法组织在同一个对象上。
export class FiberNode implements Fiber {
  // tag 表示 Fiber 的“大类”：函数组件、DOM 标签、文本、根节点、Suspense 等。
  // beginWork/completeWork/commitWork 都会按 tag 走不同处理逻辑。
  tag: WorkTag;
  // key 来自 ReactElement.key，只参与同层 children diff，不会传给组件 props。
  key: Key;
  // type 是真正用于执行/创建的类型：函数组件就是函数，DOM 节点就是 "div"。
  type: unknown = null;
  // elementType 保留 JSX 原始类型；memo/lazy 等包装组件会用它和 type 做区分。
  elementType: unknown = null;
  // stateNode 指向 Fiber 对应的真实对象：
  // HostComponent -> DOM Element；HostText -> Text；HostRoot -> FiberRoot。
  stateNode: unknown = null;
  // mode 保存 StrictMode、ProfileMode 这类运行模式标记，会影响子树行为。
  mode = NoMode;

  // return/child/sibling 是 Fiber 树的三根指针：
  // - return 指父节点，名字来自官方源码，不是 JavaScript 的 return 语句。
  // - child 指第一个子节点。
  // - sibling 指下一个兄弟节点。
  return: Fiber | null = null;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  // index 表示当前 Fiber 在兄弟节点中的位置，children diff 时会用它判断顺序。
  index = 0;

  // pendingProps 是本轮 render 输入的新 props。
  pendingProps: Props;
  // memoizedProps 是上一次完成 render 后记住的 props，用来和 pendingProps 对比。
  memoizedProps: Props | null = null;
  // memoizedState 对函数组件来说是 Hook 链表头；对 HostRoot/Suspense 等也可保存各自状态。
  memoizedState = null;
  // updateQueue 保存待处理更新：函数组件 effect 队列、class 组件 setState 队列等都会放这里。
  updateQueue: unknown = null;

  // flags 是当前 Fiber 自己的副作用标记，比如 Placement/Update/ChildDeletion。
  flags = NoFlags;
  // subtreeFlags 是整棵子树的副作用汇总，commit 阶段靠它快速跳过没有工作的子树。
  subtreeFlags = NoFlags;
  // deletions 挂在父 Fiber 上，因为删除真实 DOM 时需要知道父级宿主节点。
  deletions: Fiber[] | null = null;

  // lanes 表示当前 Fiber 自己有哪些优先级的更新。
  lanes = NoLanes;
  // childLanes 表示子树里有哪些优先级的更新，父节点 bailout 时会检查它。
  childLanes = NoLanes;
  // alternate 指向双缓存中的另一棵树：current <-> workInProgress。
  alternate: Fiber | null = null;
  // dependencies 保存 context 依赖，Provider 更新时据此找到需要重渲染的消费者。
  dependencies = null;
  // Suspense 记录等待中的 Promise，Promise resolve 后可以触发 retry。
  suspenseRetryCache?: WeakSet<Wakeable>;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 构造函数只保存最基础的 tag/props/key，其余字段保持默认值。
    this.tag = tag;
    this.pendingProps = pendingProps;
    this.key = key;
  }
}

// @beginner: 进入 createHostRootFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createHostRootFiber(): Fiber {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return new FiberNode(HostRoot, { children: null }, null);
}

// @beginner: 进入 createFiberFromText：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createFiberFromText(content: string | number): Fiber {
  // @beginner: 文本节点也会变成 Fiber，后续 completeWork 会据此创建 Text DOM。
  const fiber = new FiberNode(HostText, { text: String(content) }, null);
  fiber.type = "TEXT";
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber;
}

// @beginner: 进入 createFiberFromElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createFiberFromElement(element: ReactElement): Fiber {
  // 默认先把 JSX 当成 DOM 标签处理；下面再根据 element.type 修正为函数组件、Fragment 等。
  // @beginner: fiberTag 决定 beginWork/completeWork/commitWork 采用哪条处理分支。
  let fiberTag: WorkTag = HostComponent;
  // @beginner: type 来自 ReactElement.type，可能是字符串、函数或 React 内置 symbol。
  const type = element.type;
  // @beginner: mode 会从 StrictMode/Profiler 等特殊元素向子树传递。
  let mode = NoMode;

  // @beginner: 函数组件和 class 组件都以 function 形式出现，需要进一步区分。
  if (typeof type === "function") {
    // class 组件和函数组件在 JSX 中都表现为函数，所以要看 prototype 上有没有 isReactComponent。
    fiberTag =
      type.prototype !== undefined && type.prototype.isReactComponent !== undefined
        ? ClassComponent
        : FunctionComponent;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_FRAGMENT_TYPE) {
    fiberTag = Fragment;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_STRICT_MODE_TYPE) {
    fiberTag = Mode;
    mode |= StrictLegacyMode | StrictEffectsMode;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_PROFILER_TYPE) {
    fiberTag = Profiler;
    mode |= ProfileMode;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_OFFSCREEN_TYPE) {
    fiberTag = OffscreenComponent;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (type === REACT_CACHE_TYPE) {
    fiberTag = CacheComponent;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (
    typeof type === "object" &&
    type !== null &&
    ((type as { $$typeof?: symbol }).$$typeof === REACT_CONTEXT_TYPE ||
      (type as { $$typeof?: symbol }).$$typeof === REACT_CONSUMER_TYPE)
  ) {
    fiberTag = ContextConsumer;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_FORWARD_REF_TYPE
  ) {
    fiberTag = ForwardRef;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_MEMO_TYPE
  ) {
    fiberTag = MemoComponent;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (
    typeof type === "object" &&
    type !== null &&
    (type as { $$typeof?: symbol }).$$typeof === REACT_LAZY_TYPE
  ) {
    fiberTag = LazyComponent;
  }

  // @beginner: 创建出的 Fiber 是 ReactElement 在运行时工作树里的节点。
  const fiber = new FiberNode(fiberTag, element.props, element.key);
  // elementType/type/key/props 共同把 ReactElement 的描述信息搬到 Fiber 上。
  fiber.elementType = type;
  fiber.type = type;
  fiber.mode = mode;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber;
}

// @beginner: 进入 createFiberFromPortal：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createFiberFromPortal(portal: ReactPortal): Fiber {
  // @beginner: Portal Fiber 的 DOM 容器不是父 DOM，而是 portal.containerInfo。
  const fiber = new FiberNode(HostPortal, portal.children as unknown as Props, portal.key);
  fiber.elementType = REACT_PORTAL_TYPE;
  fiber.type = REACT_PORTAL_TYPE;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    implementation: portal.implementation,
  };
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber;
}

// @beginner: 进入 createWorkInProgress：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createWorkInProgress(current: Fiber, pendingProps: Props): Fiber {
  // @beginner: current.alternate 就是双缓存里的另一份 Fiber，可复用则避免重复创建。
  let workInProgress = current.alternate;

  // @beginner: 第一次更新某个 Fiber 时还没有 alternate，需要创建 workInProgress。
  if (workInProgress === null) {
    // 官方 React 的双缓存模型：current 保存已提交树，workInProgress 保存本次渲染树。
    // 两棵树通过 alternate 互相指向，提交后 root.current 切到 finishedWork。
    workInProgress = new FiberNode(current.tag, pendingProps, current.key);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;
    workInProgress.mode = current.mode;
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  workInProgress.return = current.return;
  // 与官方双缓存模型一致：默认复用 current 的 child/sibling 指针。
  // 真正进入子树时，reconcile/cloneChildFibers 会按需创建 workInProgress child；
  // 如果当前 fiber bailout，则可以直接沿用这棵已经完成的子树。
  workInProgress.child = current.child;
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.lanes = current.lanes;
  workInProgress.childLanes = current.childLanes;
  workInProgress.dependencies =
    current.dependencies === null
      ? null
      : {
          lanes: current.dependencies.lanes,
          firstContext: current.dependencies.firstContext,
        };
  workInProgress.suspenseRetryCache = current.suspenseRetryCache;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress;
}
