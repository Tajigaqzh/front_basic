import type { Fiber } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import type { StackCursor } from "./ReactFiberStack.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";
import { mergeLanes, NoLanes } from "./ReactFiberLane.js";

export interface HiddenContext {
  baseLanes: Lanes;
}

export const currentTreeHiddenStackCursor: StackCursor<HiddenContext | null> = createCursor(null);
export const prevEntangledRenderLanesCursor: StackCursor<Lanes> = createCursor(NoLanes);

let entangledRenderLanes: Lanes = NoLanes;

export function getEntangledRenderLanes(): Lanes {
  return entangledRenderLanes;
}

export function setEntangledRenderLanes(lanes: Lanes): void {
  entangledRenderLanes = lanes;
}

export function pushHiddenContext(fiber: Fiber, context: HiddenContext): void {
  const previous = getEntangledRenderLanes();
  push(prevEntangledRenderLanesCursor, previous, fiber);
  push(currentTreeHiddenStackCursor, context, fiber);
  setEntangledRenderLanes(mergeLanes(previous, context.baseLanes));
}

export function reuseHiddenContextOnStack(fiber: Fiber): void {
  push(prevEntangledRenderLanesCursor, getEntangledRenderLanes(), fiber);
  push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current, fiber);
}

export function popHiddenContext(fiber: Fiber): void {
  setEntangledRenderLanes(prevEntangledRenderLanesCursor.current);
  pop(currentTreeHiddenStackCursor, fiber);
  pop(prevEntangledRenderLanesCursor, fiber);
}

export function isCurrentTreeHidden(): boolean {
  return currentTreeHiddenStackCursor.current !== null;
}
