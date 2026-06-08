/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactNode, Wakeable } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { SpawnedCachePool } from "./ReactFiberCacheComponent.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { RetryQueue } from "./ReactFiberSuspenseComponent.js";

// @beginner: 定义 OffscreenMode：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type OffscreenMode = "hidden" | "unstable-defer-without-hiding" | "visible";

// @beginner: 定义 LegacyHiddenProps：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface LegacyHiddenProps {
  mode?: OffscreenMode | null;
  children?: ReactNode;
}

// @beginner: 定义 OffscreenProps：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface OffscreenProps {
  mode?: OffscreenMode | null;
  children?: ReactNode;
}

// @beginner: 定义 OffscreenState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface OffscreenState {
  baseLanes: Lanes;
  cachePool: SpawnedCachePool | null;
}

// @beginner: 定义 OffscreenQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface OffscreenQueue {
  transitions: unknown[] | null;
  markerInstances: unknown[] | null;
  retryQueue: RetryQueue | null;
}

// @beginner: 定义 OffscreenVisibility：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type OffscreenVisibility = number;

// @beginner: 声明 OffscreenVisible：保存当前步骤需要读取或更新的数据。
export const OffscreenVisible = 0b001;
// @beginner: 声明 OffscreenPassiveEffectsConnected：保存当前步骤需要读取或更新的数据。
export const OffscreenPassiveEffectsConnected = 0b010;

// @beginner: 定义 OffscreenInstance：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface OffscreenInstance {
  _visibility: OffscreenVisibility;
  _pendingMarkers: Set<unknown> | null;
  _transitions: Set<unknown> | null;
  _retryCache: WeakSet<Wakeable> | Set<Wakeable> | null;
}

// @beginner: 进入 createOffscreenInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createOffscreenInstance(visible = true): OffscreenInstance {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    _visibility: visible ? OffscreenVisible : 0,
    _pendingMarkers: null,
    _transitions: null,
    _retryCache: null,
  };
}

// @beginner: 进入 isOffscreenVisible：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isOffscreenVisible(instance: OffscreenInstance): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (instance._visibility & OffscreenVisible) !== 0;
}
