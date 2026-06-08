let root: EventTarget | null = null;
let startText = "";
let fallbackText = "";

function getText(node: EventTarget | null): string {
  const target = node as { value?: unknown; textContent?: string | null } | null;
  if (target === null) {
    return "";
  }
  if (typeof target.value === "string") {
    return target.value;
  }
  return target.textContent ?? "";
}

export function initialize(nativeEventTarget: EventTarget | null): boolean {
  root = nativeEventTarget;
  startText = getText(root);
  fallbackText = "";
  return true;
}

export function reset(): void {
  root = null;
  startText = "";
  fallbackText = "";
}

export function getData(): string {
  if (fallbackText !== "") {
    return fallbackText;
  }
  const endText = getText(root);
  let start = 0;
  while (start < startText.length && startText[start] === endText[start]) {
    start += 1;
  }
  let end = 0;
  while (
    end < startText.length - start &&
    end < endText.length - start &&
    startText[startText.length - 1 - end] === endText[endText.length - 1 - end]
  ) {
    end += 1;
  }
  fallbackText = end === 0 ? endText.slice(start) : endText.slice(start, -end);
  return fallbackText;
}
