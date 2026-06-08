import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { registerDirectEvent } from "../EventRegistry.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { accumulateEnterLeaveTwoPhaseListeners } from "../DOMPluginEventSystem.js";

type RelatedTargetWithFiber = EventTarget & { __reactFiber?: Fiber | null };

export function registerEvents(): void {
  registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
  registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
  registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
  registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
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
  const isOverEvent = domEventName === "mouseover" || domEventName === "pointerover";
  const isOutEvent = domEventName === "mouseout" || domEventName === "pointerout";
  if (!isOverEvent && !isOutEvent) {
    return;
  }

  let from: Fiber | null;
  let to: Fiber | null;
  if (isOutEvent) {
    const related = (nativeEvent.relatedTarget ?? null) as RelatedTargetWithFiber | null;
    from = targetInst;
    to = related?.__reactFiber ?? null;
  } else {
    from = null;
    to = targetInst;
  }

  if (from === to) {
    return;
  }

  const isPointer = domEventName === "pointerout" || domEventName === "pointerover";
  const leave = createSyntheticEvent(nativeEvent);
  leave.type = isPointer ? "pointerleave" : "mouseleave";
  leave.target = from?.stateNode instanceof EventTarget ? from.stateNode : nativeEventTarget;
  leave.relatedTarget = to?.stateNode instanceof EventTarget ? to.stateNode : null;

  let enter = null;
  if (to !== null) {
    enter = createSyntheticEvent(nativeEvent);
    enter.type = isPointer ? "pointerenter" : "mouseenter";
    enter.target = to.stateNode instanceof EventTarget ? to.stateNode : nativeEventTarget;
    enter.relatedTarget = leave.target;
  }

  accumulateEnterLeaveTwoPhaseListeners(dispatchQueue, leave, enter, from, to);
}
