/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type {
  REACT_CONTEXT_TYPE,
  REACT_CONSUMER_TYPE,
  REACT_PROVIDER_TYPE,
} from "./ReactSymbols.js";

// @beginner: 定义 ReactKey：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactKey = string | number;
// @beginner: 定义 Key：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Key = ReactKey | null;

// @beginner: 定义 ElementType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
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

// @beginner: 定义 Props：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Props = Record<string, unknown> & {
  children?: ReactNode;
};

// @beginner: 定义 FunctionComponent：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type FunctionComponent<P extends Props = Props> = (props: P) => ReactNode;
// @beginner: 定义 ReactText：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactText = string | number;

// @beginner: 定义 ReactNode：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactNode =
  | ReactElement
  | ReactPortal
  | ReactText
  | boolean
  | null
  | undefined
  | ReactNode[];

// @beginner: 定义 ReactElement：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 ReactPortal：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactPortal {
  $$typeof: symbol;
  key: Key;
  children: ReactNode;
  containerInfo: unknown;
  implementation: unknown;
}

// @beginner: 定义 ReactContext：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 Wakeable：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Wakeable {
  then(onFulfill: () => void, onReject: () => void): void | Wakeable;
}

// @beginner: 定义 PendingThenable：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PendingThenable<T> {
  status: "pending";
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

// @beginner: 定义 FulfilledThenable：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface FulfilledThenable<T> {
  status: "fulfilled";
  value: T;
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

// @beginner: 定义 RejectedThenable：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface RejectedThenable<T> {
  status: "rejected";
  reason: unknown;
  then(
    onFulfill: (value: T) => void,
    onReject: (error: unknown) => void,
  ): void | Wakeable;
}

// @beginner: 定义 Thenable：给复杂数据结构起名字，后续代码会按这个形状传递数据。
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

// @beginner: 定义 StateAction：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type StateAction<S> = S | ((prevState: S) => S);
// @beginner: 定义 Dispatch：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Dispatch<A> = (action: A) => void;

// @beginner: 定义 Dispatcher：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 ReactCallSite：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactCallSite = [
  string,
  string,
  number,
  number,
  number,
  number,
  boolean,
];

// @beginner: 定义 ReactStackTrace：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactStackTrace = ReactCallSite[];

// @beginner: 定义 ReactFunctionLocation：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactFunctionLocation = [
  string,
  string,
  number,
  number,
];

// @beginner: 定义 ReactComponentInfo：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 ReactEnvironmentInfo：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactEnvironmentInfo {
  env: string;
}

// @beginner: 定义 JSONValue：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type JSONValue =
  | string
  | boolean
  | number
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

// @beginner: 定义 ReactErrorInfoProd：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactErrorInfoProd {
  digest: string;
}

// @beginner: 定义 ReactErrorInfoDev：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 ReactErrorInfo：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactErrorInfo = ReactErrorInfoProd | ReactErrorInfoDev;

// @beginner: 定义 ReactIOInfo：描述对象需要具备哪些字段，方便读者理解数据形状。
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

// @beginner: 定义 ReactAsyncInfo：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactAsyncInfo {
  awaited: ReactIOInfo;
  env?: string;
  owner?: null | ReactComponentInfo;
  stack?: null | ReactStackTrace;
  debugStack?: null | Error;
  debugTask?: null | unknown;
}

// @beginner: 定义 ReactTimeInfo：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactTimeInfo {
  time: number;
}

// @beginner: 定义 ReactDebugInfoEntry：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactDebugInfoEntry =
  | ReactComponentInfo
  | ReactEnvironmentInfo
  | ReactAsyncInfo
  | ReactTimeInfo;

// @beginner: 定义 ReactDebugInfo：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactDebugInfo = ReactDebugInfoEntry[];
