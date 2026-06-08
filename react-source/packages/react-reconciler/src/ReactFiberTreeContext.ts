/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { clz32 } from "./clz32.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { Forked, NoFlags } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getIsHydrating } from "./ReactFiberHydrationContext.js";

// @beginner: 定义 TreeContext：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface TreeContext {
  id: number;
  overflow: string;
}

// @beginner: 声明 forkStack：保存当前步骤需要读取或更新的数据。
const forkStack: unknown[] = [];
// @beginner: 声明 forkStackIndex：保存当前步骤需要读取或更新的数据。
let forkStackIndex = 0;
// @beginner: 声明 treeForkProvider：保存当前步骤需要读取或更新的数据。
let treeForkProvider: Fiber | null = null;
// @beginner: 声明 treeForkCount：保存当前步骤需要读取或更新的数据。
let treeForkCount = 0;

// @beginner: 声明 idStack：保存当前步骤需要读取或更新的数据。
const idStack: unknown[] = [];
// @beginner: 声明 idStackIndex：保存当前步骤需要读取或更新的数据。
let idStackIndex = 0;
// @beginner: 声明 treeContextProvider：保存当前步骤需要读取或更新的数据。
let treeContextProvider: Fiber | null = null;
// @beginner: 声明 treeContextId：保存当前步骤需要读取或更新的数据。
let treeContextId = 1;
// @beginner: 声明 treeContextOverflow：保存当前步骤需要读取或更新的数据。
let treeContextOverflow = "";

// @beginner: 进入 isForkedChild：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isForkedChild(workInProgress: Fiber): boolean {
  warnIfNotHydrating();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (workInProgress.flags & Forked) !== NoFlags;
}

// @beginner: 进入 getForksAtLevel：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getForksAtLevel(_workInProgress: Fiber): number {
  warnIfNotHydrating();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return treeForkCount;
}

// @beginner: 进入 getTreeId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getTreeId(): string {
  // @beginner: 声明 overflow：保存当前步骤需要读取或更新的数据。
  const overflow = treeContextOverflow;
  // @beginner: 声明 idWithLeadingBit：保存当前步骤需要读取或更新的数据。
  const idWithLeadingBit = treeContextId;
  // @beginner: 声明 id：保存当前步骤需要读取或更新的数据。
  const id = idWithLeadingBit & ~getLeadingBit(idWithLeadingBit);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return id.toString(32) + overflow;
}

// @beginner: 进入 pushTreeFork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushTreeFork(workInProgress: Fiber, totalChildren: number): void {
  warnIfNotHydrating();

  forkStack[forkStackIndex++] = treeForkCount;
  forkStack[forkStackIndex++] = treeForkProvider;

  treeForkProvider = workInProgress;
  treeForkCount = totalChildren;
}

