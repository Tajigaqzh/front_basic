export { Fragment } from "./jsx/ReactJSX.js";
import { jsx } from "./jsx/ReactJSX.js";
import type { ElementType, Key, Props, ReactElement } from "shared";

export function jsxDEV<P extends Props>(
  type: ElementType,
  props: P & { key?: Key },
  key?: Key,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): ReactElement<P> {
  // Vite/React automatic runtime 在开发态会导入 jsxDEV。
  // 当前复刻版先复用 jsx 创建元素，同时保留和官方同名的参数形状。
  return jsx(type, props, key);
}
