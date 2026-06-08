/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 setTextContent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setTextContent(node: Node, text: string): void {
  node.textContent = text;
}
