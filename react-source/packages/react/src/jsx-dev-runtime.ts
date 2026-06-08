/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { Fragment } from "./jsx/ReactJSX.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { jsx } from "./jsx/ReactJSX.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ElementType, Key, Props, ReactElement } from "shared";

// @beginner: 进入 jsxDEV：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
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
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return jsx(type, props, key);
}
