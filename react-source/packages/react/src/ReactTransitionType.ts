/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "shared/ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enableGestureTransition, enableViewTransition } from "shared/ReactFeatureFlags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { startTransition } from "./ReactStartTransition.js";

// @beginner: 定义 TransitionTypes：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TransitionTypes = string[];

// @beginner: 进入 addTransitionType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addTransitionType(type: string): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!enableViewTransition) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 transition：保存当前步骤需要读取或更新的数据。
  const transition = ReactSharedInternals.T;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (transition !== null) {
    // @beginner: 声明 transitionTypes：保存当前步骤需要读取或更新的数据。
    const transitionTypes = transition.types;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (transitionTypes === null || transitionTypes === undefined) {
      transition.types = [type];
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (!transitionTypes.includes(type)) {
      transitionTypes.push(type);
    }
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ReactSharedInternals.asyncTransitions === 0) {
    // @beginner: 声明 apiName：保存当前步骤需要读取或更新的数据。
    const apiName = enableGestureTransition ? "`startTransition()` or `startGestureTransition()`" : "`startTransition()`";
    console.error(`addTransitionType can only be called inside a ${apiName} callback. It must be associated with a specific Transition.`);
  }

  startTransition(() => addTransitionType(type));
}
