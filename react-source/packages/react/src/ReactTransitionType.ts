import ReactSharedInternals from "shared/ReactSharedInternals.js";
import { enableGestureTransition, enableViewTransition } from "shared/ReactFeatureFlags.js";
import { startTransition } from "./ReactStartTransition.js";

export type TransitionTypes = string[];

export function addTransitionType(type: string): void {
  if (!enableViewTransition) {
    return;
  }

  const transition = ReactSharedInternals.T;
  if (transition !== null) {
    const transitionTypes = transition.types;
    if (transitionTypes === null || transitionTypes === undefined) {
      transition.types = [type];
    } else if (!transitionTypes.includes(type)) {
      transitionTypes.push(type);
    }
    return;
  }

  if (ReactSharedInternals.asyncTransitions === 0) {
    const apiName = enableGestureTransition ? "`startTransition()` or `startGestureTransition()`" : "`startTransition()`";
    console.error(`addTransitionType can only be called inside a ${apiName} callback. It must be associated with a specific Transition.`);
  }

  startTransition(() => addTransitionType(type));
}
