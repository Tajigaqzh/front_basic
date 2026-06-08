/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 HeapNode：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface HeapNode {
  id: number;
  sortIndex: number;
}

// @beginner: 进入 push：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function push<T extends HeapNode>(heap: T[], node: T): void {
  heap.push(node);
  siftUp(heap, node, heap.length - 1);
}

// @beginner: 进入 peek：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function peek<T extends HeapNode>(heap: T[]): T | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return heap.length === 0 ? null : heap[0];
}

// @beginner: 进入 pop：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pop<T extends HeapNode>(heap: T[]): T | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (heap.length === 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }

  // @beginner: 声明 first：保存当前步骤需要读取或更新的数据。
  const first = heap[0];
  // @beginner: 声明 last：保存当前步骤需要读取或更新的数据。
  const last = heap.pop()!;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return first;
}

// @beginner: 进入 siftUp：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function siftUp<T extends HeapNode>(heap: T[], node: T, index: number): void {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (index > 0) {
    // @beginner: 声明 parentIndex：保存当前步骤需要读取或更新的数据。
    const parentIndex = (index - 1) >>> 1;
    // @beginner: 声明 parent：保存当前步骤需要读取或更新的数据。
    const parent = heap[parentIndex];

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (compare(parent, node) > 0) {
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
  }
}

// @beginner: 进入 siftDown：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function siftDown<T extends HeapNode>(heap: T[], node: T, index: number): void {
  // @beginner: 声明 length：保存当前步骤需要读取或更新的数据。
  const length = heap.length;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (index < length) {
    // @beginner: 声明 leftIndex：保存当前步骤需要读取或更新的数据。
    const leftIndex = (index + 1) * 2 - 1;
    // @beginner: 声明 rightIndex：保存当前步骤需要读取或更新的数据。
    const rightIndex = leftIndex + 1;
    // @beginner: 声明 smallest：保存当前步骤需要读取或更新的数据。
    let smallest = index;

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (leftIndex < length && compare(heap[leftIndex], heap[smallest]) < 0) {
      smallest = leftIndex;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (rightIndex < length && compare(heap[rightIndex], heap[smallest]) < 0) {
      smallest = rightIndex;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (smallest !== index) {
      heap[index] = heap[smallest];
      heap[smallest] = node;
      index = smallest;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
  }
}

// @beginner: 进入 compare：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function compare(a: HeapNode, b: HeapNode): number {
  // @beginner: 声明 diff：保存当前步骤需要读取或更新的数据。
  const diff = a.sortIndex - b.sortIndex;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return diff !== 0 ? diff : a.id - b.id;
}
