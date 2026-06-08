/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { listenToNativeEvent } from "./ReactDOMEventListener.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactSyntheticEvent } from "./ReactSyntheticEventType.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { IS_CAPTURE_PHASE, type EventSystemFlags } from "./EventSystemFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { allNativeEvents } from "./EventRegistry.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getEventTarget from "./getEventTarget.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getClosestInstanceFromNode } from "../client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { batchedUpdates } from "./ReactDOMUpdateBatching.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { addEventBubbleListener, addEventCaptureListener } from "./EventListener.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as BeforeInputEventPlugin from "./plugins/BeforeInputEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as ChangeEventPlugin from "./plugins/ChangeEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as EnterLeaveEventPlugin from "./plugins/EnterLeaveEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as FormActionEventPlugin from "./plugins/FormActionEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as ScrollEndEventPlugin from "./plugins/ScrollEndEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as SelectEventPlugin from "./plugins/SelectEventPlugin.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as SimpleEventPlugin from "./plugins/SimpleEventPlugin.js";

// @beginner: 定义 DispatchListener：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface DispatchListener {
  instance: Fiber | null;
  listener: (event: ReactSyntheticEvent) => void;
  currentTarget: EventTarget | null;
}

// @beginner: 定义 DispatchEntry：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface DispatchEntry {
  event: ReactSyntheticEvent;
  listeners: DispatchListener[];
}

// @beginner: 定义 DispatchQueue：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type DispatchQueue = DispatchEntry[];

// @beginner: 声明 listeningContainers：保存当前步骤需要读取或更新的数据。
const listeningContainers = new WeakSet<EventTarget>();
// @beginner: 声明 listeningDocuments：保存当前步骤需要读取或更新的数据。
const listeningDocuments = new WeakSet<EventTarget>();
// @beginner: 声明 didRegisterEvents：保存当前步骤需要读取或更新的数据。
let didRegisterEvents = false;

// @beginner: 声明 mediaEventTypes：保存当前步骤需要读取或更新的数据。
export const mediaEventTypes: DOMEventName[] = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "resize",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting",
];

// @beginner: 声明 nonDelegatedEvents：保存当前步骤需要读取或更新的数据。
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  "beforetoggle",
  "cancel",
  "close",
  "invalid",
  "load",
  "scroll",
  "scrollend",
  "toggle",
  ...mediaEventTypes,
]);

// @beginner: 进入 ensurePluginEventsRegistered：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function ensurePluginEventsRegistered(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (didRegisterEvents) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  didRegisterEvents = true;
  SimpleEventPlugin.registerEvents();
  EnterLeaveEventPlugin.registerEvents();
  ChangeEventPlugin.registerEvents();
  SelectEventPlugin.registerEvents();
  BeforeInputEventPlugin.registerEvents();
  ScrollEndEventPlugin.registerEvents();
}

// @beginner: 进入 listenToAllSupportedEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function listenToAllSupportedEvents(rootContainerElement: EventTarget): void {
  ensurePluginEventsRegistered();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeningContainers.has(rootContainerElement)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  listeningContainers.add(rootContainerElement);

  allNativeEvents.forEach((domEventName) => {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (domEventName === "selectionchange") {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!nonDelegatedEvents.has(domEventName)) {
      trapEventOnTarget(rootContainerElement, domEventName, false);
    }
    trapEventOnTarget(rootContainerElement, domEventName, true);
  });

  // @beginner: 声明 maybeNode：保存当前步骤需要读取或更新的数据。
  const maybeNode = rootContainerElement as { nodeType?: number; ownerDocument?: EventTarget | null };
  // @beginner: 声明 ownerDocument：保存当前步骤需要读取或更新的数据。
  const ownerDocument = maybeNode.nodeType === 9 ? rootContainerElement : maybeNode.ownerDocument ?? null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ownerDocument !== null && !listeningDocuments.has(ownerDocument)) {
    listeningDocuments.add(ownerDocument);
    trapEventOnTarget(ownerDocument, "selectionchange", false);
  }
}

// @beginner: 进入 listenToEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function listenToEvent(
  domEventName: DOMEventName,
  target: EventTarget,
  listener: (event: Event) => void,
): () => void {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return listenToNativeEvent(domEventName, target, listener);
}

// @beginner: 进入 trapEventOnTarget：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function trapEventOnTarget(
  target: EventTarget,
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
): void {
  // @beginner: 声明 eventSystemFlags：保存当前步骤需要读取或更新的数据。
  const eventSystemFlags = isCapturePhaseListener ? IS_CAPTURE_PHASE : 0;
  // @beginner: 定义 listener：保存真正注册到 DOM 上的原生事件回调。
  const listener = (nativeEvent: Event) => {
    batchedUpdates(() => {
      dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, target);
    });
  };

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isCapturePhaseListener) {
    addEventCaptureListener(target, domEventName, listener);
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    addEventBubbleListener(target, domEventName, listener);
  }
}

// @beginner: 进入 dispatchEventForPluginEventSystem：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: Event,
  targetContainer: EventTarget,
): void {
  // @beginner: 声明 nativeEventTarget：保存当前步骤需要读取或更新的数据。
  const nativeEventTarget = getEventTarget(nativeEvent);
  // @beginner: 声明 targetInst：保存当前步骤需要读取或更新的数据。
  const targetInst =
    typeof Node !== "undefined" && nativeEventTarget instanceof Node
      ? getClosestInstanceFromNode(nativeEventTarget)
      : null;
  // @beginner: 声明 dispatchQueue：保存当前步骤需要读取或更新的数据。
  const dispatchQueue: DispatchQueue = [];

  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  EnterLeaveEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  ChangeEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  SelectEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  BeforeInputEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  FormActionEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  ScrollEndEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );

  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

