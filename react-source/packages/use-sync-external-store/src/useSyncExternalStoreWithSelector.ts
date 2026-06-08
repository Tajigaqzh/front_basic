/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { useSyncExternalStore } from "./useSyncExternalStore.js";

// @beginner: 进入 useSyncExternalStoreWithSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual: ((a: Selection, b: Selection) => boolean) | undefined,
): Selection {
  // @beginner: 声明 selected：保存当前步骤需要读取或更新的数据。
  const selected = selector(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isEqual) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return selected;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return selected;
}
