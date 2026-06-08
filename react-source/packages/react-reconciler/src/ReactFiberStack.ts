import type { Fiber } from "./ReactInternalTypes.js";

export interface StackCursor<T> {
  current: T;
}

const valueStack: unknown[] = [];
const fiberStack: Array<Fiber | null> = [];
let index = -1;

export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return { current: defaultValue };
}

export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index += 1;
  // 先保存旧值，再把 cursor 切到新值；pop 时按相反顺序恢复。
  // 这就是官方 React 在 HostContext、ContextProvider 等地方复用的通用栈模型。
  valueStack[index] = cursor.current;
  fiberStack[index] = fiber;
  cursor.current = value;
}

export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    return;
  }

  if (fiberStack[index] !== fiber) {
    throw new Error("Unexpected Fiber popped from ReactFiberStack.");
  }

  cursor.current = valueStack[index] as T;
  valueStack[index] = null;
  fiberStack[index] = null;
  index -= 1;
}
