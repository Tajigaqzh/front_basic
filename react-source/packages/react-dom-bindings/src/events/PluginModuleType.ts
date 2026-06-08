export type AnyNativeEvent = Event & {
  button?: number;
  keyCode?: number;
  charCode?: number;
  which?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  relatedTarget?: EventTarget | null;
  pointerId?: number;
  data?: string;
  detail?: unknown;
};
