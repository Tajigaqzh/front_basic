import type { FiberRoot } from "./ReactInternalTypes.js";

interface RootState {
  isDehydrated?: boolean;
}

// React DOM 事件 replay 会询问 root shell 是否仍处于 dehydrated 状态。
// 当前复刻没有 SSR renderer，但保留这个跨模块断环入口，和官方文件名/API 对齐。
export function isRootDehydrated(root: FiberRoot): boolean {
  const currentState = root.current.memoizedState as RootState | null;
  return currentState?.isDehydrated === true;
}
