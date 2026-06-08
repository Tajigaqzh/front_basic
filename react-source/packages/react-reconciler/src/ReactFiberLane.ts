/**
 * @beginner-module: 源码导读
 * 本文件定义 Lane 优先级模型，用位运算表示不同更新优先级。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 Lane：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Lane = number;
// @beginner: 定义 Lanes：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Lanes = number;

// @beginner: 声明 NoLane：保存当前步骤需要读取或更新的数据。
export const NoLane = 0b0000;
// @beginner: 声明 NoLanes：保存当前步骤需要读取或更新的数据。
export const NoLanes = 0b0000;
// @beginner: 声明 SyncLane：保存当前步骤需要读取或更新的数据。
export const SyncLane = 0b0001;
// @beginner: 声明 DefaultLane：保存当前步骤需要读取或更新的数据。
export const DefaultLane = 0b0010;
// @beginner: 声明 TransitionLane：保存当前步骤需要读取或更新的数据。
export const TransitionLane = 0b0100;
// @beginner: 声明 TransitionLane2：保存当前步骤需要读取或更新的数据。
export const TransitionLane2 = 0b1000;
// @beginner: 声明 TransitionLanes：保存当前步骤需要读取或更新的数据。
export const TransitionLanes = TransitionLane | TransitionLane2;
// @beginner: 声明 RetryLane：保存当前步骤需要读取或更新的数据。
export const RetryLane = 0b1_0000;
// @beginner: 声明 OffscreenLane：保存当前步骤需要读取或更新的数据。
export const OffscreenLane = 0b10_0000;

// @beginner: 进入 mergeLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return a | b;
}

// @beginner: 进入 includesSomeLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function includesSomeLane(a: Lanes, b: Lanes): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (a & b) !== NoLanes;
}

// @beginner: 进入 isSubsetOfLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (set & subset) === subset;
}

// @beginner: 进入 getHighestPriorityLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getHighestPriorityLane(lanes: Lanes): Lane {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return lanes & -lanes;
}

// @beginner: 进入 getNextLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getNextLanes(root: { pendingLanes: Lanes; entangledLanes?: Lanes }): Lanes {
  // @beginner: 声明 nextLane：保存当前步骤需要读取或更新的数据。
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextLane === NoLane) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return NoLanes;
  }

  // @beginner: 声明 entangledLanes：保存当前步骤需要读取或更新的数据。
  const entangledLanes = root.entangledLanes ?? NoLanes;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (includesSomeLane(nextLane, entangledLanes)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return mergeLanes(nextLane, root.pendingLanes & entangledLanes);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nextLane;
}

// @beginner: 进入 includesSyncLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function includesSyncLane(lanes: Lanes): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return includesSomeLane(lanes, SyncLane);
}

// @beginner: 进入 includesTransitionLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function includesTransitionLane(lanes: Lanes): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return includesSomeLane(lanes, TransitionLanes);
}

// @beginner: 进入 removeLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function removeLanes(set: Lanes, subset: Lanes): Lanes {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return set & ~subset;
}

// @beginner: 进入 intersectLanes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function intersectLanes(a: Lanes, b: Lanes): Lanes {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return a & b;
}

// @beginner: 进入 isTransitionLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isTransitionLane(lane: Lane): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return includesSomeLane(lane, TransitionLanes);
}

// @beginner: 进入 getBumpedLaneForHydration：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getBumpedLaneForHydration(
  root: { suspendedLanes?: Lanes },
  renderLanes: Lanes,
): Lane {
  // @beginner: 声明 renderLane：保存当前步骤需要读取或更新的数据。
  const renderLane = getHighestPriorityLane(removeLanes(renderLanes, OffscreenLane));
  // @beginner: 声明 bumpedLane：保存当前步骤需要读取或更新的数据。
  const bumpedLane = getBumpedLaneForHydrationByLane(renderLane);
  // @beginner: 声明 suspendedLanes：保存当前步骤需要读取或更新的数据。
  const suspendedLanes = root.suspendedLanes ?? NoLanes;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (bumpedLane === NoLane || includesSomeLane(bumpedLane, renderLanes | suspendedLanes)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return NoLane;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return bumpedLane;
}

// @beginner: 进入 getBumpedLaneForHydrationByLane：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getBumpedLaneForHydrationByLane(lane: Lane): Lane {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (lane) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SyncLane:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return DefaultLane;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case DefaultLane:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TransitionLane:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TransitionLane2:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return RetryLane;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return NoLane;
  }
}
