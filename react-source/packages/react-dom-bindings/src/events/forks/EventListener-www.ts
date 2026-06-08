/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  addEventBubbleListener,
  addEventCaptureListener,
  addEventCaptureListenerWithPassiveFlag,
  addEventBubbleListenerWithPassiveFlag,
  removeEventListener,
} from "../EventListener.js";
