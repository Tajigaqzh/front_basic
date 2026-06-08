import { canUseDOM } from "shared";

export let passiveBrowserEventsSupported = false;

if (canUseDOM) {
  try {
    const options = {};
    Object.defineProperty(options, "passive", {
      get() {
        passiveBrowserEventsSupported = true;
        return false;
      },
    });
    window.addEventListener("test", () => undefined, options);
    window.removeEventListener("test", () => undefined, options);
  } catch {
    passiveBrowserEventsSupported = false;
  }
}
