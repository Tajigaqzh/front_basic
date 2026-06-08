/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { IdlePriority, unstable_scheduleCallback as scheduleCallback } from "scheduler";

// @beginner: 定义 Entry：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Entry<T> {
  value: T;
  onDelete: (() => unknown) | null;
  previous: Entry<T> | null;
  next: Entry<T> | null;
}

// @beginner: 定义 LRU：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface LRU<T> {
  add(value: T, onDelete: () => unknown): Entry<T>;
  update(entry: Entry<T>, newValue: T): void;
  access(entry: Entry<T>): T;
  setLimit(newLimit: number): void;
}

// @beginner: 进入 createLRU：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createLRU<T>(limit: number): LRU<T> {
  // @beginner: 声明 LIMIT：保存当前步骤需要读取或更新的数据。
  let LIMIT = limit;

  // 官方实现使用环形双向链表：
  // first 指向最近访问的节点，first.previous 指向最久未使用的节点。
  // @beginner: 声明 first：保存当前步骤需要读取或更新的数据。
  let first: Entry<T> | null = null;
  // @beginner: 声明 size：保存当前步骤需要读取或更新的数据。
  let size = 0;
  // @beginner: 声明 cleanUpIsScheduled：保存当前步骤需要读取或更新的数据。
  let cleanUpIsScheduled = false;

  // @beginner: 进入 scheduleCleanUp：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function scheduleCleanUp(): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (cleanUpIsScheduled === false && size > LIMIT) {
      cleanUpIsScheduled = true;
      scheduleCallback(IdlePriority, cleanUp);
    }
  }

  // @beginner: 进入 cleanUp：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function cleanUp(): void {
    cleanUpIsScheduled = false;
    deleteLeastRecentlyUsedEntries(LIMIT);
  }

  // @beginner: 进入 deleteLeastRecentlyUsedEntries：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function deleteLeastRecentlyUsedEntries(targetSize: number): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (first === null) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }

    // @beginner: 声明 last：保存当前步骤需要读取或更新的数据。
    let last: Entry<T> | null = first.previous;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (size > targetSize && last !== null) {
      // @beginner: 声明 onDelete：保存当前步骤需要读取或更新的数据。
      const onDelete = last.onDelete;
      // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
      const previous = last.previous;

      last.onDelete = null;
      last.previous = null;
      last.next = null;

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (last === first) {
        first = null;
        last = null;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 声明 resolvedFirst：保存当前步骤需要读取或更新的数据。
        const resolvedFirst = first as Entry<T>;
        resolvedFirst.previous = previous;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (previous !== null) {
          previous.next = resolvedFirst;
        }
        last = previous;
      }

      size -= 1;

      // 官方源码在移出链表后再调用删除回调；即使回调抛错，链表状态也已有效。
      onDelete?.();
    }
  }

  // @beginner: 进入 add：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function add(value: T, onDelete: () => unknown): Entry<T> {
    // @beginner: 声明 entry：保存当前步骤需要读取或更新的数据。
    const entry: Entry<T> = {
      value,
      onDelete,
      next: null,
      previous: null,
    };

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (first === null) {
      entry.previous = entry;
      entry.next = entry;
      first = entry;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 声明 last：保存当前步骤需要读取或更新的数据。
      const last = first.previous as Entry<T>;
      last.next = entry;
      entry.previous = last;

      first.previous = entry;
      entry.next = first;

      first = entry;
    }

    size += 1;
    scheduleCleanUp();
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return entry;
  }

  // @beginner: 进入 update：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function update(entry: Entry<T>, newValue: T): void {
    entry.value = newValue;
  }

  // @beginner: 进入 access：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function access(entry: Entry<T>): T {
    // @beginner: 声明 next：保存当前步骤需要读取或更新的数据。
    const next = entry.next;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (next !== null && first !== null && first !== entry) {
      // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
      const previous = entry.previous as Entry<T>;

      previous.next = next;
      next.previous = previous;

      // @beginner: 声明 last：保存当前步骤需要读取或更新的数据。
      const last = first.previous as Entry<T>;
      last.next = entry;
      entry.previous = last;

      first.previous = entry;
      entry.next = first;

      first = entry;
    }

    scheduleCleanUp();
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return entry.value;
  }

  // @beginner: 进入 setLimit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function setLimit(newLimit: number): void {
    LIMIT = newLimit;
    scheduleCleanUp();
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    add,
    update,
    access,
    setLimit,
  };
}
