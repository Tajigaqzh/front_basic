import type { Props } from "shared";
import { trackValueOnNode, updateValueIfChanged } from "./inputValueTracking.js";

type InputElement = HTMLInputElement & {
  _wrapperState?: {
    initialChecked?: boolean;
    initialValue?: string;
    controlled: boolean;
  };
};

function toStringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function isControlled(props: Props): boolean {
  const type = props.type;
  return type === "checkbox" || type === "radio" ? props.checked != null : props.value != null;
}

export function initInput(
  element: InputElement,
  value: unknown,
  defaultValue: unknown,
  checked: unknown,
  defaultChecked: unknown,
  type: unknown,
  name: unknown,
): void {
  if (type != null) {
    element.type = String(type);
  }
  if (name != null) {
    element.name = String(name);
  }
  const initialValue = value != null ? toStringValue(value) : toStringValue(defaultValue);
  if (initialValue !== "") {
    element.value = initialValue;
  }
  element.defaultValue = initialValue;

  const initialChecked = checked != null ? Boolean(checked) : Boolean(defaultChecked);
  element.checked = initialChecked;
  element.defaultChecked = initialChecked;
  element._wrapperState = { initialChecked, initialValue, controlled: value != null || checked != null };
  trackValueOnNode(element);
}

export function updateInput(
  element: InputElement,
  value: unknown,
  defaultValue: unknown,
  checked: unknown,
  defaultChecked: unknown,
  type: unknown,
  name: unknown,
): void {
  if (type != null) {
    element.type = String(type);
  }
  if (name != null) {
    element.name = String(name);
  }
  if (value != null) {
    const nextValue = toStringValue(value);
    if (element.value !== nextValue) {
      element.value = nextValue;
    }
  } else if (defaultValue != null) {
    element.defaultValue = toStringValue(defaultValue);
  }
  if (checked != null) {
    element.checked = Boolean(checked);
  } else if (defaultChecked != null) {
    element.defaultChecked = Boolean(defaultChecked);
  }
  updateValueIfChanged(element);
}

export function restoreControlledInputState(element: InputElement, props: Props): void {
  updateInput(
    element,
    props.value,
    props.defaultValue,
    props.checked,
    props.defaultChecked,
    props.type,
    props.name,
  );
}
