/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AsyncCacheDispatcher, Dispatcher } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  TaintRegistryByteLengths,
  TaintRegistryObjects,
  TaintRegistryPendingRequests,
  TaintRegistryValues,
  type Reference,
  type RequestCleanupQueue,
  type TaintEntry,
} from "./ReactTaintRegistry.js";

// @beginner: 定义 SharedStateServer：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface SharedStateServer {
  H: Dispatcher | null;
  A: AsyncCacheDispatcher | null;
  TaintRegistryObjects: WeakMap<Reference, string>;
  TaintRegistryValues: Map<string | bigint, TaintEntry>;
  TaintRegistryByteLengths: Set<number>;
  TaintRegistryPendingRequests: Set<RequestCleanupQueue>;
  getCurrentStack: null | (() => string);
  recentlyCreatedOwnerStacks: number;
}

// @beginner: 声明 ReactSharedInternalsServer：保存当前步骤需要读取或更新的数据。
const ReactSharedInternalsServer: SharedStateServer = {
  H: null,
  A: null,
  TaintRegistryObjects,
  TaintRegistryValues,
  TaintRegistryByteLengths,
  TaintRegistryPendingRequests,
  getCurrentStack: null,
  recentlyCreatedOwnerStacks: 0,
};

export default ReactSharedInternalsServer;
