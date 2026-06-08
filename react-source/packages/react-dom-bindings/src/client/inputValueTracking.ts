type TrackableElement = (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) & {
  _valueTracker?: ValueTracker | null;
};

export interface ValueTracker {
  getValue(): string;
  setValue(value: string): void;
  stopTracking(): void;
}

function getValueFromNode(node: TrackableElement): string {
  if ("checked" in node && (node.type === "checkbox" || node.type === "radio")) {
    return node.checked ? "true" : "false";
  }
  return node.value;
}

export function trackValueOnNode(node: TrackableElement): ValueTracker | null {
  if (node._valueTracker) {
    return node._valueTracker;
  }
  let currentValue = getValueFromNode(node);
  const tracker: ValueTracker = {
    getValue() {
      return currentValue;
    },
    setValue(value: string) {
      currentValue = value;
    },
    stopTracking() {
      node._valueTracker = null;
    },
  };
  node._valueTracker = tracker;
  return tracker;
}

export function track(node: TrackableElement): void {
  trackValueOnNode(node);
}

export function updateValueIfChanged(node: TrackableElement): boolean {
  const tracker = node._valueTracker;
  if (!tracker) {
    return true;
  }
  const lastValue = tracker.getValue();
  const nextValue = getValueFromNode(node);
  if (nextValue !== lastValue) {
    tracker.setValue(nextValue);
    return true;
  }
  return false;
}

export function stopTracking(node: TrackableElement): void {
  node._valueTracker?.stopTracking();
}
