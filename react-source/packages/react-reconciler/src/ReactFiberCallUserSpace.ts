/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { isRendering, setIsRendering } from "./ReactCurrentFiber.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Effect, Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { captureCommitPhaseError } from "./ReactFiberWorkLoop.js";

// @beginner: 定义 ClassInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ClassInstance<R = unknown> = {
  render(): R;
  componentDidMount?(): void;
  componentDidUpdate?(prevProps: unknown, prevState: unknown, snapshot: unknown): void;
  componentDidCatch?(error: unknown, errorInfo: { componentStack: string }): void;
  componentWillUnmount?(): void;
};

// @beginner: 进入 callComponentInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callComponentInDEV<Props, Arg, R>(
  Component: (props: Props, secondArg: Arg) => R,
  props: Props,
  secondArg: Arg,
): R {
  // @beginner: 声明 wasRendering：保存当前步骤需要读取或更新的数据。
  const wasRendering = isRendering;
  setIsRendering(true);
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return Component(props, secondArg);
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    setIsRendering(wasRendering);
  }
}

// @beginner: 进入 callRenderInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callRenderInDEV<R>(instance: ClassInstance<R>): R {
  // @beginner: 声明 wasRendering：保存当前步骤需要读取或更新的数据。
  const wasRendering = isRendering;
  setIsRendering(true);
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return instance.render();
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    setIsRendering(wasRendering);
  }
}

// @beginner: 进入 callComponentDidMountInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callComponentDidMountInDEV(finishedWork: Fiber, instance: ClassInstance): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    instance.componentDidMount?.();
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}

// @beginner: 进入 callComponentDidUpdateInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callComponentDidUpdateInDEV(
  finishedWork: Fiber,
  instance: ClassInstance,
  prevProps: unknown,
  prevState: unknown,
  snapshot: unknown,
): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    instance.componentDidUpdate?.(prevProps, prevState, snapshot);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}

// @beginner: 进入 callComponentDidCatchInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callComponentDidCatchInDEV(
  instance: ClassInstance,
  errorInfo: CapturedValue<unknown>,
): void {
  instance.componentDidCatch?.(errorInfo.value, {
    componentStack: errorInfo.stack ?? "",
  });
}

// @beginner: 进入 callComponentWillUnmountInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callComponentWillUnmountInDEV(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  instance: ClassInstance,
): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    instance.componentWillUnmount?.();
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// @beginner: 进入 callCreateInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callCreateInDEV(effect: Effect): (() => void) | void {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return effect.create() ?? undefined;
}

// @beginner: 进入 callDestroyInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callDestroyInDEV(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destroy: () => void,
): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    destroy();
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// @beginner: 进入 callLazyInitInDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function callLazyInitInDEV<T>(lazy: { _payload: unknown; _init: (payload: unknown) => T }): T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return lazy._init(lazy._payload);
}
