/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props, ReactContext, ReactNode } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ReactInstanceMap, shallowEqual } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  checkHasForceUpdateAfterProcessing,
  cloneUpdateQueue,
  createUpdate,
  enqueueUpdate,
  entangleTransitions,
  ForceUpdate,
  initializeUpdateQueue,
  processUpdateQueue,
  ReplaceState,
  suspendIfUpdateReadFromEntangledAsyncAction,
  type UpdateQueue,
} from "./ReactFiberClassUpdateQueue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { readContext } from "./ReactFiberNewContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { requestUpdateLane, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";

// @beginner: 定义 ClassComponentInstance：描述对象需要具备哪些字段，方便读者理解数据形状。
interface ClassComponentInstance {
  props: Props;
  state: unknown;
  context: unknown;
  refs: Record<string, unknown>;
  updater: typeof classComponentUpdater;
  render(): ReactNode;
  shouldComponentUpdate?(nextProps: Props, nextState: unknown, nextContext: unknown): boolean;
  componentDidMount?(): void;
  componentDidUpdate?(prevProps: Props, prevState: unknown): void;
  forceUpdate(callback?: () => void): void;
}

// @beginner: 定义 ClassComponentConstructor：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ClassComponentConstructor = new (
  props: Props,
  context: unknown,
  updater: typeof classComponentUpdater,
) => ClassComponentInstance;

// @beginner: 声明 classComponentUpdater：保存当前步骤需要读取或更新的数据。
const classComponentUpdater = {
  isMounted(_publicInstance: unknown): boolean {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  },

  enqueueSetState(publicInstance: unknown, payload: unknown, callback?: () => void): void {
    // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (fiber === undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
    const lane = requestUpdateLane();
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    const update = createUpdate(lane);
    update.payload = payload;
    update.callback = callback ?? null;
    // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
    const root = enqueueUpdate(fiber, update, lane);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },

  enqueueReplaceState(publicInstance: unknown, payload: unknown, callback?: () => void): void {
    // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (fiber === undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
    const lane = requestUpdateLane();
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    const update = createUpdate(lane);
    update.tag = ReplaceState;
    update.payload = payload;
    update.callback = callback ?? null;
    // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
    const root = enqueueUpdate(fiber, update, lane);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },

  enqueueForceUpdate(publicInstance: unknown, callback?: () => void): void {
    // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (fiber === undefined) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 lane：保存当前步骤需要读取或更新的数据。
    const lane = requestUpdateLane();
    // @beginner: 声明 update：保存当前步骤需要读取或更新的数据。
    const update = createUpdate(lane);
    update.tag = ForceUpdate;
    update.callback = callback ?? null;
    // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
    const root = enqueueUpdate(fiber, update, lane);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },
};

// @beginner: 进入 constructClassInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function constructClassInstance(
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  props: Props,
): ClassComponentInstance {
  // @beginner: 声明 context：保存当前步骤需要读取或更新的数据。
  const context = readContextForClass(ctor);
  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = new ctor(props, context, classComponentUpdater);
  instance.props = props;
  instance.context = context;
  instance.updater = classComponentUpdater;

  workInProgress.memoizedState = instance.state ?? null;
  workInProgress.stateNode = instance;
  ReactInstanceMap.set(instance, workInProgress);
  initializeUpdateQueue(workInProgress);

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return instance;
}

// @beginner: 进入 mountClassInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function mountClassInstance(
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  newProps: Props,
  renderLanes: Lanes,
): void {
  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as ClassComponentInstance;
  ReactInstanceMap.set(instance, workInProgress);
  instance.props = newProps;
  instance.context = readContextForClass(ctor);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  suspendIfUpdateReadFromEntangledAsyncAction();
  instance.state = workInProgress.memoizedState;
}

// @beginner: 进入 updateClassInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  newProps: Props,
  renderLanes: Lanes,
): boolean {
  cloneUpdateQueue(current, workInProgress);
  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as ClassComponentInstance;
  // @beginner: 声明 oldProps：保存当前步骤需要读取或更新的数据。
  const oldProps = instance.props;
  // @beginner: 声明 oldState：保存当前步骤需要读取或更新的数据。
  const oldState = instance.state;
  // @beginner: 声明 oldContext：保存当前步骤需要读取或更新的数据。
  const oldContext = instance.context;
  // @beginner: 声明 nextContext：保存当前步骤需要读取或更新的数据。
  const nextContext = readContextForClass(ctor);

  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  suspendIfUpdateReadFromEntangledAsyncAction();
  // @beginner: 声明 newState：保存当前步骤需要读取或更新的数据。
  const newState = workInProgress.memoizedState;

  // @beginner: 声明 shouldUpdate：保存当前步骤需要读取或更新的数据。
  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(workInProgress, oldProps, newProps, oldState, newState, nextContext);

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shouldUpdate) {
    instance.props = newProps;
    instance.state = newState;
    instance.context = nextContext;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
    instance.props = newProps;
    instance.state = newState;
    instance.context = nextContext;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (oldContext !== nextContext) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return shouldUpdate;
}

// @beginner: 进入 checkShouldComponentUpdate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function checkShouldComponentUpdate(
  workInProgress: Fiber,
  oldProps: Props,
  newProps: Props,
  oldState: unknown,
  newState: unknown,
  nextContext: unknown,
): boolean {
  // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
  const instance = workInProgress.stateNode as ClassComponentInstance;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof instance.shouldComponentUpdate === "function") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return instance.shouldComponentUpdate(newProps, newState, nextContext);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ((instance as { isPureReactComponent?: boolean }).isPureReactComponent === true) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 readContextForClass：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function readContextForClass(ctor: ClassComponentConstructor): unknown {
  // @beginner: 声明 contextType：保存当前步骤需要读取或更新的数据。
  const contextType = (ctor as unknown as { contextType?: ReactContext<unknown> }).contextType;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return contextType !== undefined ? readContext(contextType) : undefined;
}
