/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
let root: EventTarget | null = null;
// @beginner: 声明 startText：保存当前步骤需要读取或更新的数据。
let startText = "";
// @beginner: 声明 fallbackText：保存当前步骤需要读取或更新的数据。
let fallbackText = "";

// @beginner: 进入 getText：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getText(node: EventTarget | null): string {
  // @beginner: 声明 target：保存当前步骤需要读取或更新的数据。
  const target = node as { value?: unknown; textContent?: string | null } | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (target === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "";
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof target.value === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return target.value;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return target.textContent ?? "";
}

// @beginner: 进入 initialize：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function initialize(nativeEventTarget: EventTarget | null): boolean {
  root = nativeEventTarget;
  startText = getText(root);
  fallbackText = "";
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 reset：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reset(): void {
  root = null;
  startText = "";
  fallbackText = "";
}

// @beginner: 进入 getData：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getData(): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fallbackText !== "") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fallbackText;
  }
  // @beginner: 声明 endText：保存当前步骤需要读取或更新的数据。
  const endText = getText(root);
  // @beginner: 声明 start：保存当前步骤需要读取或更新的数据。
  let start = 0;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (start < startText.length && startText[start] === endText[start]) {
    start += 1;
  }
  // @beginner: 声明 end：保存当前步骤需要读取或更新的数据。
  let end = 0;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (
    end < startText.length - start &&
    end < endText.length - start &&
    startText[startText.length - 1 - end] === endText[endText.length - 1 - end]
  ) {
    end += 1;
  }
  fallbackText = end === 0 ? endText.slice(start) : endText.slice(start, -end);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fallbackText;
}
