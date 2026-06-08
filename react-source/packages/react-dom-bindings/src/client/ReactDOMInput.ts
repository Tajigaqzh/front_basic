/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Props } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { trackValueOnNode, updateValueIfChanged } from "./inputValueTracking.js";

// @beginner: 定义 InputElement：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type InputElement = HTMLInputElement & {
  _wrapperState?: {
    initialChecked?: boolean;
    initialValue?: string;
    controlled: boolean;
  };
};

// @beginner: 进入 toStringValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function toStringValue(value: unknown): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return value == null ? "" : String(value);
}

// @beginner: 进入 isControlled：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isControlled(props: Props): boolean {
  // @beginner: 声明 type：保存当前步骤需要读取或更新的数据。
  const type = props.type;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return type === "checkbox" || type === "radio" ? props.checked != null : props.value != null;
}

// @beginner: 进入 initInput：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initInput(
  element: InputElement,
  value: unknown,
  defaultValue: unknown,
  checked: unknown,
  defaultChecked: unknown,
  type: unknown,
  name: unknown,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (type != null) {
    element.type = String(type);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (name != null) {
    element.name = String(name);
  }
  // @beginner: 声明 initialValue：保存当前步骤需要读取或更新的数据。
  const initialValue = value != null ? toStringValue(value) : toStringValue(defaultValue);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (initialValue !== "") {
    element.value = initialValue;
  }
  element.defaultValue = initialValue;

  // @beginner: 声明 initialChecked：保存当前步骤需要读取或更新的数据。
  const initialChecked = checked != null ? Boolean(checked) : Boolean(defaultChecked);
  element.checked = initialChecked;
  element.defaultChecked = initialChecked;
  element._wrapperState = { initialChecked, initialValue, controlled: value != null || checked != null };
  trackValueOnNode(element);
}

// @beginner: 进入 updateInput：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateInput(
  element: InputElement,
  value: unknown,
  defaultValue: unknown,
  checked: unknown,
  defaultChecked: unknown,
  type: unknown,
  name: unknown,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (type != null) {
    element.type = String(type);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (name != null) {
    element.name = String(name);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value != null) {
    // @beginner: 声明 nextValue：保存当前步骤需要读取或更新的数据。
    const nextValue = toStringValue(value);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (element.value !== nextValue) {
      element.value = nextValue;
    }
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (defaultValue != null) {
    element.defaultValue = toStringValue(defaultValue);
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (checked != null) {
    element.checked = Boolean(checked);
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (defaultChecked != null) {
    element.defaultChecked = Boolean(defaultChecked);
  }
  updateValueIfChanged(element);
}

// @beginner: 进入 restoreControlledInputState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreControlledInputState(element: InputElement, props: Props): void {
  updateInput(
    element,
    props.value,
    props.defaultValue,
    props.checked,
    props.defaultChecked,
    props.type,
    props.name,
  );
}
