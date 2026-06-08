import type { EventHandleOptions, ReactDOMEventHandle } from "./ReactDOMEventHandleTypes.js";

export function createEventHandle(type: string, options?: EventHandleOptions): ReactDOMEventHandle {
  return function eventHandle(target: EventTarget, callback: (event: Event) => void): () => void {
    target.addEventListener(type, callback, {
      capture: Boolean(options?.capture),
      passive: options?.passive,
    });
    return () => target.removeEventListener(type, callback, Boolean(options?.capture));
  };
}
