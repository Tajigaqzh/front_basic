import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { registerTwoPhaseEvent } from "../EventRegistry.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { accumulateTwoPhaseListeners } from "../DOMPluginEventSystem.js";
import isTextInputElement from "../isTextInputElement.js";
import { shallowEqual } from "shared";

let activeElement: any = null;
let activeElementInst: Fiber | null = null;
let lastSelection: unknown = null;
let mouseDown = false;

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

function getSelection(node: any): unknown {
  if ("selectionStart" in node && "selectionEnd" in node) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd,
    };
  }

  return {
    text: typeof node.textContent === "string" ? node.textContent : "",
  };
}

function constructSelectEvent(
  dispatchQueue: DispatchQueue,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
): void {
  if (mouseDown || activeElement === null) {
    return;
  }

  const currentSelection = getSelection(activeElement);
  if (lastSelection !== null && shallowEqual(lastSelection, currentSelection)) {
    return;
  }
  lastSelection = currentSelection;

  const listeners = accumulateTwoPhaseListeners(activeElementInst, "onSelect");
  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = "select";
    event.target = activeElement;
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
  const targetNode = (targetInst?.stateNode ?? nativeEventTarget) as any;

  switch (domEventName) {
    case "focusin":
      if (isTextInputElement(targetNode) || targetNode?.contentEditable === "true") {
        activeElement = targetNode;
        activeElementInst = targetInst;
        lastSelection = null;
      }
      break;
    case "focusout":
      activeElement = null;
      activeElementInst = null;
      lastSelection = null;
      break;
    case "mousedown":
      mouseDown = true;
      break;
    case "contextmenu":
    case "mouseup":
    case "dragend":
      mouseDown = false;
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      break;
    case "selectionchange":
    case "keydown":
    case "keyup":
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      break;
  }
}
