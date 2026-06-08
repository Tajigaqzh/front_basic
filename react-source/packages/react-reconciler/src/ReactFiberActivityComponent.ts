import type { CapturedValue } from "./ReactCapturedValue.js";
import type { Lane } from "./ReactFiberLane.js";
import type { TreeContext } from "./ReactFiberTreeContext.js";

// 非 null ActivityState 表示一个 dehydrated Activity 边界。
export interface ActivityState {
  dehydrated: unknown;
  treeContext: TreeContext | null;
  retryLane: Lane;
  hydrationErrors: Array<CapturedValue<unknown>> | null;
}
