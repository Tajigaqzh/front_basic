import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { IS_CAPTURE_PHASE } from "../EventSystemFlags.js";
import { topLevelEventsToReactNames, registerSimpleEvents } from "../DOMEventProperties.js";
import { accumulateSinglePhaseListeners } from "../DOMPluginEventSystem.js";
import getEventCharCode from "../getEventCharCode.js";

export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget,
): void {
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined || reactName === null) {
    return;
  }

  if (domEventName === "keypress" && getEventCharCode(nativeEvent as KeyboardEvent) === 0) {
    return;
  }

  if (domEventName === "click" && nativeEvent.button === 2) {
    return;
  }

  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  const accumulateTargetOnly =
    !inCapturePhase && (domEventName === "scroll" || domEventName === "scrollend");
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent,
  );

  if (listeners.length > 0) {
    const event = createSyntheticEvent(nativeEvent);
    event.type =
      domEventName === "focusin" ? "focus" : domEventName === "focusout" ? "blur" : domEventName;
    event.target = nativeEventTarget;
    dispatchQueue.push({ event, listeners });
  }
}

export { registerSimpleEvents as registerEvents };
