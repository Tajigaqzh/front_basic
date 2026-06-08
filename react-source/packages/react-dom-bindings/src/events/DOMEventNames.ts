export type DOMEventName = keyof GlobalEventHandlersEventMap | string;

export const ANIMATION_END = "animationend";
export const ANIMATION_ITERATION = "animationiteration";
export const ANIMATION_START = "animationstart";
export const TRANSITION_RUN = "transitionrun";
export const TRANSITION_START = "transitionstart";
export const TRANSITION_CANCEL = "transitioncancel";
export const TRANSITION_END = "transitionend";
