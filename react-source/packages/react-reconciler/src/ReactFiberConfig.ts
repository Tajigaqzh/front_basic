import type { ReactContext } from "shared";
import { createContext } from "react";
import {
  createInstance,
  createTextInstance,
  setInitialProperties,
  updateProperties,
} from "react-dom-bindings/src/client/ReactFiberConfigDOM.js";

export type Container = Element | DocumentFragment;
export type Instance = Element;
export type TextInstance = Text;

export interface HostContext {
  namespaceURI: string;
  ancestorInfo: string | null;
}

export type TransitionStatus = "NotPending" | "Pending" | null;

export const NotPendingTransition: TransitionStatus = "NotPending";
export const HostTransitionContext: ReactContext<TransitionStatus> =
  createContext(NotPendingTransition);
export const isPrimaryRenderer = true;

export function getRootHostContext(rootContainerInstance: Container): HostContext {
  const node =
    rootContainerInstance.nodeType === Node.DOCUMENT_FRAGMENT_NODE
      ? rootContainerInstance.firstChild
      : rootContainerInstance;
  const namespaceURI =
    node instanceof Element
      ? (node.namespaceURI ?? "http://www.w3.org/1999/xhtml")
      : "http://www.w3.org/1999/xhtml";

  return {
    namespaceURI,
    ancestorInfo: null,
  };
}

export function getChildHostContext(parentHostContext: HostContext, type: string): HostContext {
  // React DOM 会根据 svg/math/html 命名空间切换 HostContext。这里保留相同入口，
  // 覆盖客户端主流程最常见的 html/svg 分支，后续 DOM 校验文件可继续补齐。
  if (type === "svg") {
    return {
      namespaceURI: "http://www.w3.org/2000/svg",
      ancestorInfo: type,
    };
  }

  if (type === "foreignObject") {
    return {
      namespaceURI: "http://www.w3.org/1999/xhtml",
      ancestorInfo: type,
    };
  }

  return parentHostContext;
}

export {
  createInstance,
  createTextInstance,
  setInitialProperties,
  updateProperties,
};

export function requestPostPaintCallback(callback: (endTime: number) => void): void {
  setTimeout(() => {
    callback(typeof performance !== "undefined" ? performance.now() : Date.now());
  }, 0);
}

export function bindToConsole(
  method: "log" | "info" | "warn" | "error",
  args: unknown[],
  badgeName?: string,
): () => void {
  return () => {
    const prefix = badgeName === undefined ? [] : [`[${badgeName}]`];
    (console[method] as (...values: unknown[]) => void)(...prefix, ...args);
  };
}
