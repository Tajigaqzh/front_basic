/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 setSrcObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setSrcObject(domElement: HTMLMediaElement, value: unknown): void {
  // @beginner: 声明 element：保存当前步骤需要读取或更新的数据。
  const element = domElement as HTMLMediaElement & { srcObject?: MediaProvider | null };
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("srcObject" in element) {
    element.srcObject = value as MediaProvider | null;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (value == null) {
    domElement.removeAttribute("src");
  }
}
