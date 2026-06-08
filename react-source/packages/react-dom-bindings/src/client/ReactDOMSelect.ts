/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props } from "shared";

// @beginner: 进入 updateOptions：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function updateOptions(node: HTMLSelectElement, multiple: boolean, propValue: unknown): void {
  // @beginner: 声明 options：保存当前步骤需要读取或更新的数据。
  const options = node.options;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (multiple) {
    // @beginner: 声明 selectedValues：保存当前步骤需要读取或更新的数据。
    const selectedValues = new Set(Array.isArray(propValue) ? propValue.map(String) : []);
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = 0; i < options.length; i += 1) {
      options[i].selected = selectedValues.has(options[i].value);
    }
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: 声明 selectedValue：保存当前步骤需要读取或更新的数据。
    const selectedValue = propValue == null ? "" : String(propValue);
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (let i = 0; i < options.length; i += 1) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (options[i].value === selectedValue) {
        options[i].selected = true;
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (options.length > 0) {
      options[0].selected = true;
    }
  }
}

// @beginner: 进入 initSelect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initSelect(
  element: HTMLSelectElement,
  value: unknown,
  defaultValue: unknown,
  multiple: boolean,
): void {
  element.multiple = Boolean(multiple);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value != null) {
    updateOptions(element, Boolean(multiple), value);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (defaultValue != null) {
    updateOptions(element, Boolean(multiple), defaultValue);
  }
}

// @beginner: 进入 updateSelect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateSelect(
  element: HTMLSelectElement,
  value: unknown,
  defaultValue: unknown,
  multiple: boolean,
  wasMultiple: boolean,
): void {
  element.multiple = Boolean(multiple);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value != null) {
    updateOptions(element, Boolean(multiple), value);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (wasMultiple !== Boolean(multiple)) {
    updateOptions(element, Boolean(multiple), defaultValue ?? (multiple ? [] : ""));
  }
}

// @beginner: 进入 restoreControlledSelectState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreControlledSelectState(element: HTMLSelectElement, props: Props): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props.value != null) {
    updateOptions(element, Boolean(props.multiple), props.value);
  }
}