// @beginner: 进入 pushTreeId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushTreeId(workInProgress: Fiber, totalChildren: number, index: number): void {
  warnIfNotHydrating();

  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;

  treeContextProvider = workInProgress;

  // @beginner: 声明 baseIdWithLeadingBit：保存当前步骤需要读取或更新的数据。
  const baseIdWithLeadingBit = treeContextId;
  // @beginner: 声明 baseOverflow：保存当前步骤需要读取或更新的数据。
  const baseOverflow = treeContextOverflow;
  // @beginner: 声明 baseLength：保存当前步骤需要读取或更新的数据。
  const baseLength = getBitLength(baseIdWithLeadingBit) - 1;
  // @beginner: 声明 baseId：保存当前步骤需要读取或更新的数据。
  const baseId = baseIdWithLeadingBit & ~(1 << baseLength);

  // 官方 useId/tree id 算法使用 1-based slot，避免第 0 个子节点和父节点 id 不可区分。
  // @beginner: 声明 slot：保存当前步骤需要读取或更新的数据。
  const slot = index + 1;
  // @beginner: 声明 length：保存当前步骤需要读取或更新的数据。
  const length = getBitLength(totalChildren) + baseLength;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (length > 30) {
    // 超过 bitwise 安全范围时，把低位按 base32 字符串挪到 overflow。
    // @beginner: 声明 numberOfOverflowBits：保存当前步骤需要读取或更新的数据。
    const numberOfOverflowBits = baseLength - (baseLength % 5);
    // @beginner: 声明 newOverflowBits：保存当前步骤需要读取或更新的数据。
    const newOverflowBits = (1 << numberOfOverflowBits) - 1;
    // @beginner: 声明 newOverflow：保存当前步骤需要读取或更新的数据。
    const newOverflow = (baseId & newOverflowBits).toString(32);
    // @beginner: 声明 restOfBaseId：保存当前步骤需要读取或更新的数据。
    const restOfBaseId = baseId >> numberOfOverflowBits;
    // @beginner: 声明 restOfBaseLength：保存当前步骤需要读取或更新的数据。
    const restOfBaseLength = baseLength - numberOfOverflowBits;
    // @beginner: 声明 restOfLength：保存当前步骤需要读取或更新的数据。
    const restOfLength = getBitLength(totalChildren) + restOfBaseLength;
    // @beginner: 声明 restOfNewBits：保存当前步骤需要读取或更新的数据。
    const restOfNewBits = slot << restOfBaseLength;
    // @beginner: 声明 id：保存当前步骤需要读取或更新的数据。
    const id = restOfNewBits | restOfBaseId;

    treeContextId = (1 << restOfLength) | id;
    treeContextOverflow = newOverflow + baseOverflow;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: 声明 newBits：保存当前步骤需要读取或更新的数据。
    const newBits = slot << baseLength;
    // @beginner: 声明 id：保存当前步骤需要读取或更新的数据。
    const id = newBits | baseId;

    treeContextId = (1 << length) | id;
    treeContextOverflow = baseOverflow;
  }
}

// @beginner: 进入 pushMaterializedTreeId：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushMaterializedTreeId(workInProgress: Fiber): void {
  warnIfNotHydrating();

  // materialize useId 时，即使只有一个子节点也要分配新层级，避免父子 id 相同。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (workInProgress.return !== null) {
    pushTreeFork(workInProgress, 1);
    pushTreeId(workInProgress, 1, 0);
  }
}

// @beginner: 进入 getBitLength：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getBitLength(number: number): number {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return 32 - clz32(number);
}

// @beginner: 进入 getLeadingBit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getLeadingBit(id: number): number {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return 1 << (getBitLength(id) - 1);
}

// @beginner: 进入 popTreeContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popTreeContext(workInProgress: Fiber): void {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (workInProgress === treeForkProvider) {
    treeForkProvider = forkStack[--forkStackIndex] as Fiber | null;
    forkStack[forkStackIndex] = null;
    treeForkCount = forkStack[--forkStackIndex] as number;
    forkStack[forkStackIndex] = null;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (workInProgress === treeContextProvider) {
    treeContextProvider = idStack[--idStackIndex] as Fiber | null;
    idStack[idStackIndex] = null;
    treeContextOverflow = idStack[--idStackIndex] as string;
    idStack[idStackIndex] = null;
    treeContextId = idStack[--idStackIndex] as number;
    idStack[idStackIndex] = null;
  }
}

// @beginner: 进入 getSuspendedTreeContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getSuspendedTreeContext(): TreeContext | null {
  warnIfNotHydrating();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return treeContextProvider === null
    ? null
    : {
        id: treeContextId,
        overflow: treeContextOverflow,
      };
}

// @beginner: 进入 restoreSuspendedTreeContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function restoreSuspendedTreeContext(workInProgress: Fiber, suspendedContext: TreeContext): void {
  warnIfNotHydrating();

  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;

  treeContextId = suspendedContext.id;
  treeContextOverflow = suspendedContext.overflow;
  treeContextProvider = workInProgress;
}

// @beginner: 进入 warnIfNotHydrating：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function warnIfNotHydrating(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!getIsHydrating()) {
    // 本复刻保留官方开发期保护语义，但不抛错；非 hydration 流程里读取 tree id 仍可用于测试算法。
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
}
