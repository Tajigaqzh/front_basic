/**
 * @beginner-module: 源码导读
 * 本文件是 React 对外暴露的 Hook API，实际实现由 reconciler 的 dispatcher 决定。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ReactSharedInternals } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Dispatch, ReactContext, StateAction } from "shared";

// @beginner: 进入 resolveDispatcher：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function resolveDispatcher() {
  // React 包本身不知道当前是 mount 还是 update。
  // 真正的 Hook 实现在 react-reconciler 里，reconciler 在函数组件渲染前
  // 会把 ReactSharedInternals.H 切换成 mount/update dispatcher。
  // @beginner: dispatcher 是当前渲染期的 Hook 实现表；renderWithHooks 会负责设置它。
  const dispatcher = ReactSharedInternals.H;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher === null) {
    // 如果不在函数组件渲染期间调用 Hook，dispatcher 为空。
    // 这就是“Hooks 只能在函数组件顶层调用”的运行时保护入口。
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Hooks 只能在函数组件渲染期间调用");
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher;
}

// @beginner: 进入 useState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useState<S>(initialState: S | (() => S)): [S, Dispatch<StateAction<S>>] {
  // public useState 只是转发。mountState/updateState 的选择由当前 dispatcher 决定。
  // @beginner: 取出当前 dispatcher 后，useState 才知道该走 mountState 还是 updateState。
  const dispatcher = resolveDispatcher();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher.useState(initialState);
}

// @beginner: 进入 useContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useContext<T>(context: ReactContext<T>): T {
  // useContext 不创建 Hook 链表节点，它读取当前渲染 Fiber 的 context 依赖。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveDispatcher().useContext(context);
}

// @beginner: 进入 useReducer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: (initialArg: S) => S,
): [S, Dispatch<A>] {
  // useReducer 是 useState 的通用版本：state 如何变化完全由 reducer(action) 决定。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveDispatcher().useReducer(reducer, initialArg, init);
}

// @beginner: 进入 useRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useRef<T>(initialValue: T): { current: T } {
  // useRef 返回同一个对象引用；更新 current 不会触发重新渲染。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveDispatcher().useRef(initialValue);
}

// @beginner: 进入 useMemo：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  // useMemo 把 [计算结果, deps] 存在 Hook 节点上；deps 不变时直接复用旧结果。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveDispatcher().useMemo(create, deps);
}

// @beginner: 进入 useCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  // useCallback 本质上是 useMemo(() => callback, deps)，缓存的是函数引用。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveDispatcher().useCallback(callback, deps);
}

// @beginner: 进入 useEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // useEffect 不在 render 阶段执行 create，只登记 effect；commit 后再统一执行。
  resolveDispatcher().useEffect(create, deps);
}

// @beginner: 进入 useInsertionEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: 复用 dispatcher 是为了在不同 renderer/reconciler 下切换实现。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useInsertionEffect === undefined) {
    // 复刻版保留兼容降级：没有 insertion dispatcher 时退化成普通 effect。
    dispatcher.useEffect(create, deps);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  dispatcher.useInsertionEffect(create, deps);
}

// @beginner: 进入 useLayoutEffect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  // @beginner: layout effect 如果没有专门实现，就退化为普通 effect。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useLayoutEffect === undefined) {
    // 没有 layout dispatcher 时退化成普通 effect，便于阅读版保持 API 可用。
    dispatcher.useEffect(create, deps);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  dispatcher.useLayoutEffect(create, deps);
}

// @beginner: 进入 useImperativeHandle：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  // @beginner: imperative handle 需要 dispatcher 支持 ref 赋值时机。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useImperativeHandle === undefined) {
    // 未实现该 Hook 时静默跳过，避免破坏主渲染链路。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  dispatcher.useImperativeHandle(ref, create, deps);
}

// @beginner: 进入 useTransition：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useTransition(): [boolean, (callback: () => void) => void] {
  // @beginner: transition 依赖调度器能力，缺失时使用同步兜底。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useTransition === undefined) {
    // 简化降级：没有 transition 调度时直接同步执行 callback。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return [false, (callback) => callback()];
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher.useTransition();
}

// @beginner: 进入 useDeferredValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useDeferredValue<T>(value: T, initialValue?: T): T {
  // @beginner: deferred value 依赖低优先级更新能力，缺失时直接返回输入值。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useDeferredValue === undefined) {
    // 简化降级：没有低优先级延迟能力时，直接返回当前值或初始值。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return initialValue ?? value;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher.useDeferredValue(value, initialValue);
}

// @beginner: 进入 useId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useId(): string {
  // @beginner: useId 的真实实现依赖当前渲染树位置，因此也走 dispatcher。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useId === undefined) {
    // 没有 dispatcher 时提供稳定兜底值；真实实现会按树位置生成可 hydration 的 id。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return ":r0:";
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return dispatcher.useId();
}

// @beginner: 进入 useSyncExternalStore：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot,
): Snapshot {
  // @beginner: external store 的完整实现需要订阅当前 Fiber，所以优先使用 dispatcher。
  const dispatcher = resolveDispatcher();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher.useSyncExternalStore !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }
  // 简化兜底：订阅后立即取消，只读取一次 snapshot。
  // 真正实现会在外部 store 变化时调度当前 Fiber 更新。
  subscribe(() => undefined)();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getSnapshot();
}
