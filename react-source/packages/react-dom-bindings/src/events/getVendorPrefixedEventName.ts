/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { canUseDOM } from "shared";

// @beginner: 进入 makePrefixMap：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function makePrefixMap(styleProp: string, eventName: string): Record<string, string> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    [styleProp.toLowerCase()]: eventName.toLowerCase(),
    [`Webkit${styleProp}`]: `webkit${eventName}`,
    [`Moz${styleProp}`]: `moz${eventName}`,
  };
}

// @beginner: 声明 vendorPrefixes：保存当前步骤需要读取或更新的数据。
const vendorPrefixes: Record<string, Record<string, string>> = {
  animationend: makePrefixMap("Animation", "AnimationEnd"),
  animationiteration: makePrefixMap("Animation", "AnimationIteration"),
  animationstart: makePrefixMap("Animation", "AnimationStart"),
  transitionrun: makePrefixMap("Transition", "TransitionRun"),
  transitionstart: makePrefixMap("Transition", "TransitionStart"),
  transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
  transitionend: makePrefixMap("Transition", "TransitionEnd"),
};

// @beginner: 声明 prefixedEventNames：保存当前步骤需要读取或更新的数据。
const prefixedEventNames: Record<string, string> = {};
// @beginner: 声明 style：保存当前步骤需要读取或更新的数据。
let style: Record<string, unknown> = {};

// @beginner: 条件分支：根据当前值选择不同处理路径。
if (canUseDOM) {
  style = document.createElement("div").style as unknown as Record<string, unknown>;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!("AnimationEvent" in window)) {
    delete vendorPrefixes.animationend.animation;
    delete vendorPrefixes.animationiteration.animation;
    delete vendorPrefixes.animationstart.animation;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!("TransitionEvent" in window)) {
    delete vendorPrefixes.transitionend.transition;
  }
}

export default function getVendorPrefixedEventName(eventName: string): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prefixedEventNames[eventName] !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return prefixedEventNames[eventName];
  }

  // @beginner: 声明 prefixMap：保存当前步骤需要读取或更新的数据。
  const prefixMap = vendorPrefixes[eventName];
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prefixMap === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return eventName;
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const styleProp of Object.keys(prefixMap)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (styleProp in style) {
      prefixedEventNames[eventName] = prefixMap[styleProp];
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return prefixedEventNames[eventName];
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return eventName;
}
