import { enableTaint } from "shared/ReactFeatureFlags.js";
import getPrototypeOf from "shared/getPrototypeOf.js";
import binaryToComparableString from "shared/binaryToComparableString.js";
import ReactSharedInternals from "./ReactSharedInternalsServer.js";
import type { Reference } from "./ReactTaintRegistry.js";

const TypedArrayConstructor = getPrototypeOf(Uint32Array.prototype).constructor;

const defaultMessage =
  "A tainted value was attempted to be serialized to a Client Component or Action closure. This would leak it to the client.";

function normalizeMessage(message: string | null | undefined): string {
  return String(message || defaultMessage);
}

function cleanup(entryValue: string | bigint): void {
  const entry = ReactSharedInternals.TaintRegistryValues.get(entryValue);
  if (entry !== undefined) {
    // 与官方源码一致：已有请求要在本次 lifetime 结束后重新检查该 value。
    ReactSharedInternals.TaintRegistryPendingRequests.forEach((requestQueue) => {
      requestQueue.push(entryValue);
      entry.count += 1;
    });

    if (entry.count === 1) {
      ReactSharedInternals.TaintRegistryValues.delete(entryValue);
    } else {
      entry.count -= 1;
    }
  }
}

// 如果运行时没有 FinalizationRegistry，就把整个 VM 生命周期当作请求生命周期。
const finalizationRegistry =
  typeof FinalizationRegistry === "function" ? new FinalizationRegistry<string | bigint>(cleanup) : null;

export function taintUniqueValue(
  message: string | null | undefined,
  lifetime: Reference,
  value: string | bigint | ArrayBufferView,
): void {
  if (!enableTaint) {
    throw new Error("Not implemented.");
  }
  if (lifetime === null || (typeof lifetime !== "object" && typeof lifetime !== "function")) {
    throw new Error("To taint a value, a lifetime must be defined by passing an object that holds the value.");
  }

  let entryValue: string | bigint;
  if (typeof value === "string" || typeof value === "bigint") {
    entryValue = value;
  } else if (value instanceof TypedArrayConstructor || value instanceof DataView) {
    ReactSharedInternals.TaintRegistryByteLengths.add(value.byteLength);
    entryValue = binaryToComparableString(value);
  } else {
    const kind = value === null ? "null" : typeof value;
    if (kind === "object" || kind === "function") {
      throw new Error("taintUniqueValue cannot taint objects or functions. Try taintObjectReference instead.");
    }
    throw new Error(
      "Cannot taint a " + kind + " because the value is too general and not unique enough to block globally.",
    );
  }

  const existingEntry = ReactSharedInternals.TaintRegistryValues.get(entryValue);
  if (existingEntry === undefined) {
    ReactSharedInternals.TaintRegistryValues.set(entryValue, {
      message: normalizeMessage(message),
      count: 1,
    });
  } else {
    existingEntry.count += 1;
  }

  if (finalizationRegistry !== null) {
    finalizationRegistry.register(lifetime, entryValue);
  }
}

export function taintObjectReference(
  message: string | null | undefined,
  object: Reference,
): void {
  if (!enableTaint) {
    throw new Error("Not implemented.");
  }
  if (typeof object === "string" || typeof object === "bigint") {
    throw new Error("Only objects or functions can be passed to taintObjectReference. Try taintUniqueValue instead.");
  }
  if (object === null || (typeof object !== "object" && typeof object !== "function")) {
    throw new Error("Only objects or functions can be passed to taintObjectReference.");
  }
  ReactSharedInternals.TaintRegistryObjects.set(object, normalizeMessage(message));
}
