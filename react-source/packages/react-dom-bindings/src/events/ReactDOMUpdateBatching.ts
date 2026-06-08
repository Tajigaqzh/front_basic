let isInsideEventHandler = false;

export function batchedUpdates<T>(fn: () => T): T {
  if (isInsideEventHandler) {
    return fn();
  }

  isInsideEventHandler = true;
  try {
    return fn();
  } finally {
    isInsideEventHandler = false;
  }
}

export function discreteUpdates<T>(fn: () => T): T {
  return batchedUpdates(fn);
}
