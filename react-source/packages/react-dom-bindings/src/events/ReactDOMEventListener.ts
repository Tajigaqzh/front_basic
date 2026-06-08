import type { DOMEventName } from "./DOMEventNames.js";
import { batchedUpdates } from "./ReactDOMUpdateBatching.js";

export function createEventListenerWrapper(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  listener: (event: Event) => void,
): (event: Event) => void {
  return function dispatchDiscreteEvent(nativeEvent: Event) {
    batchedUpdates(() => {
      listener(nativeEvent);
    });
  };
}

export function listenToNativeEvent(
  domEventName: DOMEventName,
  target: EventTarget,
  listener: (event: Event) => void,
): () => void {
  const wrapper = createEventListenerWrapper(target, domEventName, listener);
  target.addEventListener(domEventName, wrapper);
  return () => target.removeEventListener(domEventName, wrapper);
}
