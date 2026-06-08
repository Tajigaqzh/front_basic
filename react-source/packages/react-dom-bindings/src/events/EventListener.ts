export type AnyNativeEvent = Event;
export type EventListener = (event: AnyNativeEvent) => void;

export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
): () => void {
  target.addEventListener(eventType, listener);
  return () => target.removeEventListener(eventType, listener);
}

export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
): () => void {
  target.addEventListener(eventType, listener, true);
  return () => target.removeEventListener(eventType, listener, true);
}

export function addEventCaptureListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  passive: boolean,
): () => void {
  target.addEventListener(eventType, listener, { capture: true, passive });
  return () => target.removeEventListener(eventType, listener, true);
}

export function addEventBubbleListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  passive: boolean,
): () => void {
  target.addEventListener(eventType, listener, { passive });
  return () => target.removeEventListener(eventType, listener);
}

export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  capture: boolean,
): void {
  target.removeEventListener(eventType, listener, capture);
}
