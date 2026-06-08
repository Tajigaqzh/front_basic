export type ReactDOMEventHandle = (target: EventTarget, callback: (event: Event) => void) => () => void;
export type ReactDOMEventHandleListener = (event: Event) => void;
export interface EventHandleOptions {
  capture?: boolean;
  passive?: boolean;
}
