import type { Props } from "shared";
import { setValueForStyles } from "./CSSPropertyOperations.js";
import { setValueForKnownAttribute } from "./DOMPropertyOperations.js";
import { restoreControlledInputState } from "./ReactDOMInput.js";
import { restoreControlledSelectState } from "./ReactDOMSelect.js";
import { restoreControlledTextareaState } from "./ReactDOMTextarea.js";

export function createInstance(type: string): Element {
  return document.createElement(type);
}

export function createTextInstance(text: string): Text {
  return document.createTextNode(text);
}

export function hideInstance(instance: Element): void {
  if (instance instanceof HTMLElement || instance instanceof SVGElement) {
    instance.style.display = "none";
  }
}

export function unhideInstance(instance: Element, props: Props): void {
  if (instance instanceof HTMLElement || instance instanceof SVGElement) {
    const display = props.style && typeof props.style === "object"
      ? (props.style as { display?: unknown }).display
      : undefined;
    instance.style.display = display === undefined || display === null ? "" : String(display);
  }
}

export function hideTextInstance(instance: Text): void {
  (instance as Text & { __frontHiddenText?: string }).__frontHiddenText = instance.nodeValue ?? "";
  instance.nodeValue = "";
}

export function unhideTextInstance(instance: Text, text: string): void {
  delete (instance as Text & { __frontHiddenText?: string }).__frontHiddenText;
  instance.nodeValue = text;
}

export function hideDehydratedBoundary(instance: Comment): void {
  hideOrUnhideDehydratedBoundary(instance, true);
}

export function unhideDehydratedBoundary(instance: Comment): void {
  hideOrUnhideDehydratedBoundary(instance, false);
}

function hideOrUnhideDehydratedBoundary(instance: Comment, isHidden: boolean): void {
  let node: Node | null = instance;
  let depth = 0;

  while (node !== null) {
    const nextNode: Node | null = node.nextSibling;
    if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement) {
      if (isHidden) {
        (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay = node.style.display;
        node.style.display = "none";
      } else {
        node.style.display = (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay ?? "";
        delete (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text & { __frontStashedText?: string };
      if (isHidden) {
        textNode.__frontStashedText = textNode.nodeValue ?? "";
        textNode.nodeValue = "";
      } else {
        textNode.nodeValue = textNode.__frontStashedText ?? textNode.nodeValue;
        delete textNode.__frontStashedText;
      }
    }

    if (nextNode?.nodeType === Node.COMMENT_NODE) {
      const data = (nextNode as Comment).data;
      if (data === "/$") {
        if (depth === 0) {
          return;
        }
        depth -= 1;
      } else if (data === "$" || data === "$?" || data === "$~" || data === "$!") {
        depth += 1;
      }
    }
    node = nextNode;
  }
}

export function setInitialProperties(domElement: Element, type: string, props: Props): void {
  updateProperties(domElement, type, {}, props);
}

export function updateProperties(
  domElement: Element,
  _tag: string,
  lastProps: Props,
  nextProps: Props,
): void {
  for (const propKey of Object.keys(lastProps)) {
    if (propKey !== "children" && !(propKey in nextProps)) {
      setProp(domElement, propKey, lastProps[propKey], undefined);
    }
  }

  for (const propKey of Object.keys(nextProps)) {
    if (propKey === "children") {
      // 当前 reconciler 会为 string/number children 创建 HostText fiber。
      // 如果这里再 set textContent，真实 DOM 初次挂载会同时拥有 textContent
      // 和后续 append 的 Text node，表现为按钮/标题等文本重复。
      continue;
    }

    if (lastProps[propKey] !== nextProps[propKey]) {
      setProp(domElement, propKey, lastProps[propKey], nextProps[propKey]);
    }
  }
}

function setProp(domElement: Element, propKey: string, oldValue: unknown, value: unknown): void {
  if (isEventName(propKey)) {
    // 事件 props 由根容器的 DOMPluginEventSystem 统一委托处理。
    // 这里不直接绑定到节点，避免绕过插件抽取、捕获/冒泡累计和受控组件恢复队列。
    void domElement;
    void oldValue;
    void value;
    return;
  }

  if (propKey === "style") {
    setValueForStyles(domElement as HTMLElement, value, oldValue);
    return;
  }

  setValueForKnownAttribute(domElement, propKey, value);
}

function isEventName(propKey: string): boolean {
  return /^on[A-Z]/.test(propKey);
}

export function restoreControlledState(domElement: Element, tag: string, props: Props | null): void {
  if (props === null) {
    return;
  }
  switch (tag) {
    case "input":
      restoreControlledInputState(domElement as HTMLInputElement, props);
      return;
    case "textarea":
      restoreControlledTextareaState(domElement as HTMLTextAreaElement, props);
      return;
    case "select":
      restoreControlledSelectState(domElement as HTMLSelectElement, props);
      return;
  }
}
