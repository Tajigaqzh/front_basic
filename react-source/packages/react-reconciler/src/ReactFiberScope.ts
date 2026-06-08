import type { ReactContext } from "shared";
import type { Fiber } from "./ReactInternalTypes.js";
import { ContextProvider, HostComponent, ScopeComponent } from "./ReactWorkTags.js";

export type ReactScopeQuery = (type: unknown, props: Record<string, unknown>, instance: unknown) => boolean;

export interface ReactScopeInstance {
  DO_NOT_USE_queryAllNodes(fn: ReactScopeQuery): unknown[] | null;
  DO_NOT_USE_queryFirstNode(fn: ReactScopeQuery): unknown | null;
  containsNode(node: unknown): boolean;
  getChildContextValues<T>(context: ReactContext<T>): T[];
  _fiber?: Fiber | null;
}

function getScopeFiber(scope: ReactScopeInstance): Fiber | null {
  return scope._fiber ?? null;
}

function collectScopedNodes(node: Fiber | null, fn: ReactScopeQuery, firstOnly: boolean, out: unknown[]): unknown | null {
  let current: Fiber | null = node;
  while (current !== null) {
    if (current.tag === HostComponent) {
      const instance = current.stateNode;
      if (instance !== null && fn(current.type, current.memoizedProps ?? current.pendingProps ?? {}, instance)) {
        if (firstOnly) {
          return instance;
        }
        out.push(instance);
      }
    }
    const childResult = collectScopedNodes(current.child, fn, firstOnly, out);
    if (firstOnly && childResult !== null) {
      return childResult;
    }
    current = current.sibling;
  }
  return null;
}

function collectContextValues<T>(node: Fiber | null, context: ReactContext<T>, out: T[]): void {
  let current: Fiber | null = node;
  while (current !== null) {
    if (current.tag === ContextProvider) {
      const typedProvider = current.type as { _context?: ReactContext<T> } | ReactContext<T> | null;
      const providerContext =
        typedProvider !== null && "_context" in typedProvider ? typedProvider._context : typedProvider;
      if (providerContext === context) {
        out.push((current.memoizedProps ?? current.pendingProps).value as T);
      }
    }
    collectContextValues(current.child, context, out);
    current = current.sibling;
  }
}

export function createScopeInstance(): ReactScopeInstance {
  return {
    DO_NOT_USE_queryAllNodes(fn) {
      const fiber = getScopeFiber(this);
      if (fiber === null) {
        return null;
      }
      const nodes: unknown[] = [];
      collectScopedNodes(fiber.child, fn, false, nodes);
      return nodes.length === 0 ? null : nodes;
    },
    DO_NOT_USE_queryFirstNode(fn) {
      const fiber = getScopeFiber(this);
      return fiber === null ? null : collectScopedNodes(fiber.child, fn, true, []);
    },
    containsNode(node) {
      const fiber = getScopeFiber(this);
      let current = fiber?.child ?? null;
      const stack: Fiber[] = [];
      while (current !== null) {
        if (current.stateNode === node) {
          return true;
        }
        if (current.child !== null) {
          stack.push(current.child);
        }
        current = current.sibling ?? stack.pop() ?? null;
      }
      return false;
    },
    getChildContextValues(context) {
      const values: unknown[] = [];
      collectContextValues(getScopeFiber(this)?.child ?? null, context as ReactContext<unknown>, values);
      return values as never[];
    },
  };
}

export function attachScopeFiber(scope: ReactScopeInstance, fiber: Fiber): void {
  scope._fiber = fiber;
  fiber.tag = ScopeComponent;
  fiber.stateNode = scope;
}
