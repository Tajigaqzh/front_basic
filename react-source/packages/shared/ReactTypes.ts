import type { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
import type {
  REACT_CONTEXT_TYPE,
  REACT_CONSUMER_TYPE,
  REACT_PROVIDER_TYPE,
} from "./ReactSymbols.js";

export type ReactKey = string | number;
export type Key = ReactKey | null;

export type ElementType =
  | string
  | FunctionComponent<Record<string, unknown>>
  | symbol
  | {
      $$typeof?: symbol;
      render?: FunctionComponent;
      type?: ElementType;
      _payload?: unknown;
      _init?: (payload: unknown) => ElementType;
    };

export type Props = Record<string, unknown> & {
  children?: ReactNode;
};

export type FunctionComponent<P extends Props = Props> = (props: P) => ReactNode;
export type ReactText = string | number;

export type ReactNode =
  | ReactElement
  | ReactPortal
  | ReactText
  | boolean
  | null
  | undefined
  | ReactNode[];

export interface ReactElement<P extends Props = Props> {
  $$typeof: typeof REACT_ELEMENT_TYPE;
  type: ElementType;
  key: Key;
  props: P;
  _owner?: unknown;
  _debugInfo?: null | ReactDebugInfo;
  _debugStack?: Error;
  _debugTask?: null | unknown;
}

export interface ReactPortal {
  $$typeof: symbol;
  key: Key;
  children: ReactNode;
  containerInfo: unknown;
  implementation: unknown;
}

export interface ReactContext<T> {
  $$typeof: typeof REACT_CONTEXT_TYPE;
  _currentValue: T;
  _currentValue2: T;
  _currentRenderer?: unknown;
  _currentRenderer2?: unknown;
  Provider: {
    $$typeof: typeof REACT_PROVIDER_TYPE;
    _context: ReactContext<T>;
  };
  Consumer: {
    $$typeof: typeof REACT_CONSUMER_TYPE;
    _context: ReactContext<T>;
  };
  displayName?: string;
}

export interface Wakeable {
  then(onFulfill: () => void, onReject: () => void): void | Wakeable;
}

export interface PendingThenable<T> {
  status: "pending";
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

export interface FulfilledThenable<T> {
  status: "fulfilled";
  value: T;
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

export interface RejectedThenable<T> {
  status: "rejected";
  reason: unknown;
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

export type Thenable<T> =
  | PendingThenable<T>
  | FulfilledThenable<T>
  | RejectedThenable<T>
  | {
      status?: string;
      value?: T;
      reason?: unknown;
      then(
        onFulfill: (value: T) => void,
        onReject: (error: unknown) => void,
      ): void | Wakeable;
    };

export type StateAction<S> = S | ((prevState: S) => S);
export type Dispatch<A> = (action: A) => void;

export interface Dispatcher {
  readContext<T>(context: ReactContext<T>): T;
  useContext<T>(context: ReactContext<T>): T;
  useState<S>(initialState: S | (() => S)): [S, Dispatch<StateAction<S>>];
  useReducer<S, A>(
    reducer: (state: S, action: A) => S,
    initialArg: S,
    init?: (initialArg: S) => S,
  ): [S, Dispatch<A>];
  useRef<T>(initialValue: T): { current: T };
  useMemo<T>(create: () => T, deps: unknown[] | undefined): T;
  useCallback<T extends (...args: any[]) => unknown>(callback: T, deps: unknown[] | undefined): T;
  useEffect(create: () => void | (() => void), deps?: unknown[]): void;
  useInsertionEffect?(create: () => void | (() => void), deps?: unknown[]): void;
  useLayoutEffect?(create: () => void | (() => void), deps?: unknown[]): void;
  useImperativeHandle?<T>(
    ref: { current: T | null } | ((instance: T | null) => void) | null | undefined,
    create: () => T,
    deps?: unknown[],
  ): void;
  useTransition?(): [boolean, (callback: () => void) => void];
  useDeferredValue?<T>(value: T, initialValue?: T): T;
  useId?(): string;
  useSyncExternalStore?<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot,
  ): Snapshot;
}

export type ReactCallSite = [
  string,
  string,
  number,
  number,
  number,
  number,
  boolean,
];

export type ReactStackTrace = ReactCallSite[];

export type ReactFunctionLocation = [
  string,
  string,
  number,
  number,
];

export interface ReactComponentInfo {
  name: string;
  env?: string;
  key?: ReactKey;
  owner?: null | ReactComponentInfo;
  stack?: null | ReactStackTrace;
  props?: null | Record<string, unknown>;
  debugStack?: null | Error;
  debugTask?: null | unknown;
  debugLocation?: null | Error;
}

export interface ReactEnvironmentInfo {
  env: string;
}

export type JSONValue =
  | string
  | boolean
  | number
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

export interface ReactErrorInfoProd {
  digest: string;
}

export interface ReactErrorInfoDev {
  digest?: string;
  name: string;
  message: string;
  stack: ReactStackTrace;
  env: string;
  owner?: null | string;
  cause?: JSONValue;
  errors?: JSONValue;
}

export type ReactErrorInfo = ReactErrorInfoProd | ReactErrorInfoDev;

export interface ReactIOInfo {
  name: string;
  start: number;
  end: number;
  byteSize?: number;
  value?: null | Promise<unknown>;
  env?: string;
  owner?: null | ReactComponentInfo;
  stack?: null | ReactStackTrace;
  debugStack?: null | Error;
  debugTask?: null | unknown;
}

export interface ReactAsyncInfo {
  awaited: ReactIOInfo;
  env?: string;
  owner?: null | ReactComponentInfo;
  stack?: null | ReactStackTrace;
  debugStack?: null | Error;
  debugTask?: null | unknown;
}

export interface ReactTimeInfo {
  time: number;
}

export type ReactDebugInfoEntry =
  | ReactComponentInfo
  | ReactEnvironmentInfo
  | ReactAsyncInfo
  | ReactTimeInfo;

export type ReactDebugInfo = ReactDebugInfoEntry[];
