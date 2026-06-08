export function setSrcObject(domElement: HTMLMediaElement, value: unknown): void {
  const element = domElement as HTMLMediaElement & { srcObject?: MediaProvider | null };
  if ("srcObject" in element) {
    element.srcObject = value as MediaProvider | null;
  } else if (value == null) {
    domElement.removeAttribute("src");
  }
}
