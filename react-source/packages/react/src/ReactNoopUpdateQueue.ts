export interface UpdateQueue {
  isMounted(publicInstance: unknown): boolean;
  enqueueForceUpdate(publicInstance: unknown, callback?: () => void): void;
  enqueueReplaceState(publicInstance: unknown, completeState: unknown, callback?: () => void): void;
  enqueueSetState(publicInstance: unknown, partialState: unknown, callback?: () => void): void;
}

const ReactNoopUpdateQueue: UpdateQueue = {
  isMounted() {
    return false;
  },
  enqueueForceUpdate(_publicInstance, callback) {
    callback?.();
  },
  enqueueReplaceState(_publicInstance, _completeState, callback) {
    callback?.();
  },
  enqueueSetState(_publicInstance, _partialState, callback) {
    callback?.();
  },
};

export default ReactNoopUpdateQueue;
