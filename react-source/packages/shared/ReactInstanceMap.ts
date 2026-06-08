/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 internalInstanceKey：保存当前步骤需要读取或更新的数据。
const internalInstanceKey = "__reactFiber$frontSource";

// @beginner: 进入 get：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function get<T>(key: unknown): T | undefined {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (key as Record<string, T | undefined>)[internalInstanceKey];
}

// @beginner: 进入 set：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function set<T>(key: unknown, value: T): void {
  // 官方 React 用 ReactInstanceMap 把 public class instance 映射回内部 Fiber。
  // setState 发生在实例上，调度更新时必须通过这个映射找到对应 fiber。
  (key as Record<string, T>)[internalInstanceKey] = value;
}
