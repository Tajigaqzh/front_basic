/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 NavigationLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type NavigationLike = EventTarget & {
  transition?: unknown;
  currentEntry?: {
    url?: string | null;
    getState(): unknown;
  } | null;
  navigate(url: string, options: Record<string, unknown>): void;
};

// @beginner: 定义 NavigateEventLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type NavigateEventLike = Event & {
  canIntercept?: boolean;
  info?: unknown;
  intercept(options: {
    handler(): Promise<unknown>;
    focusReset: "manual";
    scroll: "manual";
  }): void;
};

// @beginner: 进入 getNavigation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getNavigation(): NavigationLike | null {
  // @beginner: 声明 maybeNavigation：保存当前步骤需要读取或更新的数据。
  const maybeNavigation = (globalThis as typeof globalThis & { navigation?: NavigationLike }).navigation;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof maybeNavigation === "object" && maybeNavigation !== null ? maybeNavigation : null;
}

// @beginner: 进入 defaultOnDefaultTransitionIndicator：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function defaultOnDefaultTransitionIndicator(): void | (() => void) {
  // @beginner: 声明 navigation：保存当前步骤需要读取或更新的数据。
  const navigation = getNavigation();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (navigation === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 声明 currentNavigation：保存当前步骤需要读取或更新的数据。
  const currentNavigation = navigation;

  // @beginner: 声明 isCancelled：保存当前步骤需要读取或更新的数据。
  let isCancelled = false;
  // @beginner: 声明 pendingResolve：保存当前步骤需要读取或更新的数据。
  let pendingResolve: (() => void) | null = null;

  // @beginner: 进入 handleNavigate：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function handleNavigate(event: Event): void {
    // @beginner: 声明 navigateEvent：保存当前步骤需要读取或更新的数据。
    const navigateEvent = event as NavigateEventLike;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (navigateEvent.canIntercept && navigateEvent.info === "react-transition") {
      navigateEvent.intercept({
        handler() {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return new Promise((resolve) => {
            pendingResolve = () => resolve(undefined);
          });
        },
        focusReset: "manual",
        scroll: "manual",
      });
    }
  }

  // @beginner: 进入 startFakeNavigation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function startFakeNavigation(): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (isCancelled || currentNavigation.transition) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 currentEntry：保存当前步骤需要读取或更新的数据。
    const currentEntry = currentNavigation.currentEntry;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (currentEntry?.url != null) {
      currentNavigation.navigate(currentEntry.url, {
        state: currentEntry.getState(),
        info: "react-transition",
        history: "replace",
      });
    }
  }

  // @beginner: 进入 handleNavigateComplete：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function handleNavigateComplete(): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (pendingResolve !== null) {
      pendingResolve();
      pendingResolve = null;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!isCancelled) {
      setTimeout(startFakeNavigation, 20);
    }
  }

  currentNavigation.addEventListener("navigate", handleNavigate);
  currentNavigation.addEventListener("navigatesuccess", handleNavigateComplete);
  currentNavigation.addEventListener("navigateerror", handleNavigateComplete);
  setTimeout(startFakeNavigation, 100);

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return function cancelDefaultTransitionIndicator(): void {
    isCancelled = true;
    currentNavigation.removeEventListener("navigate", handleNavigate);
    currentNavigation.removeEventListener("navigatesuccess", handleNavigateComplete);
    currentNavigation.removeEventListener("navigateerror", handleNavigateComplete);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (pendingResolve !== null) {
      pendingResolve();
      pendingResolve = null;
    }
  };
}
