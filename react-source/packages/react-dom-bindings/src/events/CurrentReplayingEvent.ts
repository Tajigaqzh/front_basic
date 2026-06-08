/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AnyNativeEvent } from "./PluginModuleType.js";

// @beginner: 声明 currentReplayingEvent：保存当前步骤需要读取或更新的数据。
let currentReplayingEvent: AnyNativeEvent | null = null;

// @beginner: 进入 setReplayingEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setReplayingEvent(event: AnyNativeEvent): void {
  currentReplayingEvent = event;
}

// @beginner: 进入 resetReplayingEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetReplayingEvent(): void {
  currentReplayingEvent = null;
}

// @beginner: 进入 isReplayingEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isReplayingEvent(event: AnyNativeEvent): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return event === currentReplayingEvent;
}
