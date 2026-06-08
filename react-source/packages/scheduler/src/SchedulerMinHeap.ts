export interface HeapNode {
  id: number;
  sortIndex: number;
}

export function push<T extends HeapNode>(heap: T[], node: T): void {
  heap.push(node);
  siftUp(heap, node, heap.length - 1);
}

export function peek<T extends HeapNode>(heap: T[]): T | null {
  return heap.length === 0 ? null : heap[0];
}

export function pop<T extends HeapNode>(heap: T[]): T | null {
  if (heap.length === 0) {
    return null;
  }

  const first = heap[0];
  const last = heap.pop()!;

  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);
  }

  return first;
}

function siftUp<T extends HeapNode>(heap: T[], node: T, index: number): void {
  while (index > 0) {
    const parentIndex = (index - 1) >>> 1;
    const parent = heap[parentIndex];

    if (compare(parent, node) > 0) {
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    } else {
      return;
    }
  }
}

function siftDown<T extends HeapNode>(heap: T[], node: T, index: number): void {
  const length = heap.length;

  while (index < length) {
    const leftIndex = (index + 1) * 2 - 1;
    const rightIndex = leftIndex + 1;
    let smallest = index;

    if (leftIndex < length && compare(heap[leftIndex], heap[smallest]) < 0) {
      smallest = leftIndex;
    }

    if (rightIndex < length && compare(heap[rightIndex], heap[smallest]) < 0) {
      smallest = rightIndex;
    }

    if (smallest !== index) {
      heap[index] = heap[smallest];
      heap[smallest] = node;
      index = smallest;
    } else {
      return;
    }
  }
}

function compare(a: HeapNode, b: HeapNode): number {
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
