import type { DOMEventName } from "./DOMEventNames.js";
import { listenToNativeEvent } from "./ReactDOMEventListener.js";
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { ReactSyntheticEvent } from "./ReactSyntheticEventType.js";
import { IS_CAPTURE_PHASE, type EventSystemFlags } from "./EventSystemFlags.js";
import { allNativeEvents } from "./EventRegistry.js";
import getEventTarget from "./getEventTarget.js";
import { getClosestInstanceFromNode } from "../client/ReactDOMComponentTree.js";
import { batchedUpdates } from "./ReactDOMUpdateBatching.js";
import { addEventBubbleListener, addEventCaptureListener } from "./EventListener.js";
import * as BeforeInputEventPlugin from "./plugins/BeforeInputEventPlugin.js";
import * as ChangeEventPlugin from "./plugins/ChangeEventPlugin.js";
import * as EnterLeaveEventPlugin from "./plugins/EnterLeaveEventPlugin.js";
import * as FormActionEventPlugin from "./plugins/FormActionEventPlugin.js";
import * as ScrollEndEventPlugin from "./plugins/ScrollEndEventPlugin.js";
import * as SelectEventPlugin from "./plugins/SelectEventPlugin.js";
import * as SimpleEventPlugin from "./plugins/SimpleEventPlugin.js";

export interface DispatchListener {
  instance: Fiber | null;
  listener: (event: ReactSyntheticEvent) => void;
  currentTarget: EventTarget | null;
}

export interface DispatchEntry {
  event: ReactSyntheticEvent;
  listeners: DispatchListener[];
}

export type DispatchQueue = DispatchEntry[];

const listeningContainers = new WeakSet<EventTarget>();
const listeningDocuments = new WeakSet<EventTarget>();
let didRegisterEvents = false;

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

function ensurePluginEventsRegistered(): void {
  if (didRegisterEvents) {
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

export function listenToAllSupportedEvents(rootContainerElement: EventTarget): void {
  ensurePluginEventsRegistered();
  if (listeningContainers.has(rootContainerElement)) {
    return;
  }
  listeningContainers.add(rootContainerElement);

  allNativeEvents.forEach((domEventName) => {
    if (domEventName === "selectionchange") {
      return;
    }
    if (!nonDelegatedEvents.has(domEventName)) {
      trapEventOnTarget(rootContainerElement, domEventName, false);
    }
    trapEventOnTarget(rootContainerElement, domEventName, true);
  });

  const maybeNode = rootContainerElement as { nodeType?: number; ownerDocument?: EventTarget | null };
  const ownerDocument = maybeNode.nodeType === 9 ? rootContainerElement : maybeNode.ownerDocument ?? null;
  if (ownerDocument !== null && !listeningDocuments.has(ownerDocument)) {
    listeningDocuments.add(ownerDocument);
    trapEventOnTarget(ownerDocument, "selectionchange", false);
  }
}

export function listenToEvent(
  domEventName: DOMEventName,
  target: EventTarget,
  listener: (event: Event) => void,
): () => void {
  return listenToNativeEvent(domEventName, target, listener);
}

function trapEventOnTarget(
  target: EventTarget,
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
): void {
  const eventSystemFlags = isCapturePhaseListener ? IS_CAPTURE_PHASE : 0;
  const listener = (nativeEvent: Event) => {
    batchedUpdates(() => {
      dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, target);
    });
  };

  if (isCapturePhaseListener) {
    addEventCaptureListener(target, domEventName, listener);
  } else {
    addEventBubbleListener(target, domEventName, listener);
  }
}

function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: Event,
  targetContainer: EventTarget,
): void {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const targetInst =
    typeof Node !== "undefined" && nativeEventTarget instanceof Node
      ? getClosestInstanceFromNode(nativeEventTarget)
      : null;
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

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  _nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  _nativeEvent: Event,
): DispatchListener[] {
  if (targetFiber === null || reactName === null) {
    return [];
  }

  const captureName = `${reactName}Capture`;
  const listeners: DispatchListener[] = [];
  let fiber: Fiber | null = targetFiber;

  while (fiber !== null) {
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    const listener = props[inCapturePhase ? captureName : reactName];
    if (typeof listener === "function") {
      listeners.push({
        instance: fiber,
        listener: listener as (event: ReactSyntheticEvent) => void,
        currentTarget: fiber.stateNode instanceof EventTarget ? fiber.stateNode : null,
      });
    }

    if (accumulateTargetOnly) {
      break;
    }
    fiber = fiber.return;
  }

  return inCapturePhase ? listeners.reverse() : listeners;
}

