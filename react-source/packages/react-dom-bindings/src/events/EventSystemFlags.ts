export const IS_EVENT_HANDLE_NON_MANAGED_NODE = 1;
export const IS_NON_DELEGATED = 1 << 1;
export const IS_CAPTURE_PHASE = 1 << 2;
export const SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS = 1 << 3;

export type EventSystemFlags = number;
