import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { registerTwoPhaseEvent } from "../EventRegistry.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { accumulateTwoPhaseListeners } from "../DOMPluginEventSystem.js";
import { enqueueStateRestore } from "../ReactDOMControlledComponent.js";
import isTextInputElement from "../isTextInputElement.js";

export function registerEvents(): void {
  registerTwoPhaseEvent("onChange", [
    "change",
    "click",
    "focusin",
    "focusout",
    "input",
    "keydown",
    "keyup",
    "selectionchange",
  ]);
}

function createAndAccumulateChangeEvent(
  dispatchQueue: DispatchQueue,
  inst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  target: EventTarget | null,
): void {
  enqueueStateRestore(target as Node | null);
  const listeners = accumulateTwoPhaseListeners(inst, "onChange");
  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type = "change";
    event.target = target;
    dispatchQueue.push({ event, listeners });
  }
}

function shouldUseChangeEvent(elem: unknown): boolean {
  const node = elem as { nodeName?: string; type?: string } | null;
  const nodeName = node?.nodeName?.toLowerCase();
  return nodeName === "select" || (nodeName === "input" && node?.type === "file");
}

function shouldUseClickEvent(elem: unknown): boolean {
  const node = elem as { nodeName?: string; type?: string } | null;
  return (
    node?.nodeName?.toLowerCase() === "input" &&
    (node.type === "checkbox" || node.type === "radio")
  );
}

function shouldDispatchChange(domEventName: DOMEventName, targetNode: unknown): boolean {
  if (shouldUseChangeEvent(targetNode)) {
    return domEventName === "change";
  }

  if (shouldUseClickEvent(targetNode)) {
    return domEventName === "click";
  }

  if (isTextInputElement(targetNode)) {
    return domEventName === "input" || domEventName === "change";
  }

  return false;
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
  const targetNode = targetInst?.stateNode ?? nativeEventTarget;
  if (targetInst !== null && shouldDispatchChange(domEventName, targetNode)) {
    createAndAccumulateChangeEvent(dispatchQueue, targetInst, nativeEvent, nativeEventTarget);
  }
}
