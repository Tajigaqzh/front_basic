import type { ReactNode } from "shared";

export function forEach(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => void,
): void {
  mapChildren(children, (child, index) => {
    fn(child, index);
    return null;
  });
}

export function map<T>(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => T,
): T[] | null {
  return mapChildren(children, fn);
}

export function count(children: ReactNode): number {
  let result = 0;
  forEach(children, () => {
    result += 1;
  });
  return result;
}

export function toArray(children: ReactNode): ReactNode[] {
  const result: ReactNode[] = [];
  forEach(children, (child) => result.push(child));
  return result;
}

export function only(children: ReactNode): ReactNode {
  const array = toArray(children);
  if (array.length !== 1) {
    throw new Error("React.Children.only expected to receive a single React element child.");
  }
  return array[0];
}

function mapChildren<T>(
  children: ReactNode,
  fn: (child: ReactNode, index: number) => T,
): T[] | null {
  if (children === null || children === undefined) {
    return null;
  }

  const result: T[] = [];
  let index = 0;
  traverse(children, (child) => {
    result.push(fn(child, index++));
  });
  return result;
}

function traverse(children: ReactNode, visit: (child: ReactNode) => void): void {
  if (Array.isArray(children)) {
    for (const child of children) {
      traverse(child, visit);
    }
    return;
  }

  if (children === null || children === undefined || typeof children === "boolean") {
    return;
  }

  visit(children);
}
