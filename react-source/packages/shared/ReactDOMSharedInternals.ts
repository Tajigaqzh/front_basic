type ResourceOptions = Record<string, unknown> | undefined;

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

const noop = () => undefined;

export interface ReactDOMSharedState {
  d: ReactDOMCurrentDispatcher;
  p: number;
}

const ReactDOMSharedInternalsKey = Symbol.for("front.reactDOM.sharedInternals");
const globalWithReactDOMSharedInternals = globalThis as typeof globalThis & {
  [ReactDOMSharedInternalsKey]?: ReactDOMSharedState;
};

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
