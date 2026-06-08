import { REACT_LAZY_TYPE, type ElementType } from "shared";

type Thenable<T> = Promise<{ default: T }>;

export interface LazyComponent<T extends ElementType = ElementType> {
  $$typeof: typeof REACT_LAZY_TYPE;
  _payload: {
    status: "uninitialized" | "pending" | "resolved" | "rejected";
    result: (() => Thenable<T>) | Thenable<T> | T | unknown;
  };
  _init: (payload: LazyComponent<T>["_payload"]) => T;
}

export function lazy<T extends ElementType>(ctor: () => Thenable<T>): LazyComponent<T> {
  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: {
      status: "uninitialized",
      result: ctor,
    },
    _init: lazyInitializer,
  };
}

function lazyInitializer<T extends ElementType>(payload: LazyComponent<T>["_payload"]): T {
  if (payload.status === "resolved") {
    return payload.result as T;
  }

  if (payload.status === "rejected") {
    throw payload.result;
  }

  if (payload.status === "uninitialized") {
    const ctor = payload.result as () => Thenable<T>;
    const thenable = ctor();
    payload.status = "pending";
    payload.result = thenable;
    thenable.then(
      (moduleObject) => {
        payload.status = "resolved";
        payload.result = moduleObject.default;
      },
      (error) => {
        payload.status = "rejected";
        payload.result = error;
      },
    );
  }

  throw payload.result;
}
