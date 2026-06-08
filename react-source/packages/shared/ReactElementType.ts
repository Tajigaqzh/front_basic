import type { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
import type { ReactDebugInfo } from "./ReactTypes.js";

/**
 * 与官方 `shared/ReactElementType` 对齐的 ReactElement 结构。
 *
 * `ReactTypes.ts` 中也有一份更偏向当前学习版 runtime 的轻量元素类型；
 * 这个文件保留官方字段形态，供 reconciler、错误栈和调试信息模块按源码名引用。
 */
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
