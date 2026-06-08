/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { batchedUpdates } from "./ReactDOMUpdateBatching.js";

// @beginner: 进入 createEventListenerWrapper：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createEventListenerWrapper(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  listener: (event: Event) => void,
): (event: Event) => void {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return function dispatchDiscreteEvent(nativeEvent: Event) {
    batchedUpdates(() => {
      listener(nativeEvent);
    });
  };
}

// @beginner: 进入 listenToNativeEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function listenToNativeEvent(
  domEventName: DOMEventName,
  target: EventTarget,
  listener: (event: Event) => void,
): () => void {
  // @beginner: 声明 wrapper：保存当前步骤需要读取或更新的数据。
  const wrapper = createEventListenerWrapper(target, domEventName, listener);
  target.addEventListener(domEventName, wrapper);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return () => target.removeEventListener(domEventName, wrapper);
}
