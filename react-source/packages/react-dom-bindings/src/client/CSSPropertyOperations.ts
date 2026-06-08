import { hyphenateStyleName } from "../shared/hyphenateStyleName.js";

export function setValueForStyles(node: HTMLElement, styles: unknown, prevStyles: unknown = null): void {
  const style = node.style;
  const previous = isStyleObject(prevStyles) ? prevStyles : {};
  const next = isStyleObject(styles) ? styles : {};

  for (const styleName of Object.keys(previous)) {
    if (!(styleName in next)) {
      style.setProperty(hyphenateStyleName(styleName), "");
    }
  }

  for (const styleName of Object.keys(next)) {
    style.setProperty(hyphenateStyleName(styleName), String(next[styleName]));
  }
}

function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
