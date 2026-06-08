/**
 * @beginner-module: 源码导读
 * 本文件负责 beginWork，也就是 render 阶段向下展开并生成子 Fiber。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ElementType, Props, ReactElement, ReactNode } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  REACT_CONTEXT_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
} from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import shallowEqual from "shared/shallowEqual.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ContextConsumer,
  ContextProvider,
  ClassComponent,
  CacheComponent,
  ForwardRef,
  HostRoot,
  HostPortal,
  FunctionComponent,
  HostComponent,
  HostText,
  Fragment,
  LazyComponent,
  Mode,
  MemoComponent,
  Profiler,
  SimpleMemoComponent,
  SuspenseComponent,
  OffscreenComponent,
} from "./ReactWorkTags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createFiberFromElement, createWorkInProgress } from "./ReactFiber.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { cloneChildFibers, reconcileChildFibers } from "./ReactChildFiber.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { renderWithHooks } from "./ReactFiberHooks.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { resolveLazy } from "./ReactFiberThenable.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  checkIfContextChanged,
  lazilyPropagateParentContextChanges,
  prepareToReadContext,
  pushProvider,
  readContext,
  readContextDuringReconciliation,
  resetContextDependencies,
} from "./ReactFiberNewContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getBumpedLaneForHydration,
  NoLane,
  includesSomeLane,
  NoLanes,
  OffscreenLane,
  SyncLane,
  type Lanes,
} from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { pushHostContainer, pushHostContext } from "./ReactFiberHostContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  constructClassInstance,
  mountClassInstance,
  updateClassInstance,
} from "./ReactFiberClassComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DidCapture, ForceClientRender, NoFlags, Placement } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  CacheContext,
  createCache,
  pushCacheProvider,
  retainCache,
  type Cache,
  type CacheComponentState,
} from "./ReactFiberCacheComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  popHiddenContext,
  pushHiddenContext,
  reuseHiddenContextOnStack,
} from "./ReactFiberHiddenContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  popSuspenseHandler,
  pushFallbackTreeSuspenseHandler,
  pushOffscreenSuspenseHandler,
  pushPrimaryTreeSuspenseHandler,
} from "./ReactFiberSuspenseContext.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { OffscreenProps, OffscreenState } from "./ReactFiberOffscreenComponent.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { SuspenseInstance, SuspenseState } from "./ReactFiberSuspenseComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getSuspenseInstanceFallbackErrorDetails,
  isSuspenseInstanceFallback,
  isSuspenseInstancePending,
} from "./ReactFiberSuspenseComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  claimNextHydratableSuspenseInstance,
  getIsHydrating,
  queueHydrationError,
  reenterHydrationStateFromDehydratedSuspenseInstance,
  warnIfHydrating,
} from "./ReactFiberHydrationContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getWorkInProgressRoot, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCapturedValueAtFiber } from "./ReactCapturedValue.js";

// @beginner: didReceiveUpdate 记录当前 Fiber 本轮是否真的收到 props/context/update 变化。
let didReceiveUpdate = false;

// @beginner: SelectiveHydrationException 用来中断当前 hydration，并把边界交给更合适的 lane 重试。
export const SelectiveHydrationException = new Error("This dehydrated boundary suspended during selective hydration.");

// @beginner: 进入 beginWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes = SyncLane): Fiber | null {
  // beginWork 是 render 阶段的“向下展开”：
  // 给一个 Fiber，计算它的子 Fiber，返回下一个要处理的 child。
  // 如果返回 null，work loop 会开始 completeWork 向上回溯。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    // update 阶段有旧 Fiber，可用旧 props、旧 lanes、旧 context 判断能否跳过子树。
    // @beginner: oldProps 是旧树上已经提交过的 props。
    const oldProps = current.memoizedProps;
    // @beginner: newProps 是本轮 render 准备处理的新 props。
    const newProps = workInProgress.pendingProps;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (oldProps !== newProps) {
      // props 引用变了，保守认为当前节点需要重新计算。
      didReceiveUpdate = true;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: hasScheduledUpdateOrContext 表示当前 Fiber 自己是否有待处理更新或 context 变化。
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (!hasScheduledUpdateOrContext && (workInProgress.flags & DidCapture) === NoFlags) {
        // props 没变，当前优先级下没有更新，context 也没变，可以尝试 bailout。
        // bailout 不一定整棵树都跳过：childLanes 里如果还有工作，仍会克隆子 Fiber 继续处理。
        didReceiveUpdate = false;
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
      }
      didReceiveUpdate = false;
    }
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    didReceiveUpdate = false;
  }

  // 与官方 beginWork 一致：一旦决定进入当前 fiber 的 begin 阶段，
  // 本轮 renderLanes 已经被消费，剩余子树工作会在 complete 阶段重新 bubble。
  workInProgress.lanes = NoLanes;

  // @beginner: beginWork 的核心分发：不同 Fiber tag 会生成不同类型的 child Fiber。
  switch (workInProgress.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
      // 应用根：children 来自 root.render(element)。
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateHostRoot(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      // Portal：子树提交到独立容器。
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updatePortalComponent(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case FunctionComponent:
      // 函数组件：执行组件函数，并在 renderWithHooks 中处理 Hooks。
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateFunctionComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ForwardRef:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateForwardRef(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case MemoComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateMemoComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SimpleMemoComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateSimpleMemoComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case LazyComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return mountLazyComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ClassComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateClassComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateHostComponent(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextProvider:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateContextProvider(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextConsumer:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateContextConsumer(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case Fragment:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateFragment(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case Mode:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateMode(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case Profiler:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateProfiler(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SuspenseComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateSuspenseComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case OffscreenComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateOffscreenComponent(current, workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case CacheComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateCacheComponent(current, workInProgress, renderLanes);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostText:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 updatePortalComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updatePortalComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  pushHostContainer(
    workInProgress,
    (workInProgress.stateNode as { containerInfo: Element | DocumentFragment }).containerInfo,
  );
  reconcileChildren(current, workInProgress, workInProgress.pendingProps as unknown as ReactNode);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateHostRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateHostRoot(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  // HostRoot 要先压入根 DOM 容器，complete/commit 阶段才能找到宿主父节点。
  pushHostContainer(workInProgress, (workInProgress.stateNode as FiberRoot).containerInfo);
  // root.render(<App />) 写入的 element 最终保存在 HostRoot.pendingProps.children。
  // @beginner: nextChildren 是 root.render 传进来的根 JSX/ReactElement。
  const nextChildren = workInProgress.pendingProps.children;
  // 把 ReactElement/数组/文本/null 调和成 child Fiber 链表。
  reconcileChildren(current, workInProgress, nextChildren);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateFunctionComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // FunctionComponent 的 type 就是用户写的函数组件。
  // @beginner: 声明 Component：保存函数组件本身，renderWithHooks 会调用它得到 children。
  const Component = workInProgress.type as (props: Props) => ReactNode;
  // renderWithHooks 会设置当前渲染 Fiber、选择 mount/update dispatcher、
  // 执行组件函数，并把 useState/useEffect 等 Hook 结果挂到 Fiber.memoizedState。
  // @beginner: nextChildren 是函数组件执行后返回的 JSX。
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    workInProgress.pendingProps,
    undefined,
    renderLanes,
  );
  // 函数组件返回的 JSX 继续变成下一层 Fiber。
  reconcileChildren(current, workInProgress, nextChildren);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateForwardRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateForwardRef(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: Component 是 forwardRef 包装对象，真正执行的是 Component.render。
  const Component = workInProgress.type as {
    render: (props: Props, ref: unknown) => ReactNode;
  };
  // @beginner: nextProps 是传给 forwardRef render 的 props，下面会剥离 ref。
  const nextProps = workInProgress.pendingProps;
  // @beginner: ref 是 forwardRef 的第二个参数，不应该混在普通 props 里。
  const ref = nextProps.ref;
  // @beginner: propsWithoutRef 是剥离 ref 后传给用户 render 函数的 props。
  let propsWithoutRef = nextProps;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("ref" in nextProps) {
    propsWithoutRef = {};
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const key of Object.keys(nextProps)) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (key !== "ref") {
        propsWithoutRef[key] = nextProps[key];
      }
    }
  }

  // @beginner: forwardRef 的 children 来自 Component.render(propsWithoutRef, ref)。
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component.render,
    propsWithoutRef,
    ref,
    renderLanes,
  );
  reconcileChildren(current, workInProgress, nextChildren);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateMemoComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: Component 保存 memo 包装对象，里面的 type 才是真正组件。
  const Component = workInProgress.type as {
    type: ElementType;
    compare: null | ((prevProps: Props, nextProps: Props) => boolean);
  };
  // @beginner: nextProps 是 memo 包装组件本轮收到的新 props。
  const nextProps = workInProgress.pendingProps;
  // @beginner: type 是 memo 内部真正需要渲染的组件类型。
  const type = Component.type;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current === null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof type === "function" && Component.compare === null && !isClassComponent(type)) {
      workInProgress.tag = SimpleMemoComponent;
      workInProgress.type = type;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateSimpleMemoComponent(null, workInProgress, renderLanes);
    }

    // @beginner: child 是 memo 首次挂载时创建出来的内部组件 Fiber。
    const child = createFiberFromElement({
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key: null,
      props: nextProps,
    });
    child.return = workInProgress;
    workInProgress.child = child;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return child;
  }

  // @beginner: currentChild 是 memo 上一次渲染出来的内部组件 Fiber。
  const currentChild = current.child;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (currentChild === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: memo bailout 前必须确认没有本 Fiber 自己的更新或 context 变化。
  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!hasScheduledUpdateOrContext) {
    // @beginner: prevProps 是 memo 内部组件上次实际渲染时的 props。
    const prevProps = currentChild.memoizedProps ?? {};
    // @beginner: compare 是 React.memo 的自定义比较函数，未提供时走 shallowEqual。
    const compare = Component.compare ?? shallowEqual;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (compare(prevProps, nextProps)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  // @beginner: newChild 复用 currentChild，更新 pendingProps 后继续向下渲染。
  const newChild = createWorkInProgress(currentChild, nextProps);
  newChild.return = workInProgress;
  workInProgress.child = newChild;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return newChild;
}

// @beginner: 进入 updateSimpleMemoComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateSimpleMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: nextProps 是 SimpleMemoComponent 本轮收到的新 props。
  const nextProps = workInProgress.pendingProps;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    // @beginner: prevProps 是 SimpleMemoComponent 上次提交的 props。
    const prevProps = current.memoizedProps ?? {};
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (shallowEqual(prevProps, nextProps) && !checkScheduledUpdateOrContext(current, renderLanes)) {
      workInProgress.pendingProps = current.memoizedProps ?? nextProps;
      workInProgress.lanes = current.lanes;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return updateFunctionComponent(current, workInProgress, renderLanes);
}

// @beginner: 进入 mountLazyComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountLazyComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: lazyType 保存 React.lazy 返回对象，resolveLazy 会读取它的 payload/init。
  const lazyType = workInProgress.elementType as {
    _payload: unknown;
    _init(payload: unknown): ElementType;
  };
  // @beginner: Component 是 lazy 解析后的真实组件类型。
  const Component = resolveLazy(lazyType);
  workInProgress.type = Component;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof Component === "function") {
    workInProgress.tag = isClassComponent(Component) ? ClassComponent : FunctionComponent;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return workInProgress.tag === ClassComponent
      ? updateClassComponent(current, workInProgress, renderLanes)
      : updateFunctionComponent(current, workInProgress, renderLanes);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (Component !== null && typeof Component === "object") {
    // @beginner: $$typeof 用来判断 lazy 解析结果是不是 forwardRef/memo/context 等包装类型。
    const $$typeof = (Component as { $$typeof?: symbol }).$$typeof;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ($$typeof === REACT_FORWARD_REF_TYPE) {
      workInProgress.tag = ForwardRef;
      workInProgress.type = Component;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateForwardRef(current, workInProgress, renderLanes);
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ($$typeof === REACT_MEMO_TYPE) {
      workInProgress.tag = MemoComponent;
      workInProgress.type = Component;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateMemoComponent(current, workInProgress, renderLanes);
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ($$typeof === REACT_CONTEXT_TYPE) {
      workInProgress.tag = ContextConsumer;
      workInProgress.type = Component;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return updateContextConsumer(current, workInProgress, renderLanes);
    }
  }

  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Lazy element type must resolve to a class or function component.");
}

// @beginner: 进入 updateClassComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: Component 是 class 构造函数。
  const Component = workInProgress.type as Parameters<typeof constructClassInstance>[1];
  // @beginner: props 是传给 class 实例的本轮 props。
  const props = workInProgress.pendingProps;

  prepareToReadContext(workInProgress, renderLanes);
  // @beginner: instance 是 class 组件实例，mount 时创建，update 时复用。
  let instance = workInProgress.stateNode as ReturnType<typeof constructClassInstance> | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance === null) {
    instance = constructClassInstance(workInProgress, Component, props);
    mountClassInstance(workInProgress, Component, props, renderLanes);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (current !== null) {
    // @beginner: shouldUpdate 表示 class 组件是否需要重新执行 render。
    const shouldUpdate = updateClassInstance(current, workInProgress, Component, props, renderLanes);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!shouldUpdate) {
      resetContextDependencies();
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    }
  }

  // @beginner: nextChildren 是 class instance.render() 返回的子树。
  const nextChildren = instance.render();
  resetContextDependencies();
  reconcileChildren(current, workInProgress, nextChildren);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateHostComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateHostComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  // HostComponent 是真实 DOM 标签，例如 div、button、span。
  pushHostContext(workInProgress);
  // DOM 标签的下一层来自 props.children。
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateContextProvider：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateContextProvider(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  // @beginner: providerType 保存 Context.Provider 包装对象。
  const providerType = workInProgress.type as { _context: unknown };
  // @beginner: context 是 Provider 要写入新 value 的目标 Context 对象。
  const context = providerType._context as Parameters<typeof pushProvider>[1];
  pushProvider(workInProgress, context, workInProgress.pendingProps.value);
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateContextConsumer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateContextConsumer(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: consumerType 保存 Context.Consumer 或 Context 本身。
  const consumerType = workInProgress.type as {
    _context?: Parameters<typeof readContextDuringReconciliation>[1];
  };
  // @beginner: context 是本次 Consumer 读取的 Context 对象。
  const context = consumerType._context ?? (workInProgress.type as Parameters<typeof readContextDuringReconciliation>[1]);
  // @beginner: 声明 render：保存 ContextConsumer 的 render props 函数，读取 context 后调用它。
  const render = workInProgress.pendingProps.children as unknown as (value: unknown) => ReactNode;
  // @beginner: value 是从当前 Context 栈里读取到的值，会传给 render props。
  const value = readContextDuringReconciliation(workInProgress, context, renderLanes);
  reconcileChildren(current, workInProgress, render(value));
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateFragment：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateFragment(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateMode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateMode(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateProfiler：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateProfiler(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateSuspenseComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateSuspenseComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: 声明 nextProps：保存当前步骤需要读取或更新的数据。
  const nextProps = workInProgress.pendingProps;
  // @beginner: 声明 showFallback：保存当前步骤需要读取或更新的数据。
  const showFallback = (workInProgress.flags & DidCapture) !== NoFlags;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current === null && getIsHydrating()) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (showFallback) {
      pushFallbackTreeSuspenseHandler(workInProgress);
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      pushPrimaryTreeSuspenseHandler(workInProgress);
    }
    // @beginner: 声明 dehydrated：保存当前步骤需要读取或更新的数据。
    const dehydrated = claimNextHydratableSuspenseInstance(workInProgress);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return mountDehydratedSuspenseComponent(workInProgress, dehydrated);
  }

  // @beginner: 声明 previousState：保存当前步骤需要读取或更新的数据。
  const previousState = current?.memoizedState as SuspenseState | null | undefined;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null && previousState?.dehydrated !== null && previousState?.dehydrated !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return updateDehydratedSuspenseComponent(current, workInProgress, previousState, showFallback, renderLanes);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null && (workInProgress.flags & ForceClientRender) !== NoFlags) {
    pushPrimaryTreeSuspenseHandler(workInProgress);
    workInProgress.flags &= ~ForceClientRender;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (showFallback) {
    pushFallbackTreeSuspenseHandler(workInProgress);
    workInProgress.memoizedState = createSuspenseState();
    // 当前复刻版先用 Offscreen 保存 primary/fallback 的显隐关系；
    // 后续 retry lane 接入后，可在 primary hidden 树上保留更完整的恢复状态。
    reconcileChildren(current, workInProgress, [
      createOffscreenElement("primary", "hidden", nextProps.children),
      createOffscreenElement("fallback", "visible", (nextProps.fallback ?? null) as ReactNode),
    ]);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return workInProgress.child;
  }

  pushPrimaryTreeSuspenseHandler(workInProgress);
  workInProgress.memoizedState = null;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 mountDehydratedSuspenseComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function mountDehydratedSuspenseComponent(
  workInProgress: Fiber,
  dehydrated: SuspenseInstance,
): Fiber | null {
  // hydration 首轮不下钻 children，直接把服务端 DOM 留在原地；
  // 后续 OffscreenLane 会再次进入该边界并尝试把 primary 子树接到已有 DOM 上。
  workInProgress.memoizedState = createSuspenseState(dehydrated);
  workInProgress.lanes = OffscreenLane;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 updateDehydratedSuspenseComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateDehydratedSuspenseComponent(
  current: Fiber,
  workInProgress: Fiber,
  suspenseState: SuspenseState,
  showFallback: boolean,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: 声明 nextProps：保存当前步骤需要读取或更新的数据。
  const nextProps = workInProgress.pendingProps;
  // @beginner: 声明 dehydrated：保存当前步骤需要读取或更新的数据。
  const dehydrated = suspenseState.dehydrated;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dehydrated === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (showFallback) {
    pushFallbackTreeSuspenseHandler(workInProgress);
    workInProgress.memoizedState = suspenseState;
    workInProgress.child = current.child;
    workInProgress.flags |= DidCapture;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ((workInProgress.flags & DidCapture) !== NoFlags) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  pushPrimaryTreeSuspenseHandler(workInProgress);
  warnIfHydrating();

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isSuspenseInstanceFallback(dehydrated)) {
    // @beginner: 声明 details：保存当前步骤需要读取或更新的数据。
    const details = getSuspenseInstanceFallbackErrorDetails(dehydrated);
    // @beginner: 声明 error：保存当前步骤需要读取或更新的数据。
    const error = new Error(
      details.message ??
        "The server could not finish this Suspense boundary. Switched to client rendering.",
    ) as Error & { digest?: string };
    error.digest = details.digest;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (details.stack !== undefined) {
      error.stack = details.stack;
    }
    queueHydrationError(createCapturedValueAtFiber(error, workInProgress));
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (didReceiveUpdate || includesSomeLane(current.childLanes, OffscreenLane)) {
    // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
    const root = getWorkInProgressRoot();
    // @beginner: 声明 attemptHydrationAtLane：保存当前步骤需要读取或更新的数据。
    const attemptHydrationAtLane =
      root === null ? NoLane : getBumpedLaneForHydration(root, renderLanes);

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (attemptHydrationAtLane !== NoLane && attemptHydrationAtLane !== suspenseState.retryLane) {
      suspenseState.retryLane = attemptHydrationAtLane;
      scheduleUpdateOnFiber(current, attemptHydrationAtLane);
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw SelectiveHydrationException;
    }

    queueHydrationError(
      createCapturedValueAtFiber(
        new Error("Hydration failed because this Suspense boundary received an update before it hydrated."),
        workInProgress,
      ),
    );
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return retrySuspenseComponentWithoutHydrating(current, workInProgress);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isSuspenseInstancePending(dehydrated)) {
    workInProgress.flags |= DidCapture;
    workInProgress.memoizedState = suspenseState;
    workInProgress.child = current.child;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  reenterHydrationStateFromDehydratedSuspenseInstance(
    workInProgress,
    dehydrated,
    suspenseState.treeContext,
  );
  workInProgress.memoizedState = null;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 retrySuspenseComponentWithoutHydrating：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function retrySuspenseComponentWithoutHydrating(current: Fiber, workInProgress: Fiber): Fiber | null {
  // hydration 已经无法继续时，重新 diff 当前 dehydrated child 与 client primary Offscreen；
  // reconcileChildFibers 会把旧 dehydrated child 放入 deletion，再创建新的客户端子树。
  workInProgress.memoizedState = null;
  // @beginner: 声明 nextProps：保存当前步骤需要读取或更新的数据。
  const nextProps = workInProgress.pendingProps;
  reconcileChildren(current, workInProgress, createOffscreenElement("primary", "visible", nextProps.children));
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgress.child !== null) {
    workInProgress.child.flags |= Placement;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateOffscreenComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateOffscreenComponent(current: Fiber | null, workInProgress: Fiber): Fiber | null {
  // @beginner: 声明 nextProps：保存当前步骤需要读取或更新的数据。
  const nextProps = workInProgress.pendingProps as OffscreenProps;
  // @beginner: 声明 isHidden：保存当前步骤需要读取或更新的数据。
  const isHidden = nextProps.mode === "hidden" || nextProps.mode === "unstable-defer-without-hiding";

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isHidden) {
    // @beginner: 声明 previousState：保存当前步骤需要读取或更新的数据。
    const previousState = current?.memoizedState as OffscreenState | null | undefined;
    // @beginner: 声明 offscreenState：保存当前步骤需要读取或更新的数据。
    const offscreenState: OffscreenState = previousState ?? {
      baseLanes: workInProgress.childLanes,
      cachePool: null,
    };
    offscreenState.baseLanes = workInProgress.childLanes;
    workInProgress.memoizedState = offscreenState;
    pushHiddenContext(workInProgress, { baseLanes: offscreenState.baseLanes });
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    workInProgress.memoizedState = null;
    reuseHiddenContextOnStack(workInProgress);
  }

  pushOffscreenSuspenseHandler(workInProgress);
  reconcileChildren(current, workInProgress, nextProps.children);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 updateCacheComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateCacheComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  prepareToReadContext(workInProgress, renderLanes);
  // @beginner: 声明 parentCache：保存当前步骤需要读取或更新的数据。
  const parentCache = readContext(CacheContext) ?? createCache();

  // @beginner: 声明 cacheState：保存当前步骤需要读取或更新的数据。
  let cacheState = workInProgress.memoizedState as CacheComponentState | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current === null || cacheState === null) {
    // @beginner: 声明 freshCache：保存当前步骤需要读取或更新的数据。
    const freshCache: Cache = createCache();
    retainCache(freshCache);
    cacheState = {
      parent: parentCache,
      cache: freshCache,
    };
    workInProgress.memoizedState = cacheState;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (cacheState.parent !== parentCache) {
    cacheState = {
      parent: parentCache,
      cache: parentCache,
    };
    workInProgress.memoizedState = cacheState;
  }

  pushCacheProvider(workInProgress, cacheState.cache);
  reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
  resetContextDependencies();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}

// @beginner: 进入 reconcileChildren：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function reconcileChildren(current: Fiber | null, workInProgress: Fiber, nextChildren: ReactNode): void {
  // reconcileChildFibers 是 diff 的核心：
  // - current?.child 是旧 Fiber 子链表。
  // - nextChildren 是本轮 render 得到的新 ReactNode。
  // - 返回值是新 Fiber 子链表，同时在 Fiber 上打 Placement/Update/ChildDeletion flags。
  workInProgress.child = reconcileChildFibers(
    workInProgress,
    current?.child ?? null,
    nextChildren,
  );
}

// @beginner: 进入 isClassComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isClassComponent(type: unknown): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    typeof type === "function" &&
    type.prototype !== undefined &&
    type.prototype.isReactComponent !== undefined
  );
}

// @beginner: 进入 checkScheduledUpdateOrContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function checkScheduledUpdateOrContext(current: Fiber, renderLanes: Lanes): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (includesSomeLane(current.lanes, renderLanes)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  // @beginner: 声明 dependencies：保存当前步骤需要读取或更新的数据。
  const dependencies = current.dependencies;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dependencies !== null && checkIfContextChanged(dependencies);
}

// @beginner: 进入 attemptEarlyBailoutIfNoScheduledUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (workInProgress.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
      pushHostContainer(workInProgress, (workInProgress.stateNode as FiberRoot).containerInfo);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      pushHostContext(workInProgress);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      pushHostContainer(
        workInProgress,
        (workInProgress.stateNode as { containerInfo: Element | DocumentFragment }).containerInfo,
      );
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextProvider: {
      // @beginner: 声明 providerType：保存当前步骤需要读取或更新的数据。
      const providerType = workInProgress.type as { _context: Parameters<typeof pushProvider>[1] };
      pushProvider(workInProgress, providerType._context, workInProgress.memoizedProps?.value);
      break;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case CacheComponent: {
      // @beginner: 声明 state：保存当前步骤需要读取或更新的数据。
      const state = workInProgress.memoizedState as CacheComponentState | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (state !== null) {
        pushCacheProvider(workInProgress, state.cache);
      }
      break;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SuspenseComponent:
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (workInProgress.memoizedState !== null) {
        pushFallbackTreeSuspenseHandler(workInProgress);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        pushPrimaryTreeSuspenseHandler(workInProgress);
      }
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case OffscreenComponent: {
      // @beginner: 声明 state：保存当前步骤需要读取或更新的数据。
      const state = workInProgress.memoizedState as OffscreenState | null;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (state !== null) {
        pushHiddenContext(workInProgress, { baseLanes: state.baseLanes });
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        reuseHiddenContextOnStack(workInProgress);
      }
      pushOffscreenSuspenseHandler(workInProgress);
      break;
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}

// @beginner: 进入 createSuspenseState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createSuspenseState(dehydrated: SuspenseInstance | null = null): SuspenseState {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    dehydrated,
    treeContext: null,
    retryLane: NoLane,
    hydrationErrors: null,
  };
}

// @beginner: 进入 createOffscreenElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createOffscreenElement(
  key: string,
  mode: OffscreenProps["mode"],
  children: ReactNode,
): ReactElement {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: REACT_OFFSCREEN_TYPE,
    key,
    props: {
      mode,
      children,
    },
  };
}

// @beginner: 进入 bailoutOnAlreadyFinishedWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (current !== null) {
    workInProgress.dependencies = current.dependencies;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (current !== null) {
      // 官方 lazy context propagation：真正准备跳过子树时，再沿父链收集变更的 Provider，
      // 并把命中的 consumer lane 冒泡到 childLanes，避免全树提前扫描。
      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return null;
      }
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    }
  }

  cloneChildFibers(current, workInProgress);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return workInProgress.child;
}
