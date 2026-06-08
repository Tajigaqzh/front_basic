/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { EventSystemFlags } from "./EventSystemFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AnyNativeEvent } from "./PluginModuleType.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { resetReplayingEvent, setReplayingEvent } from "./CurrentReplayingEvent.js";

// @beginner: 定义 QueuedReplayableEvent：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface QueuedReplayableEvent {
  blockedOn: EventTarget | null;
  domEventName: DOMEventName;
  eventSystemFlags: EventSystemFlags;
  nativeEvent: AnyNativeEvent;
  targetContainers: EventTarget[];
}

// @beginner: 声明 discreteReplayableEvents：保存当前步骤需要读取或更新的数据。
const discreteReplayableEvents: DOMEventName[] = [
  "mousedown",
  "mouseup",
  "touchcancel",
  "touchend",
  "touchstart",
  "auxclick",
  "dblclick",
  "pointercancel",
  "pointerdown",
  "pointerup",
  "dragend",
  "dragstart",
  "drop",
  "compositionend",
  "compositionstart",
  "keydown",
  "keypress",
  "keyup",
  "input",
  "textInput",
  "copy",
  "cut",
  "paste",
  "click",
  "change",
  "contextmenu",
  "reset",
];

// @beginner: 声明 queuedFocus：保存当前步骤需要读取或更新的数据。
let queuedFocus: QueuedReplayableEvent | null = null;
// @beginner: 声明 queuedDrag：保存当前步骤需要读取或更新的数据。
let queuedDrag: QueuedReplayableEvent | null = null;
// @beginner: 声明 queuedMouse：保存当前步骤需要读取或更新的数据。
let queuedMouse: QueuedReplayableEvent | null = null;
// @beginner: 声明 queuedPointers：保存当前步骤需要读取或更新的数据。
const queuedPointers: Map<number, QueuedReplayableEvent> = new Map();
// @beginner: 声明 queuedPointerCaptures：保存当前步骤需要读取或更新的数据。
const queuedPointerCaptures: Map<number, QueuedReplayableEvent> = new Map();

// @beginner: 进入 isDiscreteEventThatRequiresHydration：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isDiscreteEventThatRequiresHydration(eventType: DOMEventName): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return discreteReplayableEvents.includes(eventType);
}

// @beginner: 进入 createQueuedReplayableEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createQueuedReplayableEvent(
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): QueuedReplayableEvent {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    blockedOn,
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetContainers: [targetContainer],
  };
}

// @beginner: 进入 accumulateOrCreateContinuousQueuedReplayableEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function accumulateOrCreateContinuousQueuedReplayableEvent(
  existingQueuedEvent: QueuedReplayableEvent | null,
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): QueuedReplayableEvent {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (existingQueuedEvent === null || existingQueuedEvent.nativeEvent !== nativeEvent) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return createQueuedReplayableEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent);
  }

  existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!existingQueuedEvent.targetContainers.includes(targetContainer)) {
    existingQueuedEvent.targetContainers.push(targetContainer);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return existingQueuedEvent;
}

// @beginner: 进入 clearIfContinuousEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function clearIfContinuousEvent(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): void {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (domEventName) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusin":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusout":
      queuedFocus = null;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "dragenter":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "dragleave":
      queuedDrag = null;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mouseover":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mouseout":
      queuedMouse = null;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "pointerover":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "pointerout":
      queuedPointers.delete(nativeEvent.pointerId ?? 0);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "gotpointercapture":
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "lostpointercapture":
      queuedPointerCaptures.delete(nativeEvent.pointerId ?? 0);
      break;
  }
}

// @beginner: 进入 queueIfContinuousEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function queueIfContinuousEvent(
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): boolean {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (domEventName) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "focusin":
      queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedFocus,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "dragenter":
      queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedDrag,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "mouseover":
      queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedMouse,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "pointerover":
      queuedPointers.set(
        nativeEvent.pointerId ?? 0,
        accumulateOrCreateContinuousQueuedReplayableEvent(
          queuedPointers.get(nativeEvent.pointerId ?? 0) ?? null,
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent,
        ),
      );
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "gotpointercapture":
      queuedPointerCaptures.set(
        nativeEvent.pointerId ?? 0,
        accumulateOrCreateContinuousQueuedReplayableEvent(
          queuedPointerCaptures.get(nativeEvent.pointerId ?? 0) ?? null,
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent,
        ),
      );
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
  }
}

// @beginner: 进入 hasQueuedContinuousEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hasQueuedContinuousEvents(): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    queuedFocus !== null ||
    queuedDrag !== null ||
    queuedMouse !== null ||
    queuedPointers.size > 0 ||
    queuedPointerCaptures.size > 0
  );
}

// @beginner: 进入 replayUnblockedEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function replayUnblockedEvents(
  dispatch: (queuedEvent: QueuedReplayableEvent) => void,
): void {
  // @beginner: 声明 queued：保存当前步骤需要读取或更新的数据。
  const queued: QueuedReplayableEvent[] = [];
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queuedFocus !== null) queued.push(queuedFocus);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queuedDrag !== null) queued.push(queuedDrag);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (queuedMouse !== null) queued.push(queuedMouse);
  queued.push(...queuedPointers.values(), ...queuedPointerCaptures.values());

  queuedFocus = null;
  queuedDrag = null;
  queuedMouse = null;
  queuedPointers.clear();
  queuedPointerCaptures.clear();

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const queuedEvent of queued) {
    setReplayingEvent(queuedEvent.nativeEvent);
    // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
    try {
      dispatch(queuedEvent);
    // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
    } finally {
      resetReplayingEvent();
    }
  }
}
