/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ResourceOptions：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ResourceOptions = Record<string, unknown> | undefined;

// @beginner: 定义 ReactDOMCurrentDispatcher：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactDOMCurrentDispatcher {
  f(): boolean | void;
  r(): void;
  D(href: string): void;
  C(href: string, crossOrigin?: string): void;
  L(href: string, as: string, options?: ResourceOptions): void;
  m(href: string, options?: ResourceOptions): void;
  X(href: string, options?: ResourceOptions): void;
  S(href: string, precedence?: string, options?: ResourceOptions): void;
  M(href: string, options?: ResourceOptions): void;
}

// @beginner: 定义 noop：空函数占位，表示当前回调什么都不做。
const noop = () => undefined;

// @beginner: 定义 ReactDOMSharedState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactDOMSharedState {
  d: ReactDOMCurrentDispatcher;
  p: number;
}

// @beginner: 声明 ReactDOMSharedInternalsKey：保存当前步骤需要读取或更新的数据。
const ReactDOMSharedInternalsKey = Symbol.for("front.reactDOM.sharedInternals");
// @beginner: 声明 globalWithReactDOMSharedInternals：保存当前步骤需要读取或更新的数据。
const globalWithReactDOMSharedInternals = globalThis as typeof globalThis & {
  [ReactDOMSharedInternalsKey]?: ReactDOMSharedState;
};

// @beginner: 声明 ReactDOMSharedInternals：保存当前步骤需要读取或更新的数据。
const ReactDOMSharedInternals: ReactDOMSharedState = (globalWithReactDOMSharedInternals[ReactDOMSharedInternalsKey] ??= {
  d: {
    f: noop,
    r: noop,
    D: noop,
    C: noop,
    L: noop,
    m: noop,
    X: noop,
    S: noop,
    M: noop,
  },
  p: 0,
});

export default ReactDOMSharedInternals;
