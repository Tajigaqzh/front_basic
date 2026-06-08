/**
 * @beginner-module: 源码导读
 * 本文件实现 createRoot 返回的 Root 对象，把用户 render 调用接入 FiberRoot。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createFiberRoot, updateContainer } from "react-reconciler";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  isContainerMarkedAsRoot,
  markContainerAsRoot,
  unmarkContainerAsRoot,
} from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { listenToAllSupportedEvents } from "react-dom-bindings/src/events/DOMPluginEventSystem.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactElement } from "shared";

// @beginner: 定义 Root：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface Root {
  // render 把 ReactElement 放进 FiberRoot，随后进入 reconciler 调度。
  render(children: ReactElement | null | undefined): void;
  // unmount 等价于把根 children 置空，commit 阶段会删除已有 DOM。
  unmount(): void;
}

// @beginner: 定义 ReactDOMRoot：把相关状态和方法组织在同一个对象上。
export class ReactDOMRoot implements Root {
  // internalRoot 是真正的 FiberRoot；ReactDOMRoot 只是暴露给用户的外壳对象。
  private readonly internalRoot: FiberRoot;

  constructor(internalRoot: FiberRoot) {
    this.internalRoot = internalRoot;
  }

  render(children: ReactElement | null | undefined): void {
    // 用户调用 root.render(element) 后，不会直接操作 DOM。
    // updateContainer 会把 element 写到 HostRoot.pendingProps.children，
    // 再 scheduleUpdateOnFiber 开始 render/commit 流程。
    updateContainer(children, this.internalRoot);
  }

  unmount(): void {
    // 传 null 表示根节点没有子树，调和阶段会把旧子树标记为删除。
    updateContainer(null, this.internalRoot);
    // 容器标记用于避免同一个 DOM 容器被多个 root 重复接管。
    unmarkContainerAsRoot(this.internalRoot.containerInfo as Node);
  }
}

// @beginner: 进入 createRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createRoot(container: Element | DocumentFragment): Root {
  // createRoot 只能接收 DOM 元素、document 或 fragment。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isValidContainer(container)) {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error("createRoot(...): Target container is not a DOM element.");
  }

  // FiberRoot 是整个 React 应用的运行时根，里面保存 current Fiber 树和 pendingLanes。
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = createFiberRoot(container);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isContainerMarkedAsRoot(container as Node)) {
    // 把 HostRoot Fiber 反向标记到 DOM container 上，事件系统可从 DOM 找回 Fiber。
    markContainerAsRoot(root.current, container as Node);
  }
  // 官方 createRoot 会在根容器安装一次顶层委托监听，后续事件由插件系统从 target 找 Fiber。
  listenToAllSupportedEvents(container);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return new ReactDOMRoot(root);
}

// @beginner: 进入 isValidContainer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isValidContainer(container: Element | DocumentFragment): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    container !== null &&
    (container.nodeType === 1 || container.nodeType === 9 || container.nodeType === 11)
  );
}
