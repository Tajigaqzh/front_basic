/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 CrossOriginString：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type CrossOriginString = "anonymous" | "use-credentials" | "";

// @beginner: 进入 getCrossOriginString：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getCrossOriginString(input: unknown): CrossOriginString | undefined {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (input === "use-credentials") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "use-credentials";
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (input === "" || input === "anonymous" || input === true) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "anonymous";
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return undefined;
}

// @beginner: 进入 getCrossOriginStringAs：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getCrossOriginStringAs(as: unknown, input?: unknown): CrossOriginString | undefined {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (as === "font") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "";
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getCrossOriginString(input ?? as);
}
