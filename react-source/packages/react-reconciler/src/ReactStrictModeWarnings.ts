import type { Fiber } from "./ReactInternalTypes.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

type WarningRecord = {
  fiber: Fiber;
  kind: "unsafe-lifecycle" | "legacy-context";
};

const pendingWarnings: WarningRecord[] = [];
const didWarn = new Set<unknown>();

const ReactStrictModeWarnings = {
  recordUnsafeLifecycleWarnings(fiber: Fiber, instance: unknown): void {
    if (didWarn.has(fiber.type)) {
      return;
    }
    const value = instance as {
      componentWillMount?: unknown;
      componentWillReceiveProps?: unknown;
      componentWillUpdate?: unknown;
      UNSAFE_componentWillMount?: unknown;
      UNSAFE_componentWillReceiveProps?: unknown;
      UNSAFE_componentWillUpdate?: unknown;
    };
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
    const names = pendingWarnings
      .filter((warning) => warning.kind === "unsafe-lifecycle")
      .map((warning) => getComponentNameFromFiber(warning.fiber) ?? "Unknown");
    if (names.length > 0) {
      names.forEach((name) => didWarn.add(name));
      console.warn(`Unsafe legacy lifecycle methods were found in: ${Array.from(new Set(names)).join(", ")}`);
    }
    for (let i = pendingWarnings.length - 1; i >= 0; i -= 1) {
      if (pendingWarnings[i].kind === "unsafe-lifecycle") {
        pendingWarnings.splice(i, 1);
      }
    }
  },

  recordLegacyContextWarning(fiber: Fiber, _instance: unknown): void {
    pendingWarnings.push({ fiber, kind: "legacy-context" });
  },

  flushLegacyContextWarning(): void {
    const names = pendingWarnings
      .filter((warning) => warning.kind === "legacy-context")
      .map((warning) => getComponentNameFromFiber(warning.fiber) ?? "Unknown");
    if (names.length > 0) {
      console.warn(`Legacy context API was found in: ${Array.from(new Set(names)).join(", ")}`);
    }
    for (let i = pendingWarnings.length - 1; i >= 0; i -= 1) {
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
