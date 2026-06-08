/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactContext } from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lanes } from "./ReactFiberLane.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { DidCapture, NoFlags, ShouldCapture } from "./ReactFiberFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  ClassComponent,
  ContextProvider,
  HostComponent,
  HostPortal,
  HostRoot,
  SuspenseComponent,
  SuspenseListComponent,
} from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popHostContainer, popHostContext } from "./ReactFiberHostContext.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { popProvider } from "./ReactFiberNewContext.js";

// @beginner: 进入 captureIfNeeded：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function captureIfNeeded(workInProgress: Fiber): Fiber | null {
  // @beginner: 声明 flags：保存当前步骤需要读取或更新的数据。
  const flags = workInProgress.flags;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ((flags & ShouldCapture) !== NoFlags && (flags & DidCapture) === NoFlags) {
    workInProgress.flags = (flags & ~ShouldCapture) | DidCapture;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return workInProgress;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

// @beginner: 进入 unwindWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unwindWork(
  _current: Fiber | null,
  workInProgress: Fiber,
  _renderLanes: Lanes,
): Fiber | null {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (workInProgress.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ClassComponent:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SuspenseComponent:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case SuspenseListComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return captureIfNeeded(workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
      popHostContainer(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return captureIfNeeded(workInProgress);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      popHostContext(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      popHostContainer(workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextProvider:
      popProvider((workInProgress.type as { _context: ReactContext<unknown> })._context, workInProgress);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return null;
  }
}

// @beginner: 进入 unwindInterruptedWork：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function unwindInterruptedWork(
  _current: Fiber | null,
  interruptedWork: Fiber,
  _renderLanes: Lanes,
): void {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (interruptedWork.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostPortal:
      popHostContainer(interruptedWork);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      popHostContext(interruptedWork);
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ContextProvider:
      popProvider((interruptedWork.type as { _context: ReactContext<unknown> })._context, interruptedWork);
      break;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      break;
  }
}
