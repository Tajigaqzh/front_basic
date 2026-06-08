/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 TrackableElement：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type TrackableElement = (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) & {
  _valueTracker?: ValueTracker | null;
};

// @beginner: 定义 ValueTracker：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ValueTracker {
  getValue(): string;
  setValue(value: string): void;
  stopTracking(): void;
}

// @beginner: 进入 getValueFromNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getValueFromNode(node: TrackableElement): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("checked" in node && (node.type === "checkbox" || node.type === "radio")) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return node.checked ? "true" : "false";
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return node.value;
}

// @beginner: 进入 trackValueOnNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackValueOnNode(node: TrackableElement): ValueTracker | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node._valueTracker) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return node._valueTracker;
  }
  // @beginner: 声明 currentValue：保存当前步骤需要读取或更新的数据。
  let currentValue = getValueFromNode(node);
  // @beginner: 声明 tracker：保存当前步骤需要读取或更新的数据。
  const tracker: ValueTracker = {
    getValue() {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return currentValue;
    },
    setValue(value: string) {
      currentValue = value;
    },
    stopTracking() {
      node._valueTracker = null;
    },
  };
  node._valueTracker = tracker;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return tracker;
}

// @beginner: 进入 track：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function track(node: TrackableElement): void {
  trackValueOnNode(node);
}

// @beginner: 进入 updateValueIfChanged：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updateValueIfChanged(node: TrackableElement): boolean {
  // @beginner: 声明 tracker：保存当前步骤需要读取或更新的数据。
  const tracker = node._valueTracker;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!tracker) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 声明 lastValue：保存当前步骤需要读取或更新的数据。
  const lastValue = tracker.getValue();
  // @beginner: 声明 nextValue：保存当前步骤需要读取或更新的数据。
  const nextValue = getValueFromNode(node);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nextValue !== lastValue) {
    tracker.setValue(nextValue);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 stopTracking：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function stopTracking(node: TrackableElement): void {
  node._valueTracker?.stopTracking();
}
