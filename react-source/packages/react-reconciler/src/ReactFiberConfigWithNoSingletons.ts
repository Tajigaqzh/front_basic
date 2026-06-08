function shim(): never {
  throw new Error(
    "The current renderer does not support Singletons. This error is likely caused by a bug in React.",
  );
}

export const supportsSingletons = false;
export const resolveSingletonInstance = shim;
export const acquireSingletonInstance = shim;
export const releaseSingletonInstance = shim;
export const isHostSingletonType = shim;
export const isSingletonScope = shim;
