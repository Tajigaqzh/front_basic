/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { setValueForStyles } from "./CSSPropertyOperations.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { setValueForKnownAttribute } from "./DOMPropertyOperations.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { restoreControlledInputState } from "./ReactDOMInput.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { restoreControlledSelectState } from "./ReactDOMSelect.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { restoreControlledTextareaState } from "./ReactDOMTextarea.js";

// @beginner: 进入 createInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createInstance(type: string): Element {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return document.createElement(type);
}

// @beginner: 进入 createTextInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createTextInstance(text: string): Text {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return document.createTextNode(text);
}

// @beginner: 进入 hideInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hideInstance(instance: Element): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance instanceof HTMLElement || instance instanceof SVGElement) {
    instance.style.display = "none";
  }
}

// @beginner: 进入 unhideInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unhideInstance(instance: Element, props: Props): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance instanceof HTMLElement || instance instanceof SVGElement) {
    // @beginner: 声明 display：保存当前步骤需要读取或更新的数据。
    const display = props.style && typeof props.style === "object"
      ? (props.style as { display?: unknown }).display
      : undefined;
    instance.style.display = display === undefined || display === null ? "" : String(display);
  }
}

// @beginner: 进入 hideTextInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hideTextInstance(instance: Text): void {
  (instance as Text & { __frontHiddenText?: string }).__frontHiddenText = instance.nodeValue ?? "";
  instance.nodeValue = "";
}

// @beginner: 进入 unhideTextInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unhideTextInstance(instance: Text, text: string): void {
  delete (instance as Text & { __frontHiddenText?: string }).__frontHiddenText;
  instance.nodeValue = text;
}

// @beginner: 进入 hideDehydratedBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function hideDehydratedBoundary(instance: Comment): void {
  hideOrUnhideDehydratedBoundary(instance, true);
}

// @beginner: 进入 unhideDehydratedBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unhideDehydratedBoundary(instance: Comment): void {
  hideOrUnhideDehydratedBoundary(instance, false);
}

// @beginner: 进入 hideOrUnhideDehydratedBoundary：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hideOrUnhideDehydratedBoundary(instance: Comment, isHidden: boolean): void {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Node | null = instance;
  // @beginner: 声明 depth：保存当前步骤需要读取或更新的数据。
  let depth = 0;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 声明 nextNode：保存当前步骤需要读取或更新的数据。
    const nextNode: Node | null = node.nextSibling;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isHidden) {
        (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay = node.style.display;
        node.style.display = "none";
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        node.style.display = (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay ?? "";
        delete (node as HTMLElement & { __frontStashedDisplay?: string }).__frontStashedDisplay;
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (node.nodeType === Node.TEXT_NODE) {
      // @beginner: 声明 textNode：保存当前步骤需要读取或更新的数据。
      const textNode = node as Text & { __frontStashedText?: string };
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isHidden) {
        textNode.__frontStashedText = textNode.nodeValue ?? "";
        textNode.nodeValue = "";
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        textNode.nodeValue = textNode.__frontStashedText ?? textNode.nodeValue;
        delete textNode.__frontStashedText;
      }
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nextNode?.nodeType === Node.COMMENT_NODE) {
      // @beginner: 声明 data：保存当前步骤需要读取或更新的数据。
      const data = (nextNode as Comment).data;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (data === "/$") {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (depth === 0) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return;
        }
        depth -= 1;
      // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
      } else if (data === "$" || data === "$?" || data === "$~" || data === "$!") {
        depth += 1;
      }
    }
    node = nextNode;
  }
}

// @beginner: 进入 setInitialProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setInitialProperties(domElement: Element, type: string, props: Props): void {
  updateProperties(domElement, type, {}, props);
}

// @beginner: 进入 updateProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateProperties(
  domElement: Element,
  _tag: string,
  lastProps: Props,
  nextProps: Props,
): void {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const propKey of Object.keys(lastProps)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (propKey !== "children" && !(propKey in nextProps)) {
      setProp(domElement, propKey, lastProps[propKey], undefined);
    }
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const propKey of Object.keys(nextProps)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (propKey === "children") {
      // 当前 reconciler 会为 string/number children 创建 HostText fiber。
      // 如果这里再 set textContent，真实 DOM 初次挂载会同时拥有 textContent
      // 和后续 append 的 Text node，表现为按钮/标题等文本重复。
      continue;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lastProps[propKey] !== nextProps[propKey]) {
      setProp(domElement, propKey, lastProps[propKey], nextProps[propKey]);
    }
  }
}

// @beginner: 进入 setProp：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function setProp(domElement: Element, propKey: string, oldValue: unknown, value: unknown): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isEventName(propKey)) {
    // 事件 props 由根容器的 DOMPluginEventSystem 统一委托处理。
    // 这里不直接绑定到节点，避免绕过插件抽取、捕获/冒泡累计和受控组件恢复队列。
    void domElement;
    void oldValue;
    void value;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (propKey === "style") {
    setValueForStyles(domElement as HTMLElement, value, oldValue);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  setValueForKnownAttribute(domElement, propKey, value);
}

// @beginner: 进入 isEventName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isEventName(propKey: string): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return /^on[A-Z]/.test(propKey);
}

// @beginner: 进入 restoreControlledState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreControlledState(domElement: Element, tag: string, props: Props | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "input":
      restoreControlledInputState(domElement as HTMLInputElement, props);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "textarea":
      restoreControlledTextareaState(domElement as HTMLTextAreaElement, props);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "select":
      restoreControlledSelectState(domElement as HTMLSelectElement, props);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
  }
}
