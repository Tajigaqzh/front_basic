import type { Props } from "shared";

function updateOptions(node: HTMLSelectElement, multiple: boolean, propValue: unknown): void {
  const options = node.options;
  if (multiple) {
    const selectedValues = new Set(Array.isArray(propValue) ? propValue.map(String) : []);
    for (let i = 0; i < options.length; i += 1) {
      options[i].selected = selectedValues.has(options[i].value);
    }
  } else {
    const selectedValue = propValue == null ? "" : String(propValue);
    for (let i = 0; i < options.length; i += 1) {
      if (options[i].value === selectedValue) {
        options[i].selected = true;
        return;
      }
    }
    if (options.length > 0) {
      options[0].selected = true;
    }
  }
}

export function initSelect(
  element: HTMLSelectElement,
  value: unknown,
  defaultValue: unknown,
  multiple: boolean,
): void {
  element.multiple = Boolean(multiple);
  if (value != null) {
    updateOptions(element, Boolean(multiple), value);
  } else if (defaultValue != null) {
    updateOptions(element, Boolean(multiple), defaultValue);
  }
}

export function updateSelect(
  element: HTMLSelectElement,
  value: unknown,
  defaultValue: unknown,
  multiple: boolean,
  wasMultiple: boolean,
): void {
  element.multiple = Boolean(multiple);
  if (value != null) {
    updateOptions(element, Boolean(multiple), value);
  } else if (wasMultiple !== Boolean(multiple)) {
    updateOptions(element, Boolean(multiple), defaultValue ?? (multiple ? [] : ""));
  }
}

export function restoreControlledSelectState(element: HTMLSelectElement, props: Props): void {
  if (props.value != null) {
    updateOptions(element, Boolean(props.multiple), props.value);
  }
}
