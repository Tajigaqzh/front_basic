import type { AnyNativeEvent } from "./PluginModuleType.js";

let currentReplayingEvent: AnyNativeEvent | null = null;

export function setReplayingEvent(event: AnyNativeEvent): void {
  currentReplayingEvent = event;
}

export function resetReplayingEvent(): void {
  currentReplayingEvent = null;
}

export function isReplayingEvent(event: AnyNativeEvent): boolean {
  return event === currentReplayingEvent;
}
