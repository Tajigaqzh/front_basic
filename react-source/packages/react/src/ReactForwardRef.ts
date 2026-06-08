/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_FORWARD_REF_TYPE, type Props, type ReactNode } from "shared";

// @beginner: 定义 ForwardRefComponent：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ForwardRefComponent<P extends Props = Props> {
  $$typeof: typeof REACT_FORWARD_REF_TYPE;
  render: (props: P, ref: unknown) => ReactNode;
  displayName?: string;
}

// @beginner: 进入 forwardRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function forwardRef<P extends Props = Props>(
  render: (props: P, ref: unknown) => ReactNode,
): ForwardRefComponent<P> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render,
  };
}
