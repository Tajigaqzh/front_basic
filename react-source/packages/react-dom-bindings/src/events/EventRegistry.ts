/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";

// @beginner: 声明 allNativeEvents：保存当前步骤需要读取或更新的数据。
export const allNativeEvents: Set<DOMEventName> = new Set();

// @beginner: 声明 registrationNameDependencies：保存当前步骤需要读取或更新的数据。
export const registrationNameDependencies: Record<string, DOMEventName[]> = {};
// @beginner: 声明 possibleRegistrationNames：保存当前步骤需要读取或更新的数据。
export const possibleRegistrationNames: Record<string, string> = {};

// @beginner: 进入 registerTwoPhaseEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: DOMEventName[],
): void {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(`${registrationName}Capture`, dependencies);
}

// @beginner: 进入 registerDirectEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function registerDirectEvent(
  registrationName: string,
  dependencies: DOMEventName[],
): void {
  // 官方这里会在 DEV 下检查重复注册。当前保留覆盖语义，方便插件重复初始化。
  registrationNameDependencies[registrationName] = dependencies;
  possibleRegistrationNames[registrationName.toLowerCase()] = registrationName;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (registrationName === "onDoubleClick") {
    possibleRegistrationNames.ondblclick = registrationName;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const dependency of dependencies) {
    allNativeEvents.add(dependency);
  }
}
