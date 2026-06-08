import type { Props, ReactContext, ReactNode } from "shared";
import { ReactInstanceMap, shallowEqual } from "shared";
import type { Fiber } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
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
import { readContext } from "./ReactFiberNewContext.js";
import { requestUpdateLane, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";

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

type ClassComponentConstructor = new (
  props: Props,
  context: unknown,
  updater: typeof classComponentUpdater,
) => ClassComponentInstance;

const classComponentUpdater = {
  isMounted(_publicInstance: unknown): boolean {
    return false;
  },

  enqueueSetState(publicInstance: unknown, payload: unknown, callback?: () => void): void {
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    if (fiber === undefined) {
      return;
    }
    const lane = requestUpdateLane();
    const update = createUpdate(lane);
    update.payload = payload;
    update.callback = callback ?? null;
    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },

  enqueueReplaceState(publicInstance: unknown, payload: unknown, callback?: () => void): void {
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    if (fiber === undefined) {
      return;
    }
    const lane = requestUpdateLane();
    const update = createUpdate(lane);
    update.tag = ReplaceState;
    update.payload = payload;
    update.callback = callback ?? null;
    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },

  enqueueForceUpdate(publicInstance: unknown, callback?: () => void): void {
    const fiber = ReactInstanceMap.get<Fiber>(publicInstance);
    if (fiber === undefined) {
      return;
    }
    const lane = requestUpdateLane();
    const update = createUpdate(lane);
    update.tag = ForceUpdate;
    update.callback = callback ?? null;
    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      entangleTransitions(root, fiber.updateQueue as UpdateQueue<unknown>, lane);
      scheduleUpdateOnFiber(fiber, lane);
    }
  },
};

export function constructClassInstance(
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  props: Props,
): ClassComponentInstance {
  const context = readContextForClass(ctor);
  const instance = new ctor(props, context, classComponentUpdater);
  instance.props = props;
  instance.context = context;
  instance.updater = classComponentUpdater;

  workInProgress.memoizedState = instance.state ?? null;
  workInProgress.stateNode = instance;
  ReactInstanceMap.set(instance, workInProgress);
  initializeUpdateQueue(workInProgress);

  return instance;
}

export function mountClassInstance(
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  newProps: Props,
  renderLanes: Lanes,
): void {
  const instance = workInProgress.stateNode as ClassComponentInstance;
  ReactInstanceMap.set(instance, workInProgress);
  instance.props = newProps;
  instance.context = readContextForClass(ctor);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  suspendIfUpdateReadFromEntangledAsyncAction();
  instance.state = workInProgress.memoizedState;
}

export function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: ClassComponentConstructor,
  newProps: Props,
  renderLanes: Lanes,
): boolean {
  cloneUpdateQueue(current, workInProgress);
  const instance = workInProgress.stateNode as ClassComponentInstance;
  const oldProps = instance.props;
  const oldState = instance.state;
  const oldContext = instance.context;
  const nextContext = readContextForClass(ctor);

  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  suspendIfUpdateReadFromEntangledAsyncAction();
  const newState = workInProgress.memoizedState;

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(workInProgress, oldProps, newProps, oldState, newState, nextContext);

  if (shouldUpdate) {
    instance.props = newProps;
    instance.state = newState;
    instance.context = nextContext;
  } else {
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
    instance.props = newProps;
    instance.state = newState;
    instance.context = nextContext;
  }

  if (oldContext !== nextContext) {
    return true;
  }

  return shouldUpdate;
}

function checkShouldComponentUpdate(
  workInProgress: Fiber,
  oldProps: Props,
  newProps: Props,
  oldState: unknown,
  newState: unknown,
  nextContext: unknown,
): boolean {
  const instance = workInProgress.stateNode as ClassComponentInstance;
  if (typeof instance.shouldComponentUpdate === "function") {
    return instance.shouldComponentUpdate(newProps, newState, nextContext);
  }

  if ((instance as { isPureReactComponent?: boolean }).isPureReactComponent === true) {
    return !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState);
  }

  return true;
}

function readContextForClass(ctor: ClassComponentConstructor): unknown {
  const contextType = (ctor as unknown as { contextType?: ReactContext<unknown> }).contextType;
  return contextType !== undefined ? readContext(contextType) : undefined;
}
