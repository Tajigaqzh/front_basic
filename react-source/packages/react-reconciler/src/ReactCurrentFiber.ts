/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";

// @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
export let current: Fiber | null = null;
// @beginner: 声明 isRendering：保存当前步骤需要读取或更新的数据。
export let isRendering = false;

// @beginner: 进入 setCurrentFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setCurrentFiber(fiber: Fiber | null): void {
  current = fiber;
}

// @beginner: 进入 setIsRendering：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setIsRendering(rendering: boolean): void {
  isRendering = rendering;
}

// @beginner: 进入 resetCurrentFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetCurrentFiber(): void {
  current = null;
  isRendering = false;
}
