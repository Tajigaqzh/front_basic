import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { IS_CAPTURE_PHASE } from "../EventSystemFlags.js";
import { registerTwoPhaseEvent } from "../EventRegistry.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import {
  accumulateSinglePhaseListeners,
  accumulateTwoPhaseListeners,
  processDispatchQueue,
} from "../DOMPluginEventSystem.js";
import { batchedUpdates } from "../ReactDOMUpdateBatching.js";
import {
  clearScrollEndTimer,
  getScrollEndTimer,
  setScrollEndTimer,
} from "../../client/ReactDOMComponentTree.js";
import isEventSupported from "../isEventSupported.js";

const isScrollEndEventSupported = isEventSupported("scrollend");
const DEBOUNCE_TIMEOUT = 200;
let isTouchStarted = false;
let isMouseDown = false;

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

function manualDispatchScrollEndEvent(
  inst: Fiber,
  nativeEvent: AnyNativeEvent,
  target: EventTarget,
): void {
  const dispatchQueue: DispatchQueue = [];
  const listeners = accumulateTwoPhaseListeners(inst, "onScrollEnd");
  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = "scrollend";
    event.target = target;
    dispatchQueue.push({ event, listeners });
  }
  batchedUpdates(() => processDispatchQueue(dispatchQueue, 0));
}

function fireScrollEnd(targetInst: Fiber, nativeEvent: AnyNativeEvent, nativeEventTarget: EventTarget): void {
  clearScrollEndTimer(nativeEventTarget);
  if (isMouseDown || isTouchStarted) {
    debounceScrollEnd(targetInst, nativeEvent, nativeEventTarget);
    return;
  }
  manualDispatchScrollEndEvent(targetInst, nativeEvent, nativeEventTarget);
}

function debounceScrollEnd(
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget,
): void {
  const existingTimer = getScrollEndTimer(nativeEventTarget);
  if (existingTimer !== null) {
    clearTimeout(existingTimer);
  }
  if (targetInst !== null) {
    const timer = setTimeout(() => fireScrollEnd(targetInst, nativeEvent, nativeEventTarget), DEBOUNCE_TIMEOUT);
    setScrollEndTimer(nativeEventTarget, timer);
  }
}

export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget | null,
): void {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  if (domEventName !== "scrollend") {
    if (!isScrollEndEventSupported && inCapturePhase) {
      switch (domEventName) {
        case "scroll":
          if (nativeEventTarget !== null) {
            debounceScrollEnd(targetInst, nativeEvent, nativeEventTarget);
          }
          break;
        case "touchstart":
          isTouchStarted = true;
          break;
        case "touchcancel":
        case "touchend":
          isTouchStarted = false;
          break;
        case "mousedown":
          isMouseDown = true;
          break;
        case "mouseup":
          isMouseDown = false;
          break;
      }
    }
    return;
  }

  if (!isScrollEndEventSupported && nativeEventTarget !== null) {
    const existingTimer = getScrollEndTimer(nativeEventTarget);
    if (existingTimer !== null) {
      clearScrollEndTimer(nativeEventTarget);
    }
  }

  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    "onScrollEnd",
    "scrollend",
    inCapturePhase,
    !inCapturePhase,
    nativeEvent,
  );

  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = "scrollend";
    event.target = nativeEventTarget;
    dispatchQueue.push({ event, listeners });
  }
}
