/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { canUseDOM } from "shared";

export default function isEventSupported(eventNameSuffix: string): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!canUseDOM) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 eventName：保存当前步骤需要读取或更新的数据。
  const eventName = `on${eventNameSuffix}`;
  // @beginner: 声明 isSupported：保存当前步骤需要读取或更新的数据。
  let isSupported = eventName in document;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isSupported) {
    // @beginner: 声明 element：保存当前步骤需要读取或更新的数据。
    const element = document.createElement("div");
    element.setAttribute(eventName, "return;");
    isSupported = typeof (element as unknown as Record<string, unknown>)[eventName] === "function";
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return isSupported;
}
