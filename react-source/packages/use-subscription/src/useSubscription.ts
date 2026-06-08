/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { useSyncExternalStore } from "use-sync-external-store";

// @beginner: 定义 Subscription：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Subscription<Value> {
  getCurrentValue(): Value;
  subscribe(callback: () => void): () => void;
}

// @beginner: 进入 useSubscription：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useSubscription<Value>(subscription: Subscription<Value>): Value {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return useSyncExternalStore(
    subscription.subscribe,
    subscription.getCurrentValue,
    subscription.getCurrentValue,
  );
}
