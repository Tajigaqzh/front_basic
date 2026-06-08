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
import { registerTwoPhaseEvent } from "../EventRegistry.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createSyntheticEvent } from "../SyntheticEvent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { accumulateTwoPhaseListeners } from "../DOMPluginEventSystem.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enqueueStateRestore } from "../ReactDOMControlledComponent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import isTextInputElement from "../isTextInputElement.js";

// @beginner: 进入 registerEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerEvents(): void {
  registerTwoPhaseEvent("onChange", [
    "change",
    "click",
    "focusin",
    "focusout",
    "input",
    "keydown",
    "keyup",
    "selectionchange",
  ]);
}

// @beginner: 进入 createAndAccumulateChangeEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createAndAccumulateChangeEvent(
  dispatchQueue: DispatchQueue,
  inst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  target: EventTarget | null,
): void {
  enqueueStateRestore(target as Node | null);
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateTwoPhaseListeners(inst, "onChange");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = "change";
    event.target = target;
    dispatchQueue.push({ event, listeners });
  }
}

// @beginner: 进入 shouldUseChangeEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shouldUseChangeEvent(elem: unknown): boolean {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  const node = elem as { nodeName?: string; type?: string } | null;
  // @beginner: 声明 nodeName：保存当前步骤需要读取或更新的数据。
  const nodeName = node?.nodeName?.toLowerCase();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nodeName === "select" || (nodeName === "input" && node?.type === "file");
}

// @beginner: 进入 shouldUseClickEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shouldUseClickEvent(elem: unknown): boolean {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  const node = elem as { nodeName?: string; type?: string } | null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    node?.nodeName?.toLowerCase() === "input" &&
    (node.type === "checkbox" || node.type === "radio")
  );
}

// @beginner: 进入 shouldDispatchChange：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function shouldDispatchChange(domEventName: DOMEventName, targetNode: unknown): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shouldUseChangeEvent(targetNode)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return domEventName === "change";
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (shouldUseClickEvent(targetNode)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return domEventName === "click";
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isTextInputElement(targetNode)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return domEventName === "input" || domEventName === "change";
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
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
  // @beginner: 声明 targetNode：保存当前步骤需要读取或更新的数据。
  const targetNode = targetInst?.stateNode ?? nativeEventTarget;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (targetInst !== null && shouldDispatchChange(domEventName, targetNode)) {
    createAndAccumulateChangeEvent(dispatchQueue, targetInst, nativeEvent, nativeEventTarget);
  }
}
