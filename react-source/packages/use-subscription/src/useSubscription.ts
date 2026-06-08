import { useSyncExternalStore } from "use-sync-external-store";

export interface Subscription<Value> {
  getCurrentValue(): Value;
  subscribe(callback: () => void): () => void;
}

export function useSubscription<Value>(subscription: Subscription<Value>): Value {
  return useSyncExternalStore(
    subscription.subscribe,
    subscription.getCurrentValue,
    subscription.getCurrentValue,
  );
}
