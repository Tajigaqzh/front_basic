/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getOffsets, setOffsets, type SelectionInformation } from "./ReactDOMSelection.js";

// @beginner: 进入 hasSelectionCapabilities：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hasSelectionCapabilities(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    elem instanceof HTMLInputElement ||
    elem instanceof HTMLTextAreaElement ||
    (elem instanceof HTMLElement && elem.contentEditable === "true")
  );
}

// @beginner: 进入 getSelectionInformation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSelectionInformation(containerInfo: Document | Element): SelectionInformation {
  // @beginner: 声明 doc：保存当前步骤需要读取或更新的数据。
  const doc = "nodeType" in containerInfo && containerInfo.nodeType === 9 ? (containerInfo as Document) : containerInfo.ownerDocument;
  // @beginner: 声明 focusedElem：保存当前步骤需要读取或更新的数据。
  const focusedElem = doc?.activeElement ?? null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    focusedElem,
    selectionRange: hasSelectionCapabilities(focusedElem) ? getOffsets(focusedElem) : null,
  };
}

// @beginner: 进入 restoreSelection：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreSelection(priorSelectionInformation: SelectionInformation): void {
  // @beginner: 声明 变量：保存当前步骤需要读取或更新的数据。
  const { focusedElem, selectionRange } = priorSelectionInformation;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (selectionRange !== null && hasSelectionCapabilities(focusedElem)) {
    setOffsets(focusedElem, selectionRange);
  }
}
