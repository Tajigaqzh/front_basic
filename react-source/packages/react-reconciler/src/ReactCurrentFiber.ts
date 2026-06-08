import type { Fiber } from "./ReactInternalTypes.js";

export let current: Fiber | null = null;
export let isRendering = false;

export function setCurrentFiber(fiber: Fiber | null): void {
  current = fiber;
}

export function setIsRendering(rendering: boolean): void {
  isRendering = rendering;
}

export function resetCurrentFiber(): void {
  current = null;
  isRendering = false;
}
