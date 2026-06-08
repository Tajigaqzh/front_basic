/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactDebugInfo } from "./ReactTypes.js";

/**
 * 与官方 `shared/ReactElementType` 对齐的 ReactElement 结构。
 *
 * `ReactTypes.ts` 中也有一份更偏向当前学习版 runtime 的轻量元素类型；
 * 这个文件保留官方字段形态，供 reconciler、错误栈和调试信息模块按源码名引用。
 */
// @beginner: 定义 ReactElement：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactElement<Props = unknown> = {
  $$typeof: typeof REACT_ELEMENT_TYPE;
  type: unknown;
  key: unknown;
  ref: unknown;
  props: Props;

  /**
   * 创建该元素时的 owner。开发态 owner stack 会沿着它反查 JSX 创建位置。
   */
  _owner: unknown;

  /**
   * 官方开发态 key 校验状态：0 未校验，1 已通过，2 强制失败。
   */
  _store?: {
    validated: 0 | 1 | 2;
  };
  _debugInfo?: null | ReactDebugInfo;
  _debugStack?: Error;
  _debugTask?: null | unknown;
};
