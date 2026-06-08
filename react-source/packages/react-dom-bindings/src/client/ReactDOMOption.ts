export function validateOptionProps(element: HTMLOptionElement, props: { value?: unknown; children?: unknown }): void {
  if (props.value != null) {
    element.value = String(props.value);
  }
  if (props.children != null) {
    element.text = Array.isArray(props.children) ? props.children.join("") : String(props.children);
  }
}
