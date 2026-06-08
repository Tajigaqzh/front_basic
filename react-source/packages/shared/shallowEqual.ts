import objectIs from "./objectIs.js";

export default function shallowEqual(objA: unknown, objB: unknown): boolean {
  if (objectIs(objA, objB)) {
    return true;
  }

  if (!isObject(objA) || !isObject(objB)) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !objectIs(objA[key], objB[key])) {
      return false;
    }
  }

  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
