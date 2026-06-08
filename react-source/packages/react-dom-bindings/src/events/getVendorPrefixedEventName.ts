import { canUseDOM } from "shared";

function makePrefixMap(styleProp: string, eventName: string): Record<string, string> {
  return {
    [styleProp.toLowerCase()]: eventName.toLowerCase(),
    [`Webkit${styleProp}`]: `webkit${eventName}`,
    [`Moz${styleProp}`]: `moz${eventName}`,
  };
}

const vendorPrefixes: Record<string, Record<string, string>> = {
  animationend: makePrefixMap("Animation", "AnimationEnd"),
  animationiteration: makePrefixMap("Animation", "AnimationIteration"),
  animationstart: makePrefixMap("Animation", "AnimationStart"),
  transitionrun: makePrefixMap("Transition", "TransitionRun"),
  transitionstart: makePrefixMap("Transition", "TransitionStart"),
  transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
  transitionend: makePrefixMap("Transition", "TransitionEnd"),
};

const prefixedEventNames: Record<string, string> = {};
let style: Record<string, unknown> = {};

if (canUseDOM) {
  style = document.createElement("div").style as unknown as Record<string, unknown>;
  if (!("AnimationEvent" in window)) {
    delete vendorPrefixes.animationend.animation;
    delete vendorPrefixes.animationiteration.animation;
    delete vendorPrefixes.animationstart.animation;
  }
  if (!("TransitionEvent" in window)) {
    delete vendorPrefixes.transitionend.transition;
  }
}

export default function getVendorPrefixedEventName(eventName: string): string {
  if (prefixedEventNames[eventName] !== undefined) {
    return prefixedEventNames[eventName];
  }

  const prefixMap = vendorPrefixes[eventName];
  if (prefixMap === undefined) {
    return eventName;
  }

  for (const styleProp of Object.keys(prefixMap)) {
    if (styleProp in style) {
      prefixedEventNames[eventName] = prefixMap[styleProp];
      return prefixedEventNames[eventName];
    }
  }

  return eventName;
}
