/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 RefObject：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface RefObject<T> {
  current: T | null;
}

// @beginner: 进入 createRef：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createRef<T = unknown>(): RefObject<T> {
  // 官方实现返回一个只有 current 字段的密封对象；这里保留核心形态。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { current: null };
}
