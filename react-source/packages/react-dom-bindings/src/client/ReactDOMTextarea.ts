/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { trackValueOnNode } from "./inputValueTracking.js";

// @beginner: 定义 TextAreaElement：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type TextAreaElement = HTMLTextAreaElement & {
  _wrapperState?: { initialValue: string };
};

// @beginner: 进入 getToStringValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getToStringValue(value: unknown): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value == null ? "" : String(value);
}

// @beginner: 进入 initTextarea：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initTextarea(
  element: TextAreaElement,
  value: unknown,
  defaultValue: unknown,
  children: unknown,
): void {
  // @beginner: 声明 initialValue：保存当前步骤需要读取或更新的数据。
  const initialValue =
    value != null ? getToStringValue(value) : defaultValue != null ? getToStringValue(defaultValue) : getToStringValue(children);
  element.defaultValue = initialValue;
  element.value = initialValue;
  element._wrapperState = { initialValue };
  trackValueOnNode(element);
}

// @beginner: 进入 updateTextarea：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateTextarea(element: TextAreaElement, value: unknown, defaultValue: unknown): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value != null) {
    // @beginner: 声明 nextValue：保存当前步骤需要读取或更新的数据。
    const nextValue = getToStringValue(value);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (element.value !== nextValue) {
      element.value = nextValue;
    }
    element.defaultValue = nextValue;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (defaultValue != null) {
    element.defaultValue = getToStringValue(defaultValue);
  }
}

// @beginner: 进入 restoreControlledTextareaState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreControlledTextareaState(element: TextAreaElement, props: Props): void {
  updateTextarea(element, props.value, props.defaultValue);
}
