/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

// @beginner: 定义 WarningRecord：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type WarningRecord = {
  fiber: Fiber;
  kind: "unsafe-lifecycle" | "legacy-context";
};

// @beginner: 声明 pendingWarnings：保存当前步骤需要读取或更新的数据。
const pendingWarnings: WarningRecord[] = [];
// @beginner: 声明 didWarn：保存当前步骤需要读取或更新的数据。
const didWarn = new Set<unknown>();

// @beginner: 声明 ReactStrictModeWarnings：保存当前步骤需要读取或更新的数据。
const ReactStrictModeWarnings = {
  recordUnsafeLifecycleWarnings(fiber: Fiber, instance: unknown): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (didWarn.has(fiber.type)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
    const value = instance as {
      componentWillMount?: unknown;
      componentWillReceiveProps?: unknown;
      componentWillUpdate?: unknown;
      UNSAFE_componentWillMount?: unknown;
      UNSAFE_componentWillReceiveProps?: unknown;
      UNSAFE_componentWillUpdate?: unknown;
    };
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (
      typeof value.componentWillMount === "function" ||
      typeof value.componentWillReceiveProps === "function" ||
      typeof value.componentWillUpdate === "function" ||
      typeof value.UNSAFE_componentWillMount === "function" ||
      typeof value.UNSAFE_componentWillReceiveProps === "function" ||
      typeof value.UNSAFE_componentWillUpdate === "function"
    ) {
      pendingWarnings.push({ fiber, kind: "unsafe-lifecycle" });
    }
  },

  flushPendingUnsafeLifecycleWarnings(): void {
    // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
    const names = pendingWarnings
      .filter((warning) => warning.kind === "unsafe-lifecycle")
      .map((warning) => getComponentNameFromFiber(warning.fiber) ?? "Unknown");
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (names.length > 0) {
      names.forEach((name) => didWarn.add(name));
      console.warn(`Unsafe legacy lifecycle methods were found in: ${Array.from(new Set(names)).join(", ")}`);
    }
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = pendingWarnings.length - 1; i >= 0; i -= 1) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (pendingWarnings[i].kind === "unsafe-lifecycle") {
        pendingWarnings.splice(i, 1);
      }
    }
  },

  recordLegacyContextWarning(fiber: Fiber, _instance: unknown): void {
    pendingWarnings.push({ fiber, kind: "legacy-context" });
  },

  flushLegacyContextWarning(): void {
    // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
    const names = pendingWarnings
      .filter((warning) => warning.kind === "legacy-context")
      .map((warning) => getComponentNameFromFiber(warning.fiber) ?? "Unknown");
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (names.length > 0) {
      console.warn(`Legacy context API was found in: ${Array.from(new Set(names)).join(", ")}`);
    }
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = pendingWarnings.length - 1; i >= 0; i -= 1) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (pendingWarnings[i].kind === "legacy-context") {
        pendingWarnings.splice(i, 1);
      }
    }
  },

  discardPendingWarnings(): void {
    pendingWarnings.length = 0;
  },
};

export default ReactStrictModeWarnings;
