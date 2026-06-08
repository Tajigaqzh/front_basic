/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { StackCursor } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createCursor, pop, push } from "./ReactFiberStack.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { mergeLanes, NoLanes } from "./ReactFiberLane.js";

// @beginner: 定义 HiddenContext：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface HiddenContext {
  baseLanes: Lanes;
}

// @beginner: 声明 currentTreeHiddenStackCursor：保存当前步骤需要读取或更新的数据。
export const currentTreeHiddenStackCursor: StackCursor<HiddenContext | null> = createCursor(null);
// @beginner: 声明 prevEntangledRenderLanesCursor：保存当前步骤需要读取或更新的数据。
export const prevEntangledRenderLanesCursor: StackCursor<Lanes> = createCursor(NoLanes);

// @beginner: 声明 entangledRenderLanes：保存当前步骤需要读取或更新的数据。
let entangledRenderLanes: Lanes = NoLanes;

// @beginner: 进入 getEntangledRenderLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getEntangledRenderLanes(): Lanes {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return entangledRenderLanes;
}

// @beginner: 进入 setEntangledRenderLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setEntangledRenderLanes(lanes: Lanes): void {
  entangledRenderLanes = lanes;
}

// @beginner: 进入 pushHiddenContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushHiddenContext(fiber: Fiber, context: HiddenContext): void {
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = getEntangledRenderLanes();
  push(prevEntangledRenderLanesCursor, previous, fiber);
  push(currentTreeHiddenStackCursor, context, fiber);
  setEntangledRenderLanes(mergeLanes(previous, context.baseLanes));
}

// @beginner: 进入 reuseHiddenContextOnStack：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reuseHiddenContextOnStack(fiber: Fiber): void {
  push(prevEntangledRenderLanesCursor, getEntangledRenderLanes(), fiber);
  push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current, fiber);
}

// @beginner: 进入 popHiddenContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popHiddenContext(fiber: Fiber): void {
  setEntangledRenderLanes(prevEntangledRenderLanesCursor.current);
  pop(currentTreeHiddenStackCursor, fiber);
  pop(prevEntangledRenderLanesCursor, fiber);
}

// @beginner: 进入 isCurrentTreeHidden：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isCurrentTreeHidden(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentTreeHiddenStackCursor.current !== null;
}
