import ReactSharedInternals from "shared/ReactSharedInternals.js";
import reportGlobalError from "shared/reportGlobalError.js";
import type { CapturedValue } from "./ReactCapturedValue.js";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
import { ClassComponent } from "./ReactWorkTags.js";

type ErrorInfo = {
  componentStack?: string | null;
  errorBoundary?: unknown;
};

type ErrorRoot = FiberRoot & {
  onUncaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onCaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
};

let componentName: string | null = null;
let errorBoundaryName: string | null = null;

export function defaultOnUncaughtError(error: unknown, _errorInfo: ErrorInfo): void {
  reportGlobalError(error);
  const componentNameMessage = componentName
    ? `An error occurred in the <${componentName}> component.`
    : "An error occurred in one of your React components.";
  const errorBoundaryMessage =
    "Consider adding an error boundary to your tree to customize error handling behavior.";
  console.warn("%s\n\n%s\n", componentNameMessage, errorBoundaryMessage);
}

export function defaultOnCaughtError(error: unknown, _errorInfo: ErrorInfo): void {
  const componentNameMessage = componentName
    ? `The above error occurred in the <${componentName}> component.`
    : "The above error occurred in one of your React components.";
  const recreateMessage =
    `React will try to recreate this component tree from scratch using the error boundary you provided, ${
      errorBoundaryName ?? "Anonymous"
    }.`;
  console.error("%o\n\n%s\n\n%s\n", error, componentNameMessage, recreateMessage);
}

export function defaultOnRecoverableError(error: unknown, _errorInfo: ErrorInfo): void {
  reportGlobalError(error);
}

export function logUncaughtError(root: ErrorRoot, errorInfo: CapturedValue<unknown>): void {
  try {
    componentName = errorInfo.source ? getComponentNameFromFiber(errorInfo.source) : null;
    errorBoundaryName = null;
    const maybeAct = ReactSharedInternals as unknown as {
      actQueue?: unknown[] | null;
      thrownErrors?: unknown[];
    };
    if (maybeAct.actQueue !== null && maybeAct.actQueue !== undefined) {
      maybeAct.thrownErrors?.push(errorInfo.value);
      return;
    }

    const onUncaughtError = root.onUncaughtError ?? defaultOnUncaughtError;
    onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

export function logCaughtError(root: ErrorRoot, boundary: Fiber, errorInfo: CapturedValue<unknown>): void {
  try {
    componentName = errorInfo.source ? getComponentNameFromFiber(errorInfo.source) : null;
    errorBoundaryName = getComponentNameFromFiber(boundary);
    const onCaughtError = root.onCaughtError ?? defaultOnCaughtError;
    onCaughtError(errorInfo.value, {
      componentStack: errorInfo.stack,
      errorBoundary: boundary.tag === ClassComponent ? boundary.stateNode : null,
    });
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

export function logRecoverableError(root: ErrorRoot, errorInfo: CapturedValue<unknown>): void {
  const onRecoverableError = root.onRecoverableError ?? defaultOnRecoverableError;
  onRecoverableError(errorInfo.value, { componentStack: errorInfo.stack });
}
