function shim(): never {
  throw new Error(
    "The current renderer does not support microtasks. This error is likely caused by a bug in React.",
  );
}

export const supportsMicrotasks = false;
export const scheduleMicrotask = shim;
