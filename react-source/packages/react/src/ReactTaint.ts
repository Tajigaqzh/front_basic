/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enableTaint } from "shared/ReactFeatureFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getPrototypeOf from "shared/getPrototypeOf.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import binaryToComparableString from "shared/binaryToComparableString.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "./ReactSharedInternalsServer.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Reference } from "./ReactTaintRegistry.js";

// @beginner: 声明 TypedArrayConstructor：保存当前步骤需要读取或更新的数据。
const TypedArrayConstructor = getPrototypeOf(Uint32Array.prototype).constructor;

// @beginner: 声明 defaultMessage：保存当前步骤需要读取或更新的数据。
const defaultMessage =
  "A tainted value was attempted to be serialized to a Client Component or Action closure. This would leak it to the client.";

// @beginner: 进入 normalizeMessage：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function normalizeMessage(message: string | null | undefined): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return String(message || defaultMessage);
}

// @beginner: 进入 cleanup：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function cleanup(entryValue: string | bigint): void {
  // @beginner: 声明 entry：保存当前步骤需要读取或更新的数据。
  const entry = ReactSharedInternals.TaintRegistryValues.get(entryValue);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (entry !== undefined) {
    // 与官方源码一致：已有请求要在本次 lifetime 结束后重新检查该 value。
    ReactSharedInternals.TaintRegistryPendingRequests.forEach((requestQueue) => {
      requestQueue.push(entryValue);
      entry.count += 1;
    });

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (entry.count === 1) {
      ReactSharedInternals.TaintRegistryValues.delete(entryValue);
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      entry.count -= 1;
    }
  }
}

// 如果运行时没有 FinalizationRegistry，就把整个 VM 生命周期当作请求生命周期。
// @beginner: 声明 finalizationRegistry：保存当前步骤需要读取或更新的数据。
const finalizationRegistry =
  typeof FinalizationRegistry === "function" ? new FinalizationRegistry<string | bigint>(cleanup) : null;

// @beginner: 进入 taintUniqueValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function taintUniqueValue(
  message: string | null | undefined,
  lifetime: Reference,
  value: string | bigint | ArrayBufferView,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableTaint) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Not implemented.");
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lifetime === null || (typeof lifetime !== "object" && typeof lifetime !== "function")) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("To taint a value, a lifetime must be defined by passing an object that holds the value.");
  }

  // @beginner: 声明 entryValue：保存当前步骤需要读取或更新的数据。
  let entryValue: string | bigint;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "string" || typeof value === "bigint") {
    entryValue = value;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (value instanceof TypedArrayConstructor || value instanceof DataView) {
    ReactSharedInternals.TaintRegistryByteLengths.add(value.byteLength);
    entryValue = binaryToComparableString(value);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: 声明 kind：保存当前步骤需要读取或更新的数据。
    const kind = value === null ? "null" : typeof value;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (kind === "object" || kind === "function") {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error("taintUniqueValue cannot taint objects or functions. Try taintObjectReference instead.");
    }
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error(
      "Cannot taint a " + kind + " because the value is too general and not unique enough to block globally.",
    );
  }

  // @beginner: 声明 existingEntry：保存当前步骤需要读取或更新的数据。
  const existingEntry = ReactSharedInternals.TaintRegistryValues.get(entryValue);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (existingEntry === undefined) {
    ReactSharedInternals.TaintRegistryValues.set(entryValue, {
      message: normalizeMessage(message),
      count: 1,
    });
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    existingEntry.count += 1;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (finalizationRegistry !== null) {
    finalizationRegistry.register(lifetime, entryValue);
  }
}

// @beginner: 进入 taintObjectReference：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function taintObjectReference(
  message: string | null | undefined,
  object: Reference,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableTaint) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Not implemented.");
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof object === "string" || typeof object === "bigint") {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Only objects or functions can be passed to taintObjectReference. Try taintUniqueValue instead.");
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (object === null || (typeof object !== "object" && typeof object !== "function")) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("Only objects or functions can be passed to taintObjectReference.");
  }
  ReactSharedInternals.TaintRegistryObjects.set(object, normalizeMessage(message));
}
