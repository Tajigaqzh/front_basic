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
import {
  getData as getFallbackData,
  initialize as initializeFallbackCompositionState,
  reset as resetFallbackCompositionState,
} from "../FallbackCompositionState.js";

// @beginner: 声明 END_KEYCODES：保存当前步骤需要读取或更新的数据。
const END_KEYCODES = [9, 13, 27, 32];
// @beginner: 声明 START_KEYCODE：保存当前步骤需要读取或更新的数据。
const START_KEYCODE = 229;
// @beginner: 声明 isComposing：保存当前步骤需要读取或更新的数据。
let isComposing = false;

// @beginner: 进入 registerEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerEvents(): void {
  registerTwoPhaseEvent("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
  registerTwoPhaseEvent("onCompositionEnd", [
    "compositionend",
    "focusout",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
  ]);
  registerTwoPhaseEvent("onCompositionStart", [
    "compositionstart",
    "focusout",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
  ]);
  registerTwoPhaseEvent("onCompositionUpdate", [
    "compositionupdate",
    "focusout",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
  ]);
}

// @beginner: 进入 getCompositionEventType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getCompositionEventType(domEventName: DOMEventName): string | null {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (domEventName) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "compositionstart":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "onCompositionStart";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "compositionend":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "onCompositionEnd";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "compositionupdate":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "onCompositionUpdate";
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
  }
}

// @beginner: 进入 isFallbackCompositionStart：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isFallbackCompositionStart(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return domEventName === "keydown" && nativeEvent.keyCode === START_KEYCODE;
}

// @beginner: 进入 isFallbackCompositionEnd：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isFallbackCompositionEnd(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): boolean {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (domEventName) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "keyup":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return END_KEYCODES.includes(nativeEvent.keyCode ?? 0);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "keydown":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return nativeEvent.keyCode !== START_KEYCODE;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "keypress":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mousedown":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusout":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
  }
}

// @beginner: 进入 getDataFromCustomEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getDataFromCustomEvent(nativeEvent: AnyNativeEvent): string | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof nativeEvent.data === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return nativeEvent.data;
  }
  // @beginner: 声明 detail：保存当前步骤需要读取或更新的数据。
  const detail = (nativeEvent as { detail?: unknown }).detail;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (detail !== null && typeof detail === "object" && "data" in detail) {
    // @beginner: 声明 data：保存当前步骤需要读取或更新的数据。
    const data = (detail as { data?: unknown }).data;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return typeof data === "string" ? data : null;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 extractCompositionEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function extractCompositionEvent(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  // @beginner: 声明 eventType：保存当前步骤需要读取或更新的数据。
  let eventType = getCompositionEventType(domEventName);
  // @beginner: 声明 fallbackData：保存当前步骤需要读取或更新的数据。
  let fallbackData: string | null = null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (eventType === null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!isComposing && isFallbackCompositionStart(domEventName, nativeEvent)) {
      eventType = "onCompositionStart";
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (isComposing && isFallbackCompositionEnd(domEventName, nativeEvent)) {
      eventType = "onCompositionEnd";
    }
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (eventType === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isComposing && eventType === "onCompositionStart") {
    isComposing = initializeFallbackCompositionState(nativeEventTarget);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (eventType === "onCompositionEnd" && isComposing) {
    fallbackData = getFallbackData();
    resetFallbackCompositionState();
    isComposing = false;
  }

  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateTwoPhaseListeners(targetInst, eventType);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = domEventName;
    event.target = nativeEventTarget;
    event.data = fallbackData ?? getDataFromCustomEvent(nativeEvent);
    dispatchQueue.push({ event, listeners });
  }
}

// @beginner: 进入 getBeforeInputChars：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getBeforeInputChars(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): string | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName === "compositionend") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return getDataFromCustomEvent(nativeEvent) ?? (nativeEvent as { data?: string }).data ?? null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName === "keypress") {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ((nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) && !(nativeEvent.ctrlKey && nativeEvent.altKey)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    }
    // @beginner: 声明 which：保存当前步骤需要读取或更新的数据。
    const which = nativeEvent.which ?? nativeEvent.charCode ?? 0;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return which === 0 ? null : String.fromCharCode(which);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName === "textInput") {
    // @beginner: 声明 data：保存当前步骤需要读取或更新的数据。
    const data = (nativeEvent as { data?: string }).data;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return data === undefined || data === "" ? null : data;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 extractBeforeInputEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function extractBeforeInputEvent(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  // @beginner: 声明 chars：保存当前步骤需要读取或更新的数据。
  const chars = getBeforeInputChars(domEventName, nativeEvent);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (chars === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateTwoPhaseListeners(targetInst, "onBeforeInput");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = "beforeinput";
    event.target = nativeEventTarget;
    event.data = chars;
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
  extractCompositionEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
  extractBeforeInputEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
}
