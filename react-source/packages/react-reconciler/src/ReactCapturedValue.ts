import type { Fiber } from "./ReactInternalTypes.js";
import { getStackByFiberInDevAndProd } from "./ReactFiberComponentStack.js";

const CapturedStacks: WeakMap<object, CapturedValue<unknown>> = new WeakMap();

export interface CapturedValue<T> {
  value: T;
  source: Fiber | null;
  stack: string | null;
}

export function createCapturedValueAtFiber<T>(value: T, source: Fiber): CapturedValue<T> {
  if (typeof value === "object" && value !== null) {
    const existing = CapturedStacks.get(value);
    if (existing !== undefined) {
      return existing as CapturedValue<T>;
    }
    const captured: CapturedValue<T> = {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source),
    };
    CapturedStacks.set(value, captured as CapturedValue<unknown>);
    return captured;
  }

  return {
    value,
    source,
    stack: getStackByFiberInDevAndProd(source),
  };
}

export function createCapturedValueFromError(value: Error, stack: string | null): CapturedValue<Error> {
  const captured: CapturedValue<Error> = {
    value,
    source: null,
    stack,
  };
  if (typeof stack === "string") {
    CapturedStacks.set(value, captured as CapturedValue<unknown>);
  }
  return captured;
}
