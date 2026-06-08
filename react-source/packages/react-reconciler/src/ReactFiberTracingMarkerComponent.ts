import type { Fiber } from "./ReactInternalTypes.js";
import type { StackCursor } from "./ReactFiberStack.js";
import { createCursor, pop, push } from "./ReactFiberStack.js";

export type SuspenseInfo = { name: string | null };
export type Transition = { name?: string | null; startTime?: number };
export type PendingBoundaries = Map<unknown, SuspenseInfo>;

export interface PendingTransitionCallbacks {
  transitionStart: Transition[] | null;
  transitionProgress: Map<Transition, PendingBoundaries> | null;
  transitionComplete: Transition[] | null;
  markerProgress: Map<string, { pendingBoundaries: PendingBoundaries; transitions: Set<Transition> }> | null;
  markerIncomplete: Map<string, { aborts: TransitionAbort[]; transitions: Set<Transition> }> | null;
  markerComplete: Map<string, Set<Transition>> | null;
}

export interface TracingMarkerInstance {
  tag?: TracingMarkerTag;
  transitions: Set<Transition> | null;
  pendingBoundaries: PendingBoundaries | null;
  aborts: TransitionAbort[] | null;
  name: string | null;
}

export interface TransitionAbort {
  reason: "error" | "unknown" | "marker" | "suspense";
  name?: string | null;
}

export const TransitionRoot = 0;
export const TransitionTracingMarker = 1;
export type TracingMarkerTag = typeof TransitionRoot | typeof TransitionTracingMarker;

export interface TransitionTracingCallbacks {
  onTransitionStart?: (transitionName: string, startTime: number | undefined) => void;
  onTransitionProgress?: (
    transitionName: string,
    startTime: number | undefined,
    endTime: number,
    pending: SuspenseInfo[],
  ) => void;
  onTransitionComplete?: (transitionName: string, startTime: number | undefined, endTime: number) => void;
  onMarkerProgress?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    endTime: number,
    pending: SuspenseInfo[],
  ) => void;
  onMarkerComplete?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    endTime: number,
  ) => void;
  onMarkerIncomplete?: (
    transitionName: string,
    markerName: string,
    startTime: number | undefined,
    aborts: Array<{ type: string; name?: string | null; endTime: number }>,
  ) => void;
}

const markerInstancesCursor: StackCursor<TracingMarkerInstance[] | null> = createCursor(null);

export function processTransitionCallbacks(
  pendingTransitions: PendingTransitionCallbacks,
  endTime: number,
  callbacks: TransitionTracingCallbacks,
): void {
  pendingTransitions.transitionStart?.forEach((transition) => {
    if (transition.name != null) {
      callbacks.onTransitionStart?.(transition.name, transition.startTime);
    }
  });

  pendingTransitions.transitionProgress?.forEach((pending, transition) => {
    if (transition.name != null) {
      callbacks.onTransitionProgress?.(transition.name, transition.startTime, endTime, Array.from(pending.values()));
    }
  });

  pendingTransitions.transitionComplete?.forEach((transition) => {
    if (transition.name != null) {
      callbacks.onTransitionComplete?.(transition.name, transition.startTime, endTime);
    }
  });

  pendingTransitions.markerProgress?.forEach((marker, markerName) => {
    marker.transitions.forEach((transition) => {
      if (transition.name != null) {
        callbacks.onMarkerProgress?.(
          transition.name,
          markerName,
          transition.startTime,
          endTime,
          Array.from(marker.pendingBoundaries.values()),
        );
      }
    });
  });

  pendingTransitions.markerComplete?.forEach((transitions, markerName) => {
    transitions.forEach((transition) => {
      if (transition.name != null) {
        callbacks.onMarkerComplete?.(transition.name, markerName, transition.startTime, endTime);
      }
    });
  });

  pendingTransitions.markerIncomplete?.forEach(({ transitions, aborts }, markerName) => {
    transitions.forEach((transition) => {
      if (transition.name != null) {
        callbacks.onMarkerIncomplete?.(
          transition.name,
          markerName,
          transition.startTime,
          aborts.map((abort) => ({ type: abort.reason, name: abort.name, endTime })),
        );
      }
    });
  });
}

function createMarker(name: string | null, tag: TracingMarkerTag): TracingMarkerInstance {
  return {
    tag,
    transitions: null,
    pendingBoundaries: null,
    aborts: null,
    name,
  };
}

export function pushRootMarkerInstance(workInProgress: Fiber): void {
  push(markerInstancesCursor, [createMarker(null, TransitionRoot)], workInProgress);
}

export function popRootMarkerInstance(workInProgress: Fiber): void {
  pop(markerInstancesCursor, workInProgress);
}

export function pushMarkerInstance(workInProgress: Fiber, markerInstance: TracingMarkerInstance | string): void {
  const marker =
    typeof markerInstance === "string"
      ? createMarker(markerInstance, TransitionTracingMarker)
      : markerInstance;
  const current = markerInstancesCursor.current;
  push(markerInstancesCursor, current === null ? [marker] : current.concat(marker), workInProgress);
}

export function popMarkerInstance(workInProgress: Fiber): void {
  pop(markerInstancesCursor, workInProgress);
}

export function getMarkerInstances(): TracingMarkerInstance[] | null {
  return markerInstancesCursor.current;
}
