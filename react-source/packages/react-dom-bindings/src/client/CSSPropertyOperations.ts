/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { hyphenateStyleName } from "../shared/hyphenateStyleName.js";

// @beginner: 进入 setValueForStyles：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setValueForStyles(node: HTMLElement, styles: unknown, prevStyles: unknown = null): void {
  // @beginner: 声明 style：保存当前步骤需要读取或更新的数据。
  const style = node.style;
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = isStyleObject(prevStyles) ? prevStyles : {};
  // @beginner: 声明 next：保存当前步骤需要读取或更新的数据。
  const next = isStyleObject(styles) ? styles : {};

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const styleName of Object.keys(previous)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!(styleName in next)) {
      style.setProperty(hyphenateStyleName(styleName), "");
    }
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const styleName of Object.keys(next)) {
    style.setProperty(hyphenateStyleName(styleName), String(next[styleName]));
  }
}

// @beginner: 进入 isStyleObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isStyleObject(value: unknown): value is Record<string, unknown> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof value === "object" && value !== null;
}
