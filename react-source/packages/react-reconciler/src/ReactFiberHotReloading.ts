/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactElement, ReactNode } from "shared";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_FORWARD_REF_TYPE, REACT_LAZY_TYPE, REACT_MEMO_TYPE } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ClassComponent,
  ForwardRef,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
} from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { SyncLane } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { scheduleUpdateOnFiber, updateContainer } from "./ReactFiberWorkLoop.js";

// @beginner: 定义 Family：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Family {
  current: unknown;
}

// @beginner: 定义 RefreshUpdate：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface RefreshUpdate {
  staleFamilies: Set<Family>;
  updatedFamilies: Set<Family>;
}

// @beginner: 定义 RefreshHandler：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type RefreshHandler = (type: unknown) => Family | undefined;
// @beginner: 定义 SetRefreshHandler：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type SetRefreshHandler = (handler: RefreshHandler | null) => void;
// @beginner: 定义 ScheduleRefresh：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ScheduleRefresh = (root: FiberRoot, update: RefreshUpdate) => void;
// @beginner: 定义 ScheduleRoot：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ScheduleRoot = (root: FiberRoot, element: ReactNode) => void;

// @beginner: 声明 resolveFamily：保存当前步骤需要读取或更新的数据。
let resolveFamily: RefreshHandler | null = null;
// @beginner: 声明 failedBoundaries：保存当前步骤需要读取或更新的数据。
let failedBoundaries: WeakSet<Fiber> | null = null;

// @beginner: 定义 setRefreshHandler：保存 React Refresh 注入的新旧组件 family 查询函数。
export const setRefreshHandler: SetRefreshHandler = (handler) => {
  resolveFamily = handler;
};

// @beginner: 进入 resolveFunctionForHotReloading：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resolveFunctionForHotReloading<T>(type: T): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (resolveFamily === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return type;
  }
  // @beginner: 声明 family：保存当前步骤需要读取或更新的数据。
  const family = resolveFamily(type);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (family === undefined ? type : family.current) as T;
}

// @beginner: 进入 resolveClassForHotReloading：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resolveClassForHotReloading<T>(type: T): T {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return resolveFunctionForHotReloading(type);
}

// @beginner: 进入 resolveForwardRefForHotReloading：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resolveForwardRefForHotReloading<T extends { render?: unknown; displayName?: string }>(type: T): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (resolveFamily === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return type;
  }
  // @beginner: 声明 family：保存当前步骤需要读取或更新的数据。
  const family = resolveFamily(type);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (family !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return family.current as T;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type?.render === "function") {
    // @beginner: 声明 currentRender：保存当前步骤需要读取或更新的数据。
    const currentRender = resolveFunctionForHotReloading(type.render);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (currentRender !== type.render) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return {
        $$typeof: REACT_FORWARD_REF_TYPE,
        render: currentRender,
        displayName: type.displayName,
      } as unknown as T;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return type;
}

// @beginner: 进入 isCompatibleFamilyForHotReloading：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isCompatibleFamilyForHotReloading(fiber: Fiber, element: ReactElement): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (resolveFamily === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 prevType：保存当前步骤需要读取或更新的数据。
  const prevType = fiber.elementType;
  // @beginner: 声明 nextType：保存当前步骤需要读取或更新的数据。
  const nextType = element.type;
  // @beginner: 声明 nextSymbol：保存当前步骤需要读取或更新的数据。
  const nextSymbol = typeof nextType === "object" && nextType !== null ? (nextType as { $$typeof?: symbol }).$$typeof : null;

  // @beginner: 声明 shouldCompare：保存当前步骤需要读取或更新的数据。
  let shouldCompare = false;
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (fiber.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ClassComponent:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case FunctionComponent:
      shouldCompare = typeof nextType === "function" || nextSymbol === REACT_LAZY_TYPE;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ForwardRef:
      shouldCompare = nextSymbol === REACT_FORWARD_REF_TYPE || nextSymbol === REACT_LAZY_TYPE;
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case MemoComponent:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SimpleMemoComponent:
      shouldCompare = nextSymbol === REACT_MEMO_TYPE || nextSymbol === REACT_LAZY_TYPE;
      break;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!shouldCompare) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 声明 prevFamily：保存当前步骤需要读取或更新的数据。
  const prevFamily = resolveFamily(prevType);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return prevFamily !== undefined && prevFamily === resolveFamily(nextType);
}

// @beginner: 进入 markFailedErrorBoundaryForHotReloading：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function markFailedErrorBoundaryForHotReloading(fiber: Fiber): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (failedBoundaries === null) {
    failedBoundaries = new WeakSet();
  }
  failedBoundaries.add(fiber);
}

// @beginner: 进入 scheduleFamilies：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function scheduleFamilies(fiber: Fiber, update: RefreshUpdate): void {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  let node: Fiber | null = fiber;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (node !== null) {
    // @beginner: 声明 candidate：保存当前步骤需要读取或更新的数据。
    const candidate =
      node.tag === ForwardRef && typeof (node.type as { render?: unknown } | null)?.render === "function"
        ? (node.type as { render: unknown }).render
        : node.type;
    // @beginner: 声明 family：保存当前步骤需要读取或更新的数据。
    const family = resolveFamily?.(candidate);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (
      family !== undefined &&
      (update.staleFamilies.has(family) || update.updatedFamilies.has(family))
    ) {
      node._debugNeedsRemount = update.staleFamilies.has(family) || node.tag === ClassComponent;
      scheduleUpdateOnFiber(node, SyncLane);
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (node.child !== null && node._debugNeedsRemount !== true) {
      scheduleFamilies(node.child, update);
    }
    node = node.sibling;
  }
}

// @beginner: 定义 scheduleRefresh：React Refresh 触发时按 family 更新当前 root。
export const scheduleRefresh: ScheduleRefresh = (root, update) => {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (resolveFamily === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  scheduleFamilies(root.current, update);
};

// @beginner: 定义 scheduleRoot：React Refresh 需要整棵 root 重渲染时调用。
export const scheduleRoot: ScheduleRoot = (root, element) => {
  updateContainer(element as ReactElement | null | undefined, root);
};
