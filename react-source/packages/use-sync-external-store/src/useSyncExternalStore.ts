/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ReactSharedInternals } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import is from "shared/objectIs.js";

// @beginner: 定义 StoreInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type StoreInstance<Snapshot> = {
  value: Snapshot;
  getSnapshot: () => Snapshot;
};

// @beginner: 进入 checkIfSnapshotChanged：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function checkIfSnapshotChanged<Snapshot>(inst: StoreInstance<Snapshot>): boolean {
  // @beginner: 声明 latestGetSnapshot：保存当前步骤需要读取或更新的数据。
  const latestGetSnapshot = inst.getSnapshot;
  // @beginner: 声明 prevValue：保存当前步骤需要读取或更新的数据。
  const prevValue = inst.value;
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 nextValue：保存当前步骤需要读取或更新的数据。
    const nextValue = latestGetSnapshot();
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return !is(prevValue, nextValue);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
}

// @beginner: 进入 useSyncExternalStore：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  _getServerSnapshot?: () => Snapshot,
): Snapshot {
  // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
  const value = getSnapshot();
  // @beginner: 声明 dispatcher：保存当前步骤需要读取或更新的数据。
  const dispatcher = ReactSharedInternals.H;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (dispatcher === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return value;
  }

  // @beginner: 声明 变量：保存当前步骤需要读取或更新的数据。
  const [{ inst }, forceUpdate] = dispatcher.useState({
    inst: { value, getSnapshot } as StoreInstance<Snapshot>,
  });

  dispatcher.useEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({ inst });
    }

    // @beginner: 定义 handleStoreChange：这里保存一个可调用函数，后续代码会在需要时执行它。
    const handleStoreChange = () => {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (checkIfSnapshotChanged(inst)) {
        forceUpdate({ inst });
      }
    };

    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return subscribe(handleStoreChange);
  }, [subscribe, value, getSnapshot]);

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value;
}
