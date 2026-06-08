import type { Effect, Fiber, FunctionComponentUpdateQueue } from "./ReactInternalTypes.js";
import { HasEffect, Insertion, Layout, Passive } from "./ReactHookEffectTags.js";

export function commitHookLayoutEffects(finishedWork: Fiber): void {
  commitHookEffectListMount(HasEffect | Insertion, finishedWork);
  commitHookEffectListMount(HasEffect | Layout, finishedWork);
}

export function commitHookPassiveMountEffects(finishedWork: Fiber): void {
  commitHookEffectListMount(HasEffect | Passive, finishedWork);
}

export function commitHookLayoutUnmountEffects(finishedWork: Fiber): void {
  commitHookEffectListUnmount(HasEffect | Layout, finishedWork);
  commitHookEffectListUnmount(HasEffect | Insertion, finishedWork);
}

export function commitHookPassiveUnmountEffects(finishedWork: Fiber): void {
  commitHookEffectListUnmount(HasEffect | Passive, finishedWork);
}

function commitHookEffectListMount(flags: number, finishedWork: Fiber): void {
  const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | null;
  const lastEffect = updateQueue?.lastEffect;
  if (lastEffect === null || lastEffect === undefined) {
    return;
  }

  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags) {
      const destroy = effect.create();
      effect.destroy = typeof destroy === "function" ? destroy : undefined;
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

function commitHookEffectListUnmount(flags: number, finishedWork: Fiber): void {
  const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | null;
  const lastEffect = updateQueue?.lastEffect;
  if (lastEffect === null || lastEffect === undefined) {
    return;
  }

  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags && effect.destroy !== undefined) {
      effect.destroy();
      effect.destroy = undefined;
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}
