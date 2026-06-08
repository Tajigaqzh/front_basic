/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  REACT_FRAGMENT_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_LAZY_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
} from "./ReactSymbols.js";

export default function getComponentNameFromType(type: unknown): string | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (type === null || type === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return type;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "function") {
    // @beginner: 声明 fn：保存当前步骤需要读取或更新的数据。
    const fn = type as Function & { displayName?: string };
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return fn.displayName ?? fn.name ?? null;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "symbol") {
    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (type) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_FRAGMENT_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "Fragment";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_PROFILER_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "Profiler";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_STRICT_MODE_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "StrictMode";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_SUSPENSE_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "Suspense";
      // @beginner: 默认分支：没有命中前面任何 case 时使用。
      default:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return null;
    }
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "object") {
    // @beginner: 声明 maybeType：保存当前步骤需要读取或更新的数据。
    const maybeType = type as {
      $$typeof?: symbol;
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
      _payload?: unknown;
      _init?: (payload: unknown) => unknown;
    };

    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (maybeType.$$typeof) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_CONTEXT_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return maybeType.displayName ?? "Context";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_FORWARD_REF_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return maybeType.displayName ?? maybeType.render?.displayName ?? maybeType.render?.name ?? "ForwardRef";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_MEMO_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return maybeType.displayName ?? getComponentNameFromType(maybeType.type) ?? "Memo";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_LAZY_TYPE:
        // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
        try {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return getComponentNameFromType(maybeType._init?.(maybeType._payload));
        // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
        } catch {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return null;
        }
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}
