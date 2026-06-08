/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 AnyNativeEvent：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type AnyNativeEvent = Event & {
  button?: number;
  keyCode?: number;
  charCode?: number;
  which?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  relatedTarget?: EventTarget | null;
  pointerId?: number;
  data?: string;
  detail?: unknown;
};
