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
import isTextInputElement from "../isTextInputElement.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { shallowEqual } from "shared";

// @beginner: 声明 activeElement：保存当前步骤需要读取或更新的数据。
let activeElement: any = null;
// @beginner: 声明 activeElementInst：保存当前步骤需要读取或更新的数据。
let activeElementInst: Fiber | null = null;
// @beginner: 声明 lastSelection：保存当前步骤需要读取或更新的数据。
let lastSelection: unknown = null;
// @beginner: 声明 mouseDown：保存当前步骤需要读取或更新的数据。
let mouseDown = false;

// @beginner: 进入 registerEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerEvents(): void {
  registerTwoPhaseEvent("onSelect", [
    "focusout",
    "contextmenu",
    "dragend",
    "focusin",
    "keydown",
    "keyup",
    "mousedown",
    "mouseup",
    "selectionchange",
  ]);
}

// @beginner: 进入 getSelection：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getSelection(node: any): unknown {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("selectionStart" in node && "selectionEnd" in node) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return {
      start: node.selectionStart,
      end: node.selectionEnd,
    };
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    text: typeof node.textContent === "string" ? node.textContent : "",
  };
}

// @beginner: 进入 constructSelectEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function constructSelectEvent(
  dispatchQueue: DispatchQueue,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (mouseDown || activeElement === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 currentSelection：保存当前步骤需要读取或更新的数据。
  const currentSelection = getSelection(activeElement);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lastSelection !== null && shallowEqual(lastSelection, currentSelection)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  lastSelection = currentSelection;

  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateTwoPhaseListeners(activeElementInst, "onSelect");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = "select";
    event.target = activeElement;
    dispatchQueue.push({ event, listeners });
  }
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
  const targetNode = (targetInst?.stateNode ?? nativeEventTarget) as any;

  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (domEventName) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusin":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isTextInputElement(targetNode) || targetNode?.contentEditable === "true") {
        activeElement = targetNode;
        activeElementInst = targetInst;
        lastSelection = null;
      }
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusout":
      activeElement = null;
      activeElementInst = null;
      lastSelection = null;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mousedown":
      mouseDown = true;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "contextmenu":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mouseup":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "dragend":
      mouseDown = false;
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "selectionchange":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "keydown":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "keyup":
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      break;
  }
}
