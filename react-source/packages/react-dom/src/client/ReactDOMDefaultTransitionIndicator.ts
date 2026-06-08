type NavigationLike = EventTarget & {
  transition?: unknown;
  currentEntry?: {
    url?: string | null;
    getState(): unknown;
  } | null;
  navigate(url: string, options: Record<string, unknown>): void;
};

type NavigateEventLike = Event & {
  canIntercept?: boolean;
  info?: unknown;
  intercept(options: {
    handler(): Promise<unknown>;
    focusReset: "manual";
    scroll: "manual";
  }): void;
};

function getNavigation(): NavigationLike | null {
  const maybeNavigation = (globalThis as typeof globalThis & { navigation?: NavigationLike }).navigation;
  return typeof maybeNavigation === "object" && maybeNavigation !== null ? maybeNavigation : null;
}

export function defaultOnDefaultTransitionIndicator(): void | (() => void) {
  const navigation = getNavigation();
  if (navigation === null) {
    return;
  }
  const currentNavigation = navigation;

  let isCancelled = false;
  let pendingResolve: (() => void) | null = null;

  function handleNavigate(event: Event): void {
    const navigateEvent = event as NavigateEventLike;
    if (navigateEvent.canIntercept && navigateEvent.info === "react-transition") {
      navigateEvent.intercept({
        handler() {
          return new Promise((resolve) => {
            pendingResolve = () => resolve(undefined);
          });
        },
        focusReset: "manual",
        scroll: "manual",
      });
    }
  }

  function startFakeNavigation(): void {
    if (isCancelled || currentNavigation.transition) {
      return;
    }
    const currentEntry = currentNavigation.currentEntry;
    if (currentEntry?.url != null) {
      currentNavigation.navigate(currentEntry.url, {
        state: currentEntry.getState(),
        info: "react-transition",
        history: "replace",
      });
    }
  }

  function handleNavigateComplete(): void {
    if (pendingResolve !== null) {
      pendingResolve();
      pendingResolve = null;
    }
    if (!isCancelled) {
      setTimeout(startFakeNavigation, 20);
    }
  }

  currentNavigation.addEventListener("navigate", handleNavigate);
  currentNavigation.addEventListener("navigatesuccess", handleNavigateComplete);
  currentNavigation.addEventListener("navigateerror", handleNavigateComplete);
  setTimeout(startFakeNavigation, 100);

  return function cancelDefaultTransitionIndicator(): void {
    isCancelled = true;
    currentNavigation.removeEventListener("navigate", handleNavigate);
    currentNavigation.removeEventListener("navigatesuccess", handleNavigateComplete);
    currentNavigation.removeEventListener("navigateerror", handleNavigateComplete);
    if (pendingResolve !== null) {
      pendingResolve();
      pendingResolve = null;
    }
  };
}
