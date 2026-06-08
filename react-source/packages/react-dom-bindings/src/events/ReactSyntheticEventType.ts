export interface ReactSyntheticEvent {
  nativeEvent: Event;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  type: string;
  data?: string | null;
  relatedTarget?: EventTarget | null;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