// @beginner: 进入 accumulateSinglePhaseListeners：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  _nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  _nativeEvent: Event,
): DispatchListener[] {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (targetFiber === null || reactName === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return [];
  }

  // @beginner: 声明 captureName：保存当前步骤需要读取或更新的数据。
  const captureName = `${reactName}Capture`;
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners: DispatchListener[] = [];
  // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
  let fiber: Fiber | null = targetFiber;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (fiber !== null) {
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    // @beginner: 声明 listener：保存当前步骤需要读取或更新的数据。
    const listener = props[inCapturePhase ? captureName : reactName];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof listener === "function") {
      listeners.push({
        instance: fiber,
        listener: listener as (event: ReactSyntheticEvent) => void,
        currentTarget: fiber.stateNode instanceof EventTarget ? fiber.stateNode : null,
      });
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (accumulateTargetOnly) {
      break;
    }
    fiber = fiber.return;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return inCapturePhase ? listeners.reverse() : listeners;
}

// @beginner: 进入 accumulateTwoPhaseListeners：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string,
): DispatchListener[] {
  // @beginner: 声明 captureName：保存当前步骤需要读取或更新的数据。
  const captureName = `${reactName}Capture`;
  // @beginner: 声明 capture：保存当前步骤需要读取或更新的数据。
  const capture: DispatchListener[] = [];
  // @beginner: 声明 bubble：保存当前步骤需要读取或更新的数据。
  const bubble: DispatchListener[] = [];
  // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
  let fiber = targetFiber;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (fiber !== null) {
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    // @beginner: 声明 currentTarget：保存当前步骤需要读取或更新的数据。
    const currentTarget = fiber.stateNode instanceof EventTarget ? fiber.stateNode : null;
    // @beginner: 声明 captureListener：保存当前步骤需要读取或更新的数据。
    const captureListener = props[captureName];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof captureListener === "function") {
      capture.push({
        instance: fiber,
        listener: captureListener as (event: ReactSyntheticEvent) => void,
        currentTarget,
      });
    }
    // @beginner: 声明 bubbleListener：保存当前步骤需要读取或更新的数据。
    const bubbleListener = props[reactName];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof bubbleListener === "function") {
      bubble.push({
        instance: fiber,
        listener: bubbleListener as (event: ReactSyntheticEvent) => void,
        currentTarget,
      });
    }
    fiber = fiber.return;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return [...capture.reverse(), ...bubble];
}

// @beginner: 进入 accumulateEnterLeaveTwoPhaseListeners：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function accumulateEnterLeaveTwoPhaseListeners(
  dispatchQueue: DispatchQueue,
  leaveEvent: ReactSyntheticEvent,
  enterEvent: ReactSyntheticEvent | null,
  from: Fiber | null,
  to: Fiber | null,
): void {
  // @beginner: 声明 common：保存当前步骤需要读取或更新的数据。
  const common = getLowestCommonAncestor(from, to);
  // @beginner: 声明 leaveName：保存当前步骤需要读取或更新的数据。
  const leaveName = leaveEvent.type.startsWith("pointer") ? "onPointerLeave" : "onMouseLeave";
  // @beginner: 声明 enterName：保存当前步骤需要读取或更新的数据。
  const enterName = leaveEvent.type.startsWith("pointer") ? "onPointerEnter" : "onMouseEnter";
  // @beginner: 声明 leaveListeners：保存当前步骤需要读取或更新的数据。
  const leaveListeners = accumulateEnterLeaveListeners(from, common, leaveName);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (leaveListeners.length > 0) {
    dispatchQueue.push({ event: leaveEvent, listeners: leaveListeners });
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (enterEvent !== null) {
    // @beginner: 声明 enterListeners：保存当前步骤需要读取或更新的数据。
    const enterListeners = accumulateEnterLeaveListeners(to, common, enterName).reverse();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (enterListeners.length > 0) {
      dispatchQueue.push({ event: enterEvent, listeners: enterListeners });
    }
  }
}

// @beginner: 进入 accumulateEnterLeaveListeners：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function accumulateEnterLeaveListeners(
  from: Fiber | null,
  common: Fiber | null,
  registrationName: string,
): DispatchListener[] {
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners: DispatchListener[] = [];
  // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
  let fiber = from;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (fiber !== null && fiber !== common) {
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    // @beginner: 声明 listener：保存当前步骤需要读取或更新的数据。
    const listener = props[registrationName];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof listener === "function") {
      listeners.push({
        instance: fiber,
        listener: listener as (event: ReactSyntheticEvent) => void,
        currentTarget: fiber.stateNode instanceof EventTarget ? fiber.stateNode : null,
      });
    }
    fiber = fiber.return;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return listeners;
}

// @beginner: 进入 getLowestCommonAncestor：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getLowestCommonAncestor(a: Fiber | null, b: Fiber | null): Fiber | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (a === null || b === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 声明 ancestors：保存当前步骤需要读取或更新的数据。
  const ancestors = new Set<Fiber>();
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Fiber | null = a;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    ancestors.add(node);
    node = node.return;
  }

  node = b;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (ancestors.has(node)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return node;
    }
    node = node.return;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 processDispatchQueue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  _eventSystemFlags: EventSystemFlags,
): void {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const { event, listeners } of dispatchQueue) {
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const dispatchListener of listeners) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (event.isPropagationStopped()) {
        break;
      }
      event.currentTarget = dispatchListener.currentTarget;
      dispatchListener.listener(event);
      event.currentTarget = null;
    }
  }
}
