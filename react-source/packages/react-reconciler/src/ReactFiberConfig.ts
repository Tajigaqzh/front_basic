/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createContext } from "react";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  createInstance,
  createTextInstance,
  setInitialProperties,
  updateProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";

// @beginner: 定义 Container：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Container = Element | DocumentFragment;
// @beginner: 定义 Instance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Instance = Element;
// @beginner: 定义 TextInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TextInstance = Text;

// @beginner: 定义 HostContext：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface HostContext {
  namespaceURI: string;
  ancestorInfo: string | null;
}

// @beginner: 定义 TransitionStatus：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TransitionStatus = "NotPending" | "Pending" | null;

// @beginner: 声明 NotPendingTransition：保存当前步骤需要读取或更新的数据。
export const NotPendingTransition: TransitionStatus = "NotPending";
// @beginner: 声明 HostTransitionContext：保存当前步骤需要读取或更新的数据。
export const HostTransitionContext: ReactContext<TransitionStatus> =
  createContext(NotPendingTransition);
// @beginner: 声明 isPrimaryRenderer：保存当前步骤需要读取或更新的数据。
export const isPrimaryRenderer = true;

// @beginner: 进入 getRootHostContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getRootHostContext(rootContainerInstance: Container): HostContext {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  const node =
    rootContainerInstance.nodeType === Node.DOCUMENT_FRAGMENT_NODE
      ? rootContainerInstance.firstChild
      : rootContainerInstance;
  // @beginner: 声明 namespaceURI：保存当前步骤需要读取或更新的数据。
  const namespaceURI =
    node instanceof Element
      ? (node.namespaceURI ?? "http://www.w3.org/1999/xhtml")
      : "http://www.w3.org/1999/xhtml";

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    namespaceURI,
    ancestorInfo: null,
  };
}

// @beginner: 进入 getChildHostContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getChildHostContext(parentHostContext: HostContext, type: string): HostContext {
  // React DOM 会根据 svg/math/html 命名空间切换 HostContext。这里保留相同入口，
  // 覆盖客户端主流程最常见的 html/svg 分支，后续 DOM 校验文件可继续补齐。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (type === "svg") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return {
      namespaceURI: "http://www.w3.org/2000/svg",
      ancestorInfo: type,
    };
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (type === "foreignObject") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return {
      namespaceURI: "http://www.w3.org/1999/xhtml",
      ancestorInfo: type,
    };
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return parentHostContext;
}

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  createInstance,
  createTextInstance,
  setInitialProperties,
  updateProperties,
};

// @beginner: 进入 requestPostPaintCallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function requestPostPaintCallback(callback: (endTime: number) => void): void {
  setTimeout(() => {
    callback(typeof performance !== "undefined" ? performance.now() : Date.now());
  }, 0);
}

// @beginner: 进入 bindToConsole：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function bindToConsole(
  method: "log" | "info" | "warn" | "error",
  args: unknown[],
  badgeName?: string,
): () => void {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => {
    // @beginner: 声明 prefix：保存当前步骤需要读取或更新的数据。
    const prefix = badgeName === undefined ? [] : [`[${badgeName}]`];
    (console[method] as (...values: unknown[]) => void)(...prefix, ...args);
  };
}
