import { useSyncExternalStore } from "./useSyncExternalStore.js";

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual: ((a: Selection, b: Selection) => boolean) | undefined,
): Selection {
  const selected = selector(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
  if (isEqual) {
    return selected;
  }
  return selected;
}
