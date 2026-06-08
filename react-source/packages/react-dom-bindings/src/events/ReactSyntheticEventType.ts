/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ReactSyntheticEvent：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactSyntheticEvent {
  nativeEvent: Event;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  type: string;
  data?: string | null;
  relatedTarget?: EventTarget | null;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
