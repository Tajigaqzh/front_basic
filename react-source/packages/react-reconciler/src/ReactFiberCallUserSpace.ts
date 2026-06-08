import type { CapturedValue } from "./ReactCapturedValue.js";
import { isRendering, setIsRendering } from "./ReactCurrentFiber.js";
import type { Effect, Fiber } from "./ReactInternalTypes.js";
import { captureCommitPhaseError } from "./ReactFiberWorkLoop.js";

type ClassInstance<R = unknown> = {
  render(): R;
  componentDidMount?(): void;
  componentDidUpdate?(prevProps: unknown, prevState: unknown, snapshot: unknown): void;
  componentDidCatch?(error: unknown, errorInfo: { componentStack: string }): void;
  componentWillUnmount?(): void;
};

export function callComponentInDEV<Props, Arg, R>(
  Component: (props: Props, secondArg: Arg) => R,
  props: Props,
  secondArg: Arg,
): R {
  const wasRendering = isRendering;
  setIsRendering(true);
  try {
    return Component(props, secondArg);
  } finally {
    setIsRendering(wasRendering);
  }
}

export function callRenderInDEV<R>(instance: ClassInstance<R>): R {
  const wasRendering = isRendering;
  setIsRendering(true);
  try {
    return instance.render();
  } finally {
    setIsRendering(wasRendering);
  }
}

export function callComponentDidMountInDEV(finishedWork: Fiber, instance: ClassInstance): void {
  try {
    instance.componentDidMount?.();
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}

export function callComponentDidUpdateInDEV(
  finishedWork: Fiber,
  instance: ClassInstance,
  prevProps: unknown,
  prevState: unknown,
  snapshot: unknown,
): void {
  try {
    instance.componentDidUpdate?.(prevProps, prevState, snapshot);
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}

export function callComponentDidCatchInDEV(
  instance: ClassInstance,
  errorInfo: CapturedValue<unknown>,
): void {
  instance.componentDidCatch?.(errorInfo.value, {
    componentStack: errorInfo.stack ?? "",
  });
}

export function callComponentWillUnmountInDEV(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  instance: ClassInstance,
): void {
  try {
    instance.componentWillUnmount?.();
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

export function callCreateInDEV(effect: Effect): (() => void) | void {
  return effect.create() ?? undefined;
}

export function callDestroyInDEV(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destroy: () => void,
): void {
  try {
    destroy();
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

export function callLazyInitInDEV<T>(lazy: { _payload: unknown; _init: (payload: unknown) => T }): T {
  return lazy._init(lazy._payload);
}
