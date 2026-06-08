/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "../DOMEventNames.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AnyNativeEvent } from "../PluginModuleType.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { EventSystemFlags } from "../EventSystemFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { registerDirectEvent } from "../EventRegistry.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createSyntheticEvent } from "../SyntheticEvent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { accumulateEnterLeaveTwoPhaseListeners } from "../DOMPluginEventSystem.js";

// @beginner: 定义 RelatedTargetWithFiber：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type RelatedTargetWithFiber = EventTarget & { __reactFiber?: Fiber | null };

// @beginner: 进入 registerEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerEvents(): void {
  registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
  registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
  registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
  registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
}

// @beginner: 进入 extractEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  _eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget,
): void {
  // @beginner: 声明 isOverEvent：保存当前步骤需要读取或更新的数据。
  const isOverEvent = domEventName === "mouseover" || domEventName === "pointerover";
  // @beginner: 声明 isOutEvent：保存当前步骤需要读取或更新的数据。
  const isOutEvent = domEventName === "mouseout" || domEventName === "pointerout";
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isOverEvent && !isOutEvent) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 from：保存当前步骤需要读取或更新的数据。
  let from: Fiber | null;
  // @beginner: 声明 to：保存当前步骤需要读取或更新的数据。
  let to: Fiber | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isOutEvent) {
    // @beginner: 声明 related：保存当前步骤需要读取或更新的数据。
    const related = (nativeEvent.relatedTarget ?? null) as RelatedTargetWithFiber | null;
    from = targetInst;
    to = related?.__reactFiber ?? null;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    from = null;
    to = targetInst;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (from === to) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 isPointer：保存当前步骤需要读取或更新的数据。
  const isPointer = domEventName === "pointerout" || domEventName === "pointerover";
  // @beginner: 声明 leave：保存当前步骤需要读取或更新的数据。
  const leave = createSyntheticEvent(nativeEvent);
  leave.type = isPointer ? "pointerleave" : "mouseleave";
  leave.target = from?.stateNode instanceof EventTarget ? from.stateNode : nativeEventTarget;
  leave.relatedTarget = to?.stateNode instanceof EventTarget ? to.stateNode : null;

  // @beginner: 声明 enter：保存当前步骤需要读取或更新的数据。
  let enter = null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (to !== null) {
    enter = createSyntheticEvent(nativeEvent);
    enter.type = isPointer ? "pointerenter" : "mouseenter";
    enter.target = to.stateNode instanceof EventTarget ? to.stateNode : nativeEventTarget;
    enter.relatedTarget = leave.target;
  }

  accumulateEnterLeaveTwoPhaseListeners(dispatchQueue, leave, enter, from, to);
}
