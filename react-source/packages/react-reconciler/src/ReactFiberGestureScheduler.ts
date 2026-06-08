/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TransitionTypes } from "./ReactFiberTransitionTypes.js";

// @beginner: 定义 ScheduledGesture：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ScheduledGesture {
  provider: unknown;
  options: unknown;
  types: TransitionTypes | null;
  count: number;
  pending: boolean;
  cancelled: boolean;
}

// @beginner: 声明 gesturesByRoot：保存当前步骤需要读取或更新的数据。
const gesturesByRoot = new WeakMap<FiberRoot, ScheduledGesture[]>();

// @beginner: 进入 getGestures：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getGestures(root: FiberRoot): ScheduledGesture[] {
  // @beginner: 声明 gestures：保存当前步骤需要读取或更新的数据。
  let gestures = gesturesByRoot.get(root);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (gestures === undefined) {
    gestures = [];
    gesturesByRoot.set(root, gestures);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return gestures;
}

// @beginner: 进入 scheduleGesture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function scheduleGesture(
  root: FiberRoot,
  provider: unknown,
  options: unknown = null,
  types: TransitionTypes | null = null,
): ScheduledGesture {
  // @beginner: 声明 gesture：保存当前步骤需要读取或更新的数据。
  const gesture: ScheduledGesture = {
    provider,
    options,
    types,
    count: 0,
    pending: true,
    cancelled: false,
  };
  getGestures(root).push(gesture);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return gesture;
}

// @beginner: 进入 startScheduledGesture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startScheduledGesture(
  root: FiberRoot,
  provider: unknown,
  options: unknown = null,
  types: TransitionTypes | null = null,
): ScheduledGesture | null {
  // @beginner: 声明 existing：保存当前步骤需要读取或更新的数据。
  const existing = getGestures(root).find((gesture) => gesture.provider === provider && !gesture.cancelled);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (existing !== undefined) {
    existing.count += 1;
    existing.options = options;
    existing.types = types;
    existing.pending = false;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return existing;
  }
  // @beginner: 声明 gesture：保存当前步骤需要读取或更新的数据。
  const gesture = scheduleGesture(root, provider, options, types);
  gesture.count = 1;
  gesture.pending = false;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return gesture;
}

// @beginner: 进入 cancelScheduledGesture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function cancelScheduledGesture(root: FiberRoot, scheduledGesture: ScheduledGesture): void {
  scheduledGesture.count = Math.max(0, scheduledGesture.count - 1);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (scheduledGesture.count === 0) {
    scheduledGesture.cancelled = true;
    // @beginner: 声明 gestures：保存当前步骤需要读取或更新的数据。
    const gestures = getGestures(root);
    // @beginner: 声明 index：保存当前步骤需要读取或更新的数据。
    const index = gestures.indexOf(scheduledGesture);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (index >= 0) {
      gestures.splice(index, 1);
    }
  }
}

// @beginner: 进入 stopCommittedGesture：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function stopCommittedGesture(root: FiberRoot): void {
  gesturesByRoot.set(
    root,
    getGestures(root).filter((gesture) => gesture.pending),
  );
}

// @beginner: 进入 scheduleGestureCommit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function scheduleGestureCommit(root: FiberRoot): void {
  getGestures(root).forEach((gesture) => {
    gesture.pending = false;
  });
}

// @beginner: 进入 getScheduledGestures：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getScheduledGestures(root: FiberRoot): ScheduledGesture[] {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getGestures(root);
}
