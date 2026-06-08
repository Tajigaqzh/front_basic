import ReactSharedInternals from "shared/ReactSharedInternals.js";
import type { Fiber } from "./ReactInternalTypes.js";

function readActEnvironmentGlobal(): boolean | undefined {
  return (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
}

export function isLegacyActEnvironment(_fiber: Fiber): boolean {
  const explicit = readActEnvironmentGlobal();
  const jestIsDefined = typeof (globalThis as { jest?: unknown }).jest !== "undefined";
  return jestIsDefined && explicit !== false;
}

export function isConcurrentActEnvironment(): boolean | undefined {
  const explicit = readActEnvironmentGlobal();
  const internals = ReactSharedInternals as unknown as { actQueue?: unknown[] | null };
  if (!explicit && internals.actQueue !== null && internals.actQueue !== undefined) {
    console.error("The current testing environment is not configured to support act(...)");
  }
  return explicit;
}
