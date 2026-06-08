/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { NoLane, NoLanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createHostRootFiber } from "./ReactFiber.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";

// @beginner: 进入 createFiberRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createFiberRoot(containerInfo: Element | DocumentFragment): FiberRoot {
  // @beginner: 声明 uninitializedFiber：保存当前步骤需要读取或更新的数据。
  const uninitializedFiber = createHostRootFiber();
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root: FiberRoot = {
    containerInfo,
    current: uninitializedFiber,
    finishedWork: null,
    pendingLanes: NoLanes,
    pingedLanes: NoLanes,
    pingCache: new WeakMap(),
    callbackNode: null,
    callbackPriority: NoLane,
    next: null,
  };

  uninitializedFiber.stateNode = root;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return root;
}