export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string,
): DispatchListener[] {
  const captureName = `${reactName}Capture`;
  const capture: DispatchListener[] = [];
  const bubble: DispatchListener[] = [];
  let fiber = targetFiber;

  while (fiber !== null) {
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    const currentTarget = fiber.stateNode instanceof EventTarget ? fiber.stateNode : null;
    const captureListener = props[captureName];
    if (typeof captureListener === "function") {
      capture.push({
        instance: fiber,
        listener: captureListener as (event: ReactSyntheticEvent) => void,
        currentTarget,
      });
    }
    const bubbleListener = props[reactName];
    if (typeof bubbleListener === "function") {
      bubble.push({
        instance: fiber,
        listener: bubbleListener as (event: ReactSyntheticEvent) => void,
        currentTarget,
      });
    }
    fiber = fiber.return;
  }

  return [...capture.reverse(), ...bubble];
}

export function accumulateEnterLeaveTwoPhaseListeners(
  dispatchQueue: DispatchQueue,
  leaveEvent: ReactSyntheticEvent,
  enterEvent: ReactSyntheticEvent | null,
  from: Fiber | null,
  to: Fiber | null,
): void {
  const common = getLowestCommonAncestor(from, to);
  const leaveName = leaveEvent.type.startsWith("pointer") ? "onPointerLeave" : "onMouseLeave";
  const enterName = leaveEvent.type.startsWith("pointer") ? "onPointerEnter" : "onMouseEnter";
  const leaveListeners = accumulateEnterLeaveListeners(from, common, leaveName);
  if (leaveListeners.length > 0) {
    dispatchQueue.push({ event: leaveEvent, listeners: leaveListeners });
  }

  if (enterEvent !== null) {
    const enterListeners = accumulateEnterLeaveListeners(to, common, enterName).reverse();
    if (enterListeners.length > 0) {
      dispatchQueue.push({ event: enterEvent, listeners: enterListeners });
    }
  }
}

function accumulateEnterLeaveListeners(
  from: Fiber | null,
  common: Fiber | null,
  registrationName: string,
): DispatchListener[] {
  const listeners: DispatchListener[] = [];
  let fiber = from;
  while (fiber !== null && fiber !== common) {
    const props = fiber.memoizedProps ?? fiber.pendingProps;
    const listener = props[registrationName];
    if (typeof listener === "function") {
      listeners.push({
        instance: fiber,
        listener: listener as (event: ReactSyntheticEvent) => void,
        currentTarget: fiber.stateNode instanceof EventTarget ? fiber.stateNode : null,
      });
    }
    fiber = fiber.return;
  }
  return listeners;
}

function getLowestCommonAncestor(a: Fiber | null, b: Fiber | null): Fiber | null {
  if (a === null || b === null) {
    return null;
  }

  const ancestors = new Set<Fiber>();
  let node: Fiber | null = a;
  while (node !== null) {
    ancestors.add(node);
    node = node.return;
  }

  node = b;
  while (node !== null) {
    if (ancestors.has(node)) {
      return node;
    }
    node = node.return;
  }

  return null;
}

export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  _eventSystemFlags: EventSystemFlags,
): void {
  for (const { event, listeners } of dispatchQueue) {
    for (const dispatchListener of listeners) {
      if (event.isPropagationStopped()) {
        break;
      }
      event.currentTarget = dispatchListener.currentTarget;
      dispatchListener.listener(event);
      event.currentTarget = null;
    }
  }
}
