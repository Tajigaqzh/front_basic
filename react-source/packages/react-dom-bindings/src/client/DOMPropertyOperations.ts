export function setValueForAttribute(node: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    node.removeAttribute(name);
    return;
  }

  node.setAttribute(name, String(value));
}

export function setValueForKnownAttribute(node: Element, name: string, value: unknown): void {
  setValueForAttribute(node, name === "className" ? "class" : name, value);
}
