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
import { IS_CAPTURE_PHASE } from "../EventSystemFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { registerTwoPhaseEvent } from "../EventRegistry.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createSyntheticEvent } from "../SyntheticEvent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  accumulateSinglePhaseListeners,
  accumulateTwoPhaseListeners,
  processDispatchQueue,
} from "../DOMPluginEventSystem.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { batchedUpdates } from "../ReactDOMUpdateBatching.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  clearScrollEndTimer,
  getScrollEndTimer,
  setScrollEndTimer,
} from "../../client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import isEventSupported from "../isEventSupported.js";

// @beginner: 声明 isScrollEndEventSupported：保存当前步骤需要读取或更新的数据。
const isScrollEndEventSupported = isEventSupported("scrollend");
// @beginner: 声明 DEBOUNCE_TIMEOUT：保存当前步骤需要读取或更新的数据。
const DEBOUNCE_TIMEOUT = 200;
// @beginner: 声明 isTouchStarted：保存当前步骤需要读取或更新的数据。
let isTouchStarted = false;
// @beginner: 声明 isMouseDown：保存当前步骤需要读取或更新的数据。
let isMouseDown = false;

// @beginner: 进入 registerEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerEvents(): void {
  registerTwoPhaseEvent("onScrollEnd", [
    "scroll",
    "scrollend",
    "touchstart",
    "touchcancel",
    "touchend",
    "mousedown",
    "mouseup",
  ]);
}

// @beginner: 进入 manualDispatchScrollEndEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function manualDispatchScrollEndEvent(
  inst: Fiber,
  nativeEvent: AnyNativeEvent,
  target: EventTarget,
): void {
  // @beginner: 声明 dispatchQueue：保存当前步骤需要读取或更新的数据。
  const dispatchQueue: DispatchQueue = [];
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateTwoPhaseListeners(inst, "onScrollEnd");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = "scrollend";
    event.target = target;
    dispatchQueue.push({ event, listeners });
  }
  batchedUpdates(() => processDispatchQueue(dispatchQueue, 0));
}

// @beginner: 进入 fireScrollEnd：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function fireScrollEnd(targetInst: Fiber, nativeEvent: AnyNativeEvent, nativeEventTarget: EventTarget): void {
  clearScrollEndTimer(nativeEventTarget);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isMouseDown || isTouchStarted) {
    debounceScrollEnd(targetInst, nativeEvent, nativeEventTarget);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  manualDispatchScrollEndEvent(targetInst, nativeEvent, nativeEventTarget);
}

// @beginner: 进入 debounceScrollEnd：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function debounceScrollEnd(
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget,
): void {
  // @beginner: 声明 existingTimer：保存当前步骤需要读取或更新的数据。
  const existingTimer = getScrollEndTimer(nativeEventTarget);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (existingTimer !== null) {
    clearTimeout(existingTimer);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (targetInst !== null) {
    // @beginner: 声明 timer：保存当前步骤需要读取或更新的数据。
    const timer = setTimeout(() => fireScrollEnd(targetInst, nativeEvent, nativeEventTarget), DEBOUNCE_TIMEOUT);
    setScrollEndTimer(nativeEventTarget, timer);
  }
}

// @beginner: 进入 extractEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget | null,
): void {
  // @beginner: 声明 inCapturePhase：保存当前步骤需要读取或更新的数据。
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName !== "scrollend") {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!isScrollEndEventSupported && inCapturePhase) {
      // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
      switch (domEventName) {
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "scroll":
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (nativeEventTarget !== null) {
            debounceScrollEnd(targetInst, nativeEvent, nativeEventTarget);
          }
          break;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "touchstart":
          isTouchStarted = true;
          break;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "touchcancel":
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "touchend":
          isTouchStarted = false;
          break;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "mousedown":
          isMouseDown = true;
          break;
        // @beginner: 匹配到这个 case 后，只处理这一类输入。
        case "mouseup":
          isMouseDown = false;
          break;
      }
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isScrollEndEventSupported && nativeEventTarget !== null) {
    // @beginner: 声明 existingTimer：保存当前步骤需要读取或更新的数据。
    const existingTimer = getScrollEndTimer(nativeEventTarget);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (existingTimer !== null) {
      clearScrollEndTimer(nativeEventTarget);
    }
  }

  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    "onScrollEnd",
    "scrollend",
    inCapturePhase,
    !inCapturePhase,
    nativeEvent,
  );

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type = "scrollend";
    event.target = nativeEventTarget;
    dispatchQueue.push({ event, listeners });
  }
}
