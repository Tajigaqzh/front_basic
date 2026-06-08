/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared";

// @beginner: 进入 typeOf：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function typeOf(object: unknown): symbol | undefined {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (
    typeof object === "object" &&
    object !== null &&
    (object as { $$typeof?: symbol }).$$typeof === REACT_ELEMENT_TYPE
  ) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return (object as { type?: symbol }).type;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return undefined;
}

// @beginner: 进入 isElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isElement(object: unknown): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    typeof object === "object" &&
    object !== null &&
    (object as { $$typeof?: symbol }).$$typeof === REACT_ELEMENT_TYPE
  );
}

// @beginner: 进入 isFragment：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isFragment(object: unknown): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeOf(object) === REACT_FRAGMENT_TYPE;
}

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { REACT_ELEMENT_TYPE as Element, REACT_FRAGMENT_TYPE as Fragment };
