export interface Reference {}

export type TaintEntry = {
  message: string;
  count: number;
};

export const TaintRegistryObjects: WeakMap<Reference, string> = new WeakMap();
export const TaintRegistryValues: Map<string | bigint, TaintEntry> = new Map();
export const TaintRegistryByteLengths: Set<number> = new Set();

export type RequestCleanupQueue = Array<string | bigint>;
export const TaintRegistryPendingRequests: Set<RequestCleanupQueue> = new Set();
