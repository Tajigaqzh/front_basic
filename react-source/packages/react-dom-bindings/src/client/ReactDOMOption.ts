/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 validateOptionProps：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function validateOptionProps(element: HTMLOptionElement, props: { value?: unknown; children?: unknown }): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props.value != null) {
    element.value = String(props.value);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props.children != null) {
    element.text = Array.isArray(props.children) ? props.children.join("") : String(props.children);
  }
}
