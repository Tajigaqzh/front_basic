/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ANIMATION_END,
  ANIMATION_ITERATION,
  ANIMATION_START,
  TRANSITION_CANCEL,
  TRANSITION_END,
  TRANSITION_RUN,
  TRANSITION_START,
} from "./DOMEventNames.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { registerTwoPhaseEvent } from "./EventRegistry.js";

// @beginner: 声明 topLevelEventsToReactNames：保存当前步骤需要读取或更新的数据。
export const topLevelEventsToReactNames: Map<DOMEventName, string | null> = new Map();

// @beginner: 声明 simpleEventPluginEvents：保存当前步骤需要读取或更新的数据。
const simpleEventPluginEvents = [
  "abort",
  "auxClick",
  "cancel",
  "canPlay",
  "canPlayThrough",
  "click",
  "close",
  "contextMenu",
  "copy",
  "cut",
  "drag",
  "dragEnd",
  "dragEnter",
  "dragExit",
  "dragLeave",
  "dragOver",
  "dragStart",
  "drop",
  "durationChange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "gotPointerCapture",
  "input",
  "invalid",
  "keyDown",
  "keyPress",
  "keyUp",
  "load",
  "loadedData",
  "loadedMetadata",
  "loadStart",
  "lostPointerCapture",
  "mouseDown",
  "mouseMove",
  "mouseOut",
  "mouseOver",
  "mouseUp",
  "paste",
  "pause",
  "play",
  "playing",
  "pointerCancel",
  "pointerDown",
  "pointerMove",
  "pointerOut",
  "pointerOver",
  "pointerUp",
  "progress",
  "rateChange",
  "reset",
  "resize",
  "scroll",
  "scrollEnd",
  "seeked",
  "seeking",
  "stalled",
  "submit",
  "suspend",
  "timeUpdate",
  "toggle",
  "touchCancel",
  "touchEnd",
  "touchMove",
  "touchStart",
  "volumeChange",
  "waiting",
  "wheel",
];

// @beginner: 进入 registerSimpleEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function registerSimpleEvent(domEventName: DOMEventName, reactName: string): void {
  topLevelEventsToReactNames.set(domEventName, reactName);
  registerTwoPhaseEvent(reactName, [domEventName]);
}

// @beginner: 进入 registerSimpleEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerSimpleEvents(): void {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const eventName of simpleEventPluginEvents) {
    // @beginner: 声明 domEventName：保存当前步骤需要读取或更新的数据。
    const domEventName = eventName.toLowerCase();
    // @beginner: 声明 capitalizedEvent：保存当前步骤需要读取或更新的数据。
    const capitalizedEvent = eventName[0].toUpperCase() + eventName.slice(1);
    registerSimpleEvent(domEventName, `on${capitalizedEvent}`);
  }

  registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
  registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
  registerSimpleEvent(ANIMATION_START, "onAnimationStart");
  registerSimpleEvent("dblclick", "onDoubleClick");
  registerSimpleEvent("focusin", "onFocus");
  registerSimpleEvent("focusout", "onBlur");
  registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
  registerSimpleEvent(TRANSITION_START, "onTransitionStart");
  registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
  registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
}
