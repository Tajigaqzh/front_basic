import type { ReactSyntheticEvent } from "./ReactSyntheticEventType.js";

export function createSyntheticEvent(nativeEvent: Event): ReactSyntheticEvent {
  let defaultPrevented = nativeEvent.defaultPrevented;
  let propagationStopped = false;

  return {
    nativeEvent,
    target: nativeEvent.target,
    currentTarget: null,
    type: nativeEvent.type,
    isDefaultPrevented: () => defaultPrevented,
    isPropagationStopped: () => propagationStopped,
    preventDefault() {
      defaultPrevented = true;
      nativeEvent.preventDefault();
    },
    stopPropagation() {
      propagationStopped = true;
      nativeEvent.stopPropagation();
    },
  };
}
