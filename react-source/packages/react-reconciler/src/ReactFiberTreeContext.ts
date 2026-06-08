import type { Fiber } from "./ReactInternalTypes.js";
import { clz32 } from "./clz32.js";
import { Forked, NoFlags } from "./ReactFiberFlags.js";
import { getIsHydrating } from "./ReactFiberHydrationContext.js";

export interface TreeContext {
  id: number;
  overflow: string;
}

const forkStack: unknown[] = [];
let forkStackIndex = 0;
let treeForkProvider: Fiber | null = null;
let treeForkCount = 0;

const idStack: unknown[] = [];
let idStackIndex = 0;
let treeContextProvider: Fiber | null = null;
let treeContextId = 1;
let treeContextOverflow = "";

export function isForkedChild(workInProgress: Fiber): boolean {
  warnIfNotHydrating();
  return (workInProgress.flags & Forked) !== NoFlags;
}

export function getForksAtLevel(_workInProgress: Fiber): number {
  warnIfNotHydrating();
  return treeForkCount;
}

export function getTreeId(): string {
  const overflow = treeContextOverflow;
  const idWithLeadingBit = treeContextId;
  const id = idWithLeadingBit & ~getLeadingBit(idWithLeadingBit);
  return id.toString(32) + overflow;
}

export function pushTreeFork(workInProgress: Fiber, totalChildren: number): void {
  warnIfNotHydrating();

  forkStack[forkStackIndex++] = treeForkCount;
  forkStack[forkStackIndex++] = treeForkProvider;

  treeForkProvider = workInProgress;
  treeForkCount = totalChildren;
}

export function pushTreeId(workInProgress: Fiber, totalChildren: number, index: number): void {
  warnIfNotHydrating();

  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;

  treeContextProvider = workInProgress;

  const baseIdWithLeadingBit = treeContextId;
  const baseOverflow = treeContextOverflow;
  const baseLength = getBitLength(baseIdWithLeadingBit) - 1;
  const baseId = baseIdWithLeadingBit & ~(1 << baseLength);

  // 官方 useId/tree id 算法使用 1-based slot，避免第 0 个子节点和父节点 id 不可区分。
  const slot = index + 1;
  const length = getBitLength(totalChildren) + baseLength;

  if (length > 30) {
    // 超过 bitwise 安全范围时，把低位按 base32 字符串挪到 overflow。
    const numberOfOverflowBits = baseLength - (baseLength % 5);
    const newOverflowBits = (1 << numberOfOverflowBits) - 1;
    const newOverflow = (baseId & newOverflowBits).toString(32);
    const restOfBaseId = baseId >> numberOfOverflowBits;
    const restOfBaseLength = baseLength - numberOfOverflowBits;
    const restOfLength = getBitLength(totalChildren) + restOfBaseLength;
    const restOfNewBits = slot << restOfBaseLength;
    const id = restOfNewBits | restOfBaseId;

    treeContextId = (1 << restOfLength) | id;
    treeContextOverflow = newOverflow + baseOverflow;
  } else {
    const newBits = slot << baseLength;
    const id = newBits | baseId;

    treeContextId = (1 << length) | id;
    treeContextOverflow = baseOverflow;
  }
}

export function pushMaterializedTreeId(workInProgress: Fiber): void {
  warnIfNotHydrating();

  // materialize useId 时，即使只有一个子节点也要分配新层级，避免父子 id 相同。
  if (workInProgress.return !== null) {
    pushTreeFork(workInProgress, 1);
    pushTreeId(workInProgress, 1, 0);
  }
}

function getBitLength(number: number): number {
  return 32 - clz32(number);
}

function getLeadingBit(id: number): number {
  return 1 << (getBitLength(id) - 1);
}

export function popTreeContext(workInProgress: Fiber): void {
  while (workInProgress === treeForkProvider) {
    treeForkProvider = forkStack[--forkStackIndex] as Fiber | null;
    forkStack[forkStackIndex] = null;
    treeForkCount = forkStack[--forkStackIndex] as number;
    forkStack[forkStackIndex] = null;
  }

  while (workInProgress === treeContextProvider) {
    treeContextProvider = idStack[--idStackIndex] as Fiber | null;
    idStack[idStackIndex] = null;
    treeContextOverflow = idStack[--idStackIndex] as string;
    idStack[idStackIndex] = null;
    treeContextId = idStack[--idStackIndex] as number;
    idStack[idStackIndex] = null;
  }
}

export function getSuspendedTreeContext(): TreeContext | null {
  warnIfNotHydrating();
  return treeContextProvider === null
    ? null
    : {
        id: treeContextId,
        overflow: treeContextOverflow,
      };
}

export function restoreSuspendedTreeContext(workInProgress: Fiber, suspendedContext: TreeContext): void {
  warnIfNotHydrating();

  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;

  treeContextId = suspendedContext.id;
  treeContextOverflow = suspendedContext.overflow;
  treeContextProvider = workInProgress;
}

function warnIfNotHydrating(): void {
  if (!getIsHydrating()) {
    // 本复刻保留官方开发期保护语义，但不抛错；非 hydration 流程里读取 tree id 仍可用于测试算法。
    return;
  }
}
