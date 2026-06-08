import type { DOMEventName } from "./DOMEventNames.js";
import type { EventSystemFlags } from "./EventSystemFlags.js";
import type { AnyNativeEvent } from "./PluginModuleType.js";
import { resetReplayingEvent, setReplayingEvent } from "./CurrentReplayingEvent.js";

export interface QueuedReplayableEvent {
  blockedOn: EventTarget | null;
  domEventName: DOMEventName;
  eventSystemFlags: EventSystemFlags;
  nativeEvent: AnyNativeEvent;
  targetContainers: EventTarget[];
}

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

let queuedFocus: QueuedReplayableEvent | null = null;
let queuedDrag: QueuedReplayableEvent | null = null;
let queuedMouse: QueuedReplayableEvent | null = null;
const queuedPointers: Map<number, QueuedReplayableEvent> = new Map();
const queuedPointerCaptures: Map<number, QueuedReplayableEvent> = new Map();

export function isDiscreteEventThatRequiresHydration(eventType: DOMEventName): boolean {
  return discreteReplayableEvents.includes(eventType);
}

function createQueuedReplayableEvent(
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): QueuedReplayableEvent {
  return {
    blockedOn,
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetContainers: [targetContainer],
  };
}

function accumulateOrCreateContinuousQueuedReplayableEvent(
  existingQueuedEvent: QueuedReplayableEvent | null,
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): QueuedReplayableEvent {
  if (existingQueuedEvent === null || existingQueuedEvent.nativeEvent !== nativeEvent) {
    return createQueuedReplayableEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent);
  }

  existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
  if (!existingQueuedEvent.targetContainers.includes(targetContainer)) {
    existingQueuedEvent.targetContainers.push(targetContainer);
  }
  return existingQueuedEvent;
}

export function clearIfContinuousEvent(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): void {
  switch (domEventName) {
    case "focusin":
    case "focusout":
      queuedFocus = null;
      break;
    case "dragenter":
    case "dragleave":
      queuedDrag = null;
      break;
    case "mouseover":
    case "mouseout":
      queuedMouse = null;
      break;
    case "pointerover":
    case "pointerout":
      queuedPointers.delete(nativeEvent.pointerId ?? 0);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      queuedPointerCaptures.delete(nativeEvent.pointerId ?? 0);
      break;
  }
}

export function queueIfContinuousEvent(
  blockedOn: EventTarget | null,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): boolean {
  switch (domEventName) {
    case "focusin":
      queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedFocus,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      return true;
    case "dragenter":
      queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedDrag,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      return true;
    case "mouseover":
      queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
        queuedMouse,
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      return true;
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
      return true;
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
      return true;
    default:
      return false;
  }
}

export function hasQueuedContinuousEvents(): boolean {
  return (
    queuedFocus !== null ||
    queuedDrag !== null ||
    queuedMouse !== null ||
    queuedPointers.size > 0 ||
    queuedPointerCaptures.size > 0
  );
}

export function replayUnblockedEvents(
  dispatch: (queuedEvent: QueuedReplayableEvent) => void,
): void {
  const queued: QueuedReplayableEvent[] = [];
  if (queuedFocus !== null) queued.push(queuedFocus);
  if (queuedDrag !== null) queued.push(queuedDrag);
  if (queuedMouse !== null) queued.push(queuedMouse);
  queued.push(...queuedPointers.values(), ...queuedPointerCaptures.values());

  queuedFocus = null;
  queuedDrag = null;
  queuedMouse = null;
  queuedPointers.clear();
  queuedPointerCaptures.clear();

  for (const queuedEvent of queued) {
    setReplayingEvent(queuedEvent.nativeEvent);
    try {
      dispatch(queuedEvent);
    } finally {
      resetReplayingEvent();
    }
  }
}
