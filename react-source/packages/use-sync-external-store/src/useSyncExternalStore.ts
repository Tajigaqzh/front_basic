import { ReactSharedInternals } from "shared";
import is from "shared/objectIs.js";

type StoreInstance<Snapshot> = {
  value: Snapshot;
  getSnapshot: () => Snapshot;
};

function checkIfSnapshotChanged<Snapshot>(inst: StoreInstance<Snapshot>): boolean {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !is(prevValue, nextValue);
  } catch {
    return true;
  }
}

export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  _getServerSnapshot?: () => Snapshot,
): Snapshot {
  const value = getSnapshot();
  const dispatcher = ReactSharedInternals.H;

  if (dispatcher === null) {
    return value;
  }

  const [{ inst }, forceUpdate] = dispatcher.useState({
    inst: { value, getSnapshot } as StoreInstance<Snapshot>,
  });

  dispatcher.useEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;

    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({ inst });
    }

    const handleStoreChange = () => {
      if (checkIfSnapshotChanged(inst)) {
        forceUpdate({ inst });
      }
    };

    return subscribe(handleStoreChange);
  }, [subscribe, value, getSnapshot]);

  return value;
}
