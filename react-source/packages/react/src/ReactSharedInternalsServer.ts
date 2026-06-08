import type { AsyncCacheDispatcher, Dispatcher } from "shared";
import {
  TaintRegistryByteLengths,
  TaintRegistryObjects,
  TaintRegistryPendingRequests,
  TaintRegistryValues,
  type Reference,
  type RequestCleanupQueue,
  type TaintEntry,
} from "./ReactTaintRegistry.js";

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
