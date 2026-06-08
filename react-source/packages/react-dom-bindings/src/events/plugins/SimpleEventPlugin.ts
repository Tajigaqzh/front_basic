/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "../DOMEventNames.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AnyNativeEvent } from "../PluginModuleType.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { EventSystemFlags } from "../EventSystemFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createSyntheticEvent } from "../SyntheticEvent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { IS_CAPTURE_PHASE } from "../EventSystemFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { topLevelEventsToReactNames, registerSimpleEvents } from "../DOMEventProperties.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { accumulateSinglePhaseListeners } from "../DOMPluginEventSystem.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getEventCharCode from "../getEventCharCode.js";

// @beginner: 进入 extractEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget,
): void {
  // @beginner: 声明 reactName：保存当前步骤需要读取或更新的数据。
  const reactName = topLevelEventsToReactNames.get(domEventName);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (reactName === undefined || reactName === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName === "keypress" && getEventCharCode(nativeEvent as KeyboardEvent) === 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName === "click" && nativeEvent.button === 2) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 inCapturePhase：保存当前步骤需要读取或更新的数据。
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  // @beginner: 声明 accumulateTargetOnly：保存当前步骤需要读取或更新的数据。
  const accumulateTargetOnly =
    !inCapturePhase && (domEventName === "scroll" || domEventName === "scrollend");
  // @beginner: 声明 listeners：保存当前步骤需要读取或更新的数据。
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent,
  );

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (listeners.length > 0) {
    // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
    const event = createSyntheticEvent(nativeEvent);
    event.type =
      domEventName === "focusin" ? "focus" : domEventName === "focusout" ? "blur" : domEventName;
    event.target = nativeEventTarget;
    dispatchQueue.push({ event, listeners });
  }
}

// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export { registerSimpleEvents as registerEvents };
