/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 Reference：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Reference {}

// @beginner: 定义 TaintEntry：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TaintEntry = {
  message: string;
  count: number;
};

// @beginner: 声明 TaintRegistryObjects：保存当前步骤需要读取或更新的数据。
export const TaintRegistryObjects: WeakMap<Reference, string> = new WeakMap();
// @beginner: 声明 TaintRegistryValues：保存当前步骤需要读取或更新的数据。
export const TaintRegistryValues: Map<string | bigint, TaintEntry> = new Map();
// @beginner: 声明 TaintRegistryByteLengths：保存当前步骤需要读取或更新的数据。
export const TaintRegistryByteLengths: Set<number> = new Set();

// @beginner: 定义 RequestCleanupQueue：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type RequestCleanupQueue = Array<string | bigint>;
// @beginner: 声明 TaintRegistryPendingRequests：保存当前步骤需要读取或更新的数据。
export const TaintRegistryPendingRequests: Set<RequestCleanupQueue> = new Set();
