/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ReactDOMEventHandle：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactDOMEventHandle = (target: EventTarget, callback: (event: Event) => void) => () => void;
// @beginner: 定义 ReactDOMEventHandleListener：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactDOMEventHandleListener = (event: Event) => void;
// @beginner: 定义 EventHandleOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface EventHandleOptions {
  capture?: boolean;
  passive?: boolean;
}
