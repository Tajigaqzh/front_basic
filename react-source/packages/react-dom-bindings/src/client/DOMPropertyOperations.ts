/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 setValueForAttribute：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setValueForAttribute(node: Element, name: string, value: unknown): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value === null || value === undefined || value === false) {
    node.removeAttribute(name);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  node.setAttribute(name, String(value));
}

// @beginner: 进入 setValueForKnownAttribute：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setValueForKnownAttribute(node: Element, name: string, value: unknown): void {
  setValueForAttribute(node, name === "className" ? "class" : name, value);
}
