/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 AnyNativeEvent：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type AnyNativeEvent = Event;
// @beginner: 定义 EventListener：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type EventListener = (event: AnyNativeEvent) => void;

// @beginner: 进入 addEventBubbleListener：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
): () => void {
  target.addEventListener(eventType, listener);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => target.removeEventListener(eventType, listener);
}

// @beginner: 进入 addEventCaptureListener：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
): () => void {
  target.addEventListener(eventType, listener, true);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => target.removeEventListener(eventType, listener, true);
}

// @beginner: 进入 addEventCaptureListenerWithPassiveFlag：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addEventCaptureListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  passive: boolean,
): () => void {
  target.addEventListener(eventType, listener, { capture: true, passive });
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => target.removeEventListener(eventType, listener, true);
}

// @beginner: 进入 addEventBubbleListenerWithPassiveFlag：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addEventBubbleListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  passive: boolean,
): () => void {
  target.addEventListener(eventType, listener, { passive });
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => target.removeEventListener(eventType, listener);
}

// @beginner: 进入 removeEventListener：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: EventListener,
  capture: boolean,
): void {
  target.removeEventListener(eventType, listener, capture);
}
