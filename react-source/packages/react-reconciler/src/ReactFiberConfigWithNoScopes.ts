function shim(): never {
  throw new Error(
    "The current renderer does not support React Scopes. This error is likely caused by a bug in React.",
  );
}

export const prepareScopeUpdate = shim;
export const getInstanceFromScope = shim;
