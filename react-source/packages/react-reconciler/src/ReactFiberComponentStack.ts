import getComponentNameFromFiber from "./getComponentNameFromFiber.js";
import type { Fiber } from "./ReactInternalTypes.js";

function describeFiber(fiber: Fiber): string {
  const name = getComponentNameFromFiber(fiber);
  return name === null ? "" : `\n    at ${name}`;
}

export function getStackByFiberInDevAndProd(workInProgress: Fiber): string {
  try {
    let info = "";
    let node: Fiber | null = workInProgress;
    while (node !== null) {
      info += describeFiber(node);
      node = node.return;
    }
    return info;
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    return `\nError generating stack: ${message}`;
  }
}

export function getOwnerStackByFiberInDev(workInProgress: Fiber): string {
  return getStackByFiberInDevAndProd(workInProgress);
}
