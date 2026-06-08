import { canUseDOM } from "shared";

export default function isEventSupported(eventNameSuffix: string): boolean {
  if (!canUseDOM) {
    return false;
  }

  const eventName = `on${eventNameSuffix}`;
  let isSupported = eventName in document;

  if (!isSupported) {
    const element = document.createElement("div");
    element.setAttribute(eventName, "return;");
    isSupported = typeof (element as unknown as Record<string, unknown>)[eventName] === "function";
  }

  return isSupported;
}
