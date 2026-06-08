import type { Props } from "shared";
import { trackValueOnNode } from "./inputValueTracking.js";

type TextAreaElement = HTMLTextAreaElement & {
  _wrapperState?: { initialValue: string };
};

function getToStringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function initTextarea(
  element: TextAreaElement,
  value: unknown,
  defaultValue: unknown,
  children: unknown,
): void {
  const initialValue =
    value != null ? getToStringValue(value) : defaultValue != null ? getToStringValue(defaultValue) : getToStringValue(children);
  element.defaultValue = initialValue;
  element.value = initialValue;
  element._wrapperState = { initialValue };
  trackValueOnNode(element);
}

export function updateTextarea(element: TextAreaElement, value: unknown, defaultValue: unknown): void {
  if (value != null) {
    const nextValue = getToStringValue(value);
    if (element.value !== nextValue) {
      element.value = nextValue;
    }
    element.defaultValue = nextValue;
  } else if (defaultValue != null) {
    element.defaultValue = getToStringValue(defaultValue);
  }
}

export function restoreControlledTextareaState(element: TextAreaElement, props: Props): void {
  updateTextarea(element, props.value, props.defaultValue);
}
