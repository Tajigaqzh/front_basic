import { IdlePriority, unstable_scheduleCallback as scheduleCallback } from "scheduler";

export interface Entry<T> {
  value: T;
  onDelete: (() => unknown) | null;
  previous: Entry<T> | null;
  next: Entry<T> | null;
}

export interface LRU<T> {
  add(value: T, onDelete: () => unknown): Entry<T>;
  update(entry: Entry<T>, newValue: T): void;
  access(entry: Entry<T>): T;
  setLimit(newLimit: number): void;
}

export function createLRU<T>(limit: number): LRU<T> {
  let LIMIT = limit;

  // 官方实现使用环形双向链表：
  // first 指向最近访问的节点，first.previous 指向最久未使用的节点。
  let first: Entry<T> | null = null;
  let size = 0;
  let cleanUpIsScheduled = false;

  function scheduleCleanUp(): void {
    if (cleanUpIsScheduled === false && size > LIMIT) {
      cleanUpIsScheduled = true;
      scheduleCallback(IdlePriority, cleanUp);
    }
  }

  function cleanUp(): void {
    cleanUpIsScheduled = false;
    deleteLeastRecentlyUsedEntries(LIMIT);
  }

  function deleteLeastRecentlyUsedEntries(targetSize: number): void {
    if (first === null) {
      return;
    }

    let last: Entry<T> | null = first.previous;
    while (size > targetSize && last !== null) {
      const onDelete = last.onDelete;
      const previous = last.previous;

      last.onDelete = null;
      last.previous = null;
      last.next = null;

      if (last === first) {
        first = null;
        last = null;
      } else {
        const resolvedFirst = first as Entry<T>;
        resolvedFirst.previous = previous;
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

  function add(value: T, onDelete: () => unknown): Entry<T> {
    const entry: Entry<T> = {
      value,
      onDelete,
      next: null,
      previous: null,
    };

    if (first === null) {
      entry.previous = entry;
      entry.next = entry;
      first = entry;
    } else {
      const last = first.previous as Entry<T>;
      last.next = entry;
      entry.previous = last;

      first.previous = entry;
      entry.next = first;

      first = entry;
    }

    size += 1;
    scheduleCleanUp();
    return entry;
  }

  function update(entry: Entry<T>, newValue: T): void {
    entry.value = newValue;
  }

  function access(entry: Entry<T>): T {
    const next = entry.next;
    if (next !== null && first !== null && first !== entry) {
      const previous = entry.previous as Entry<T>;

      previous.next = next;
      next.previous = previous;

      const last = first.previous as Entry<T>;
      last.next = entry;
      entry.previous = last;

      first.previous = entry;
      entry.next = first;

      first = entry;
    }

    scheduleCleanUp();
    return entry.value;
  }

  function setLimit(newLimit: number): void {
    LIMIT = newLimit;
    scheduleCleanUp();
  }

  return {
    add,
    update,
    access,
    setLimit,
  };
}
