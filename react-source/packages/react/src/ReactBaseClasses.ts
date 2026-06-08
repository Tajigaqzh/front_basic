/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactNoopUpdateQueue, { type UpdateQueue } from "./ReactNoopUpdateQueue.js";

// @beginner: 定义 Component：把相关状态和方法组织在同一个对象上。
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

// @beginner: 定义 PureComponent：把相关状态和方法组织在同一个对象上。
export class PureComponent<P = Record<string, unknown>, S = Record<string, unknown>> extends Component<P, S> {
  isPureReactComponent = true;
}
