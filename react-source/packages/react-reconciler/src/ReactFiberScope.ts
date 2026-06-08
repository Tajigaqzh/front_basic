/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { ContextProvider, HostComponent, ScopeComponent } from "./ReactWorkTags.js";

// @beginner: 定义 ReactScopeQuery：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ReactScopeQuery = (type: unknown, props: Record<string, unknown>, instance: unknown) => boolean;

// @beginner: 定义 ReactScopeInstance：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ReactScopeInstance {
  DO_NOT_USE_queryAllNodes(fn: ReactScopeQuery): unknown[] | null;
  DO_NOT_USE_queryFirstNode(fn: ReactScopeQuery): unknown | null;
  containsNode(node: unknown): boolean;
  getChildContextValues<T>(context: ReactContext<T>): T[];
  _fiber?: Fiber | null;
}

// @beginner: 进入 getScopeFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getScopeFiber(scope: ReactScopeInstance): Fiber | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return scope._fiber ?? null;
}

// @beginner: 进入 collectScopedNodes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function collectScopedNodes(node: Fiber | null, fn: ReactScopeQuery, firstOnly: boolean, out: unknown[]): unknown | null {
  // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
  let current: Fiber | null = node;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (current !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (current.tag === HostComponent) {
      // @beginner: 声明 instance：保存当前步骤需要读取或更新的数据。
      const instance = current.stateNode;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (instance !== null && fn(current.type, current.memoizedProps ?? current.pendingProps ?? {}, instance)) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (firstOnly) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return instance;
        }
        out.push(instance);
      }
    }
    // @beginner: 声明 childResult：保存当前步骤需要读取或更新的数据。
    const childResult = collectScopedNodes(current.child, fn, firstOnly, out);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (firstOnly && childResult !== null) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return childResult;
    }
    current = current.sibling;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 collectContextValues：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function collectContextValues<T>(node: Fiber | null, context: ReactContext<T>, out: T[]): void {
  // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
  let current: Fiber | null = node;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (current !== null) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (current.tag === ContextProvider) {
      // @beginner: 声明 typedProvider：保存当前步骤需要读取或更新的数据。
      const typedProvider = current.type as { _context?: ReactContext<T> } | ReactContext<T> | null;
      // @beginner: 声明 providerContext：保存当前步骤需要读取或更新的数据。
      const providerContext =
        typedProvider !== null && "_context" in typedProvider ? typedProvider._context : typedProvider;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (providerContext === context) {
        out.push((current.memoizedProps ?? current.pendingProps).value as T);
      }
    }
    collectContextValues(current.child, context, out);
    current = current.sibling;
  }
}

// @beginner: 进入 createScopeInstance：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createScopeInstance(): ReactScopeInstance {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    DO_NOT_USE_queryAllNodes(fn) {
      // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
      const fiber = getScopeFiber(this);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (fiber === null) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return null;
      }
      // @beginner: 声明 nodes：保存当前步骤需要读取或更新的数据。
      const nodes: unknown[] = [];
      collectScopedNodes(fiber.child, fn, false, nodes);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return nodes.length === 0 ? null : nodes;
    },
    DO_NOT_USE_queryFirstNode(fn) {
      // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
      const fiber = getScopeFiber(this);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return fiber === null ? null : collectScopedNodes(fiber.child, fn, true, []);
    },
    containsNode(node) {
      // @beginner: 声明 fiber：保存当前步骤需要读取或更新的数据。
      const fiber = getScopeFiber(this);
      // @beginner: 声明 current：保存当前步骤需要读取或更新的数据。
      let current = fiber?.child ?? null;
      // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
      const stack: Fiber[] = [];
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (current !== null) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (current.stateNode === node) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return true;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (current.child !== null) {
          stack.push(current.child);
        }
        current = current.sibling ?? stack.pop() ?? null;
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    },
    getChildContextValues(context) {
      // @beginner: 声明 values：保存当前步骤需要读取或更新的数据。
      const values: unknown[] = [];
      collectContextValues(getScopeFiber(this)?.child ?? null, context as ReactContext<unknown>, values);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return values as never[];
    },
  };
}

// @beginner: 进入 attachScopeFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function attachScopeFiber(scope: ReactScopeInstance, fiber: Fiber): void {
  scope._fiber = fiber;
  fiber.tag = ScopeComponent;
  fiber.stateNode = scope;
}
