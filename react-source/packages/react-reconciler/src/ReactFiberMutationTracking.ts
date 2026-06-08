export let rootMutationContext = false;
export let viewTransitionMutationContext = false;

export function pushRootMutationContext(): void {
  rootMutationContext = false;
  viewTransitionMutationContext = false;
}

export function pushMutationContext(): boolean {
  const previous = viewTransitionMutationContext;
  viewTransitionMutationContext = false;
  return previous;
}

export function popMutationContext(previous: boolean): void {
  if (viewTransitionMutationContext) {
    rootMutationContext = true;
  }
  viewTransitionMutationContext = previous;
}

export function trackHostMutation(): void {
  viewTransitionMutationContext = true;
  rootMutationContext = true;
}
