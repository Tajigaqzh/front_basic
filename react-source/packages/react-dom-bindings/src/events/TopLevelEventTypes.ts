/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "./DOMEventNames.js";

// @beginner: 定义 TopLevelType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TopLevelType = DOMEventName;
