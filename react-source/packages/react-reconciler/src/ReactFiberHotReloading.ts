import type { ReactElement, ReactNode } from "shared";
import { REACT_FORWARD_REF_TYPE, REACT_LAZY_TYPE, REACT_MEMO_TYPE } from "shared";
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import {
  ClassComponent,
  ForwardRef,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
} from "./ReactWorkTags.js";
import { SyncLane } from "./ReactFiberLane.js";
import { scheduleUpdateOnFiber, updateContainer } from "./ReactFiberWorkLoop.js";

export interface Family {
  current: unknown;
}

export interface RefreshUpdate {
  staleFamilies: Set<Family>;
  updatedFamilies: Set<Family>;
}

type RefreshHandler = (type: unknown) => Family | undefined;
export type SetRefreshHandler = (handler: RefreshHandler | null) => void;
export type ScheduleRefresh = (root: FiberRoot, update: RefreshUpdate) => void;
export type ScheduleRoot = (root: FiberRoot, element: ReactNode) => void;

let resolveFamily: RefreshHandler | null = null;
let failedBoundaries: WeakSet<Fiber> | null = null;

export const setRefreshHandler: SetRefreshHandler = (handler) => {
  resolveFamily = handler;
};

export function resolveFunctionForHotReloading<T>(type: T): T {
  if (resolveFamily === null) {
    return type;
  }
  const family = resolveFamily(type);
  return (family === undefined ? type : family.current) as T;
}

export function resolveClassForHotReloading<T>(type: T): T {
  return resolveFunctionForHotReloading(type);
}

export function resolveForwardRefForHotReloading<T extends { render?: unknown; displayName?: string }>(type: T): T {
  if (resolveFamily === null) {
    return type;
  }
  const family = resolveFamily(type);
  if (family !== undefined) {
    return family.current as T;
  }
  if (typeof type?.render === "function") {
    const currentRender = resolveFunctionForHotReloading(type.render);
    if (currentRender !== type.render) {
      return {
        $$typeof: REACT_FORWARD_REF_TYPE,
        render: currentRender,
        displayName: type.displayName,
      } as unknown as T;
    }
  }
  return type;
}

export function isCompatibleFamilyForHotReloading(fiber: Fiber, element: ReactElement): boolean {
  if (resolveFamily === null) {
    return false;
  }

  const prevType = fiber.elementType;
  const nextType = element.type;
  const nextSymbol = typeof nextType === "object" && nextType !== null ? (nextType as { $$typeof?: symbol }).$$typeof : null;

  let shouldCompare = false;
  switch (fiber.tag) {
    case ClassComponent:
    case FunctionComponent:
      shouldCompare = typeof nextType === "function" || nextSymbol === REACT_LAZY_TYPE;
      break;
    case ForwardRef:
      shouldCompare = nextSymbol === REACT_FORWARD_REF_TYPE || nextSymbol === REACT_LAZY_TYPE;
      break;
    case MemoComponent:
    case SimpleMemoComponent:
      shouldCompare = nextSymbol === REACT_MEMO_TYPE || nextSymbol === REACT_LAZY_TYPE;
      break;
  }

  if (!shouldCompare) {
    return false;
  }
  const prevFamily = resolveFamily(prevType);
  return prevFamily !== undefined && prevFamily === resolveFamily(nextType);
}

export function markFailedErrorBoundaryForHotReloading(fiber: Fiber): void {
  if (failedBoundaries === null) {
    failedBoundaries = new WeakSet();
  }
  failedBoundaries.add(fiber);
}

function scheduleFamilies(fiber: Fiber, update: RefreshUpdate): void {
  let node: Fiber | null = fiber;
  while (node !== null) {
    const candidate =
      node.tag === ForwardRef && typeof (node.type as { render?: unknown } | null)?.render === "function"
        ? (node.type as { render: unknown }).render
        : node.type;
    const family = resolveFamily?.(candidate);
    if (
      family !== undefined &&
      (update.staleFamilies.has(family) || update.updatedFamilies.has(family))
    ) {
      node._debugNeedsRemount = update.staleFamilies.has(family) || node.tag === ClassComponent;
      scheduleUpdateOnFiber(node, SyncLane);
    }
    if (node.child !== null && node._debugNeedsRemount !== true) {
      scheduleFamilies(node.child, update);
    }
    node = node.sibling;
  }
}

export const scheduleRefresh: ScheduleRefresh = (root, update) => {
  if (resolveFamily === null) {
    return;
  }
  scheduleFamilies(root.current, update);
};

export const scheduleRoot: ScheduleRoot = (root, element) => {
  updateContainer(element as ReactElement | null | undefined, root);
};
