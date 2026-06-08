/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactSyntheticEvent } from "./ReactSyntheticEventType.js";

// @beginner: 进入 createSyntheticEvent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createSyntheticEvent(nativeEvent: Event): ReactSyntheticEvent {
  // @beginner: 声明 defaultPrevented：保存当前步骤需要读取或更新的数据。
  let defaultPrevented = nativeEvent.defaultPrevented;
  // @beginner: 声明 propagationStopped：保存当前步骤需要读取或更新的数据。
  let propagationStopped = false;

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    nativeEvent,
    target: nativeEvent.target,
    currentTarget: null,
    type: nativeEvent.type,
    isDefaultPrevented: () => defaultPrevented,
    isPropagationStopped: () => propagationStopped,
    preventDefault() {
      defaultPrevented = true;
      nativeEvent.preventDefault();
    },
    stopPropagation() {
      propagationStopped = true;
      nativeEvent.stopPropagation();
    },
  };
}
