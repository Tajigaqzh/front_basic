import { ReactSharedInternals } from "shared";
import type { Dispatch, ReactContext, StateAction } from "shared";

function resolveDispatcher() {
  const dispatcher = ReactSharedInternals.H;
  if (dispatcher === null) {
    throw new Error("Hooks 只能在函数组件渲染期间调用");
  }

  return dispatcher;
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<StateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useContext<T>(context: ReactContext<T>): T {
  return resolveDispatcher().useContext(context);
}

export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: (initialArg: S) => S,
): [S, Dispatch<A>] {
  return resolveDispatcher().useReducer(reducer, initialArg, init);
}

export function useRef<T>(initialValue: T): { current: T } {
  return resolveDispatcher().useRef(initialValue);
}

export function useMemo<T>(create: () => T, deps: unknown[] | undefined): T {
  return resolveDispatcher().useMemo(create, deps);
}

export function useCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined,
): T {
  return resolveDispatcher().useCallback(callback, deps);
}

export function useEffect(create: () => void | (() => void), deps?: unknown[]): void {
  resolveDispatcher().useEffect(create, deps);
}

export function useInsertionEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useInsertionEffect === undefined) {
    dispatcher.useEffect(create, deps);
    return;
  }
  dispatcher.useInsertionEffect(create, deps);
}

export function useLayoutEffect(create: () => void | (() => void), deps?: unknown[]): void {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useLayoutEffect === undefined) {
    dispatcher.useEffect(create, deps);
    return;
  }
  dispatcher.useLayoutEffect(create, deps);
}

export function useImperativeHandle<T>(
  ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useImperativeHandle === undefined) {
    return;
  }
  dispatcher.useImperativeHandle(ref, create, deps);
}

export function useTransition(): [boolean, (callback: () => void) => void] {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useTransition === undefined) {
    return [false, (callback) => callback()];
  }
  return dispatcher.useTransition();
}

export function useDeferredValue<T>(value: T, initialValue?: T): T {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useDeferredValue === undefined) {
    return initialValue ?? value;
  }
  return dispatcher.useDeferredValue(value, initialValue);
}

export function useId(): string {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useId === undefined) {
    return ":r0:";
  }
  return dispatcher.useId();
}

export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot,
): Snapshot {
  const dispatcher = resolveDispatcher();
  if (dispatcher.useSyncExternalStore !== undefined) {
    return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }
  subscribe(() => undefined)();
  return getSnapshot();
}
