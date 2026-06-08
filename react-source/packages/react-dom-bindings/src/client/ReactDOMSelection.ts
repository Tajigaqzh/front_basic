/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 SelectionInformation：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SelectionInformation {
  focusedElem: Element | null;
  selectionRange: { start: number; end: number } | null;
}

// @beginner: 进入 getOffsets：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getOffsets(node: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    start: node.selectionStart ?? 0,
    end: node.selectionEnd ?? 0,
  };
}

// @beginner: 进入 setOffsets：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setOffsets(
  node: HTMLInputElement | HTMLTextAreaElement,
  offsets: { start: number; end: number },
): void {
  node.setSelectionRange(offsets.start, offsets.end);
}
