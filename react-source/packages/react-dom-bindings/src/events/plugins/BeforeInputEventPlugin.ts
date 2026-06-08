import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { registerTwoPhaseEvent } from "../EventRegistry.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { accumulateTwoPhaseListeners } from "../DOMPluginEventSystem.js";
import {
  getData as getFallbackData,
  initialize as initializeFallbackCompositionState,
  reset as resetFallbackCompositionState,
} from "../FallbackCompositionState.js";

const END_KEYCODES = [9, 13, 27, 32];
const START_KEYCODE = 229;
let isComposing = false;

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

function getCompositionEventType(domEventName: DOMEventName): string | null {
  switch (domEventName) {
    case "compositionstart":
      return "onCompositionStart";
    case "compositionend":
      return "onCompositionEnd";
    case "compositionupdate":
      return "onCompositionUpdate";
    default:
      return null;
  }
}

function isFallbackCompositionStart(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): boolean {
  return domEventName === "keydown" && nativeEvent.keyCode === START_KEYCODE;
}

function isFallbackCompositionEnd(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): boolean {
  switch (domEventName) {
    case "keyup":
      return END_KEYCODES.includes(nativeEvent.keyCode ?? 0);
    case "keydown":
      return nativeEvent.keyCode !== START_KEYCODE;
    case "keypress":
    case "mousedown":
    case "focusout":
      return true;
    default:
      return false;
  }
}

function getDataFromCustomEvent(nativeEvent: AnyNativeEvent): string | null {
  if (typeof nativeEvent.data === "string") {
    return nativeEvent.data;
  }
  const detail = (nativeEvent as { detail?: unknown }).detail;
  if (detail !== null && typeof detail === "object" && "data" in detail) {
    const data = (detail as { data?: unknown }).data;
    return typeof data === "string" ? data : null;
  }
  return null;
}

function extractCompositionEvent(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  let eventType = getCompositionEventType(domEventName);
  let fallbackData: string | null = null;

  if (eventType === null) {
    if (!isComposing && isFallbackCompositionStart(domEventName, nativeEvent)) {
      eventType = "onCompositionStart";
    } else if (isComposing && isFallbackCompositionEnd(domEventName, nativeEvent)) {
      eventType = "onCompositionEnd";
    }
  }

  if (eventType === null) {
    return;
  }

  if (!isComposing && eventType === "onCompositionStart") {
    isComposing = initializeFallbackCompositionState(nativeEventTarget);
  } else if (eventType === "onCompositionEnd" && isComposing) {
    fallbackData = getFallbackData();
    resetFallbackCompositionState();
    isComposing = false;
  }

  const listeners = accumulateTwoPhaseListeners(targetInst, eventType);
  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = domEventName;
    event.target = nativeEventTarget;
    event.data = fallbackData ?? getDataFromCustomEvent(nativeEvent);
    dispatchQueue.push({ event, listeners });
  }
}

function getBeforeInputChars(domEventName: DOMEventName, nativeEvent: AnyNativeEvent): string | null {
  if (domEventName === "compositionend") {
    return getDataFromCustomEvent(nativeEvent) ?? (nativeEvent as { data?: string }).data ?? null;
  }

  if (domEventName === "keypress") {
    if ((nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) && !(nativeEvent.ctrlKey && nativeEvent.altKey)) {
      return null;
    }
    const which = nativeEvent.which ?? nativeEvent.charCode ?? 0;
    return which === 0 ? null : String.fromCharCode(which);
  }

  if (domEventName === "textInput") {
    const data = (nativeEvent as { data?: string }).data;
    return data === undefined || data === "" ? null : data;
  }

  return null;
}

function extractBeforeInputEvent(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  const chars = getBeforeInputChars(domEventName, nativeEvent);
  if (chars === null) {
    return;
  }

  const listeners = accumulateTwoPhaseListeners(targetInst, "onBeforeInput");
  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = "beforeinput";
    event.target = nativeEventTarget;
    event.data = chars;
    dispatchQueue.push({ event, listeners });
  }
}

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
