/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import reportGlobalError from "shared/reportGlobalError.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ClassComponent } from "./ReactWorkTags.js";

// @beginner: 定义 ErrorInfo：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ErrorInfo = {
  componentStack?: string | null;
  errorBoundary?: unknown;
};

// @beginner: 定义 ErrorRoot：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ErrorRoot = FiberRoot & {
  onUncaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onCaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
};

// @beginner: 声明 componentName：保存当前步骤需要读取或更新的数据。
let componentName: string | null = null;
// @beginner: 声明 errorBoundaryName：保存当前步骤需要读取或更新的数据。
let errorBoundaryName: string | null = null;

// @beginner: 进入 defaultOnUncaughtError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function defaultOnUncaughtError(error: unknown, _errorInfo: ErrorInfo): void {
  reportGlobalError(error);
  // @beginner: 声明 componentNameMessage：保存当前步骤需要读取或更新的数据。
  const componentNameMessage = componentName
    ? `An error occurred in the <${componentName}> component.`
    : "An error occurred in one of your React components.";
  // @beginner: 声明 errorBoundaryMessage：保存当前步骤需要读取或更新的数据。
  const errorBoundaryMessage =
    "Consider adding an error boundary to your tree to customize error handling behavior.";
  console.warn("%s\n\n%s\n", componentNameMessage, errorBoundaryMessage);
}

// @beginner: 进入 defaultOnCaughtError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function defaultOnCaughtError(error: unknown, _errorInfo: ErrorInfo): void {
  // @beginner: 声明 componentNameMessage：保存当前步骤需要读取或更新的数据。
  const componentNameMessage = componentName
    ? `The above error occurred in the <${componentName}> component.`
    : "The above error occurred in one of your React components.";
  // @beginner: 声明 recreateMessage：保存当前步骤需要读取或更新的数据。
  const recreateMessage =
    `React will try to recreate this component tree from scratch using the error boundary you provided, ${
      errorBoundaryName ?? "Anonymous"
    }.`;
  console.error("%o\n\n%s\n\n%s\n", error, componentNameMessage, recreateMessage);
}

// @beginner: 进入 defaultOnRecoverableError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function defaultOnRecoverableError(error: unknown, _errorInfo: ErrorInfo): void {
  reportGlobalError(error);
}

// @beginner: 进入 logUncaughtError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logUncaughtError(root: ErrorRoot, errorInfo: CapturedValue<unknown>): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    componentName = errorInfo.source ? getComponentNameFromFiber(errorInfo.source) : null;
    errorBoundaryName = null;
    // @beginner: 声明 maybeAct：保存当前步骤需要读取或更新的数据。
    const maybeAct = ReactSharedInternals as unknown as {
      actQueue?: unknown[] | null;
      thrownErrors?: unknown[];
    };
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (maybeAct.actQueue !== null && maybeAct.actQueue !== undefined) {
      maybeAct.thrownErrors?.push(errorInfo.value);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }

    // @beginner: 声明 onUncaughtError：保存当前步骤需要读取或更新的数据。
    const onUncaughtError = root.onUncaughtError ?? defaultOnUncaughtError;
    onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    setTimeout(() => {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw error;
    });
  }
}

// @beginner: 进入 logCaughtError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logCaughtError(root: ErrorRoot, boundary: Fiber, errorInfo: CapturedValue<unknown>): void {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    componentName = errorInfo.source ? getComponentNameFromFiber(errorInfo.source) : null;
    errorBoundaryName = getComponentNameFromFiber(boundary);
    // @beginner: 声明 onCaughtError：保存当前步骤需要读取或更新的数据。
    const onCaughtError = root.onCaughtError ?? defaultOnCaughtError;
    onCaughtError(errorInfo.value, {
      componentStack: errorInfo.stack,
      errorBoundary: boundary.tag === ClassComponent ? boundary.stateNode : null,
    });
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    setTimeout(() => {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw error;
    });
  }
}

// @beginner: 进入 logRecoverableError：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function logRecoverableError(root: ErrorRoot, errorInfo: CapturedValue<unknown>): void {
  // @beginner: 声明 onRecoverableError：保存当前步骤需要读取或更新的数据。
  const onRecoverableError = root.onRecoverableError ?? defaultOnRecoverableError;
  onRecoverableError(errorInfo.value, { componentStack: errorInfo.stack });
}
