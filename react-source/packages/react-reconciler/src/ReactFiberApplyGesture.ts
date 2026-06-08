/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ScheduledGesture } from "./ReactFiberGestureScheduler.js";

// @beginner: 定义 GestureApplicationRecord：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface GestureApplicationRecord {
  type: "insert-destination-clones" | "departure" | "animation";
  root?: FiberRoot;
  gesture?: ScheduledGesture;
}

// @beginner: 声明 gestureApplicationRecords：保存当前步骤需要读取或更新的数据。
export const gestureApplicationRecords: GestureApplicationRecord[] = [];

// @beginner: 进入 insertDestinationClones：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function insertDestinationClones(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "insert-destination-clones", root, gesture });
}

// @beginner: 进入 applyDepartureTransitions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function applyDepartureTransitions(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "departure", root, gesture });
}

// @beginner: 进入 startGestureAnimations：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function startGestureAnimations(root?: FiberRoot, gesture?: ScheduledGesture): void {
  gestureApplicationRecords.push({ type: "animation", root, gesture });
}
