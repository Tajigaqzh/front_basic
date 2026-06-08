import ReactNoopUpdateQueue, { type UpdateQueue } from "./ReactNoopUpdateQueue.js";

export class Component<P = Record<string, unknown>, S = Record<string, unknown>> {
  props: P;
  context: unknown;
  refs: Record<string, unknown>;
  updater: UpdateQueue;
  state!: S;

  constructor(props: P, context?: unknown, updater: UpdateQueue = ReactNoopUpdateQueue) {
    this.props = props;
    this.context = context;
    this.refs = {};
    this.updater = updater;
  }

  setState(partialState: Partial<S> | ((state: S, props: P) => Partial<S>), callback?: () => void): void {
    this.updater.enqueueSetState(this, partialState, callback);
  }

  forceUpdate(callback?: () => void): void {
    this.updater.enqueueForceUpdate(this, callback);
  }
}

(Component.prototype as { isReactComponent?: Record<string, never> }).isReactComponent = {};

export class PureComponent<P = Record<string, unknown>, S = Record<string, unknown>> extends Component<P, S> {
  isPureReactComponent = true;
}
