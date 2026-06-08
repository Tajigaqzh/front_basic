/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Key, ReactNode, ReactPortal } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_PORTAL_TYPE, checkKeyStringCoercion } from "shared";

// @beginner: 进入 createPortal：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createPortal(
  children: ReactNode,
  containerInfo: unknown,
  implementation: unknown,
  key: Key = null,
): ReactPortal {
  // @beginner: 声明 resolvedKey：保存当前步骤需要读取或更新的数据。
  const resolvedKey = key === null ? null : String(key);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (key !== null) {
    checkKeyStringCoercion(key);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: resolvedKey,
    children,
    containerInfo,
    implementation,
  };
}
