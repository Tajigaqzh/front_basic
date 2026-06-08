/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Effect, Fiber, FunctionComponentUpdateQueue } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HasEffect, Insertion, Layout, Passive } from "./ReactHookEffectTags.js";

// @beginner: 进入 commitHookLayoutEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitHookLayoutEffects(finishedWork: Fiber): void {
  commitHookEffectListMount(HasEffect | Insertion, finishedWork);
  commitHookEffectListMount(HasEffect | Layout, finishedWork);
}

// @beginner: 进入 commitHookPassiveMountEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitHookPassiveMountEffects(finishedWork: Fiber): void {
  commitHookEffectListMount(HasEffect | Passive, finishedWork);
}

// @beginner: 进入 commitHookLayoutUnmountEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitHookLayoutUnmountEffects(finishedWork: Fiber): void {
  commitHookEffectListUnmount(HasEffect | Layout, finishedWork);
  commitHookEffectListUnmount(HasEffect | Insertion, finishedWork);
}

// @beginner: 进入 commitHookPassiveUnmountEffects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function commitHookPassiveUnmountEffects(finishedWork: Fiber): void {
  commitHookEffectListUnmount(HasEffect | Passive, finishedWork);
}

// @beginner: 进入 commitHookEffectListMount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitHookEffectListMount(flags: number, finishedWork: Fiber): void {
  // @beginner: 声明 updateQueue：保存当前步骤需要读取或更新的数据。
  const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | null;
  // @beginner: 声明 lastEffect：保存当前步骤需要读取或更新的数据。
  const lastEffect = updateQueue?.lastEffect;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lastEffect === null || lastEffect === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 effect：保存当前步骤需要读取或更新的数据。
  let effect = lastEffect.next as Effect;
  // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
  do {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ((effect.tag & flags) === flags) {
      // @beginner: 声明 destroy：保存当前步骤需要读取或更新的数据。
      const destroy = effect.create();
      effect.destroy = typeof destroy === "function" ? destroy : undefined;
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

// @beginner: 进入 commitHookEffectListUnmount：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function commitHookEffectListUnmount(flags: number, finishedWork: Fiber): void {
  // @beginner: 声明 updateQueue：保存当前步骤需要读取或更新的数据。
  const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | null;
  // @beginner: 声明 lastEffect：保存当前步骤需要读取或更新的数据。
  const lastEffect = updateQueue?.lastEffect;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (lastEffect === null || lastEffect === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 effect：保存当前步骤需要读取或更新的数据。
  let effect = lastEffect.next as Effect;
  // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
  do {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if ((effect.tag & flags) === flags && effect.destroy !== undefined) {
      effect.destroy();
      effect.destroy = undefined;
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}
