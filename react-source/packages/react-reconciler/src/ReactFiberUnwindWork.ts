import type { ReactContext } from "shared";
import type { Fiber } from "./ReactInternalTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import { DidCapture, NoFlags, ShouldCapture } from "./ReactFiberFlags.js";
import {
  ClassComponent,
  ContextProvider,
  HostComponent,
  HostPortal,
  HostRoot,
  SuspenseComponent,
  SuspenseListComponent,
} from "./ReactWorkTags.js";
import { popHostContainer, popHostContext } from "./ReactFiberHostContext.js";
import { popProvider } from "./ReactFiberNewContext.js";

function captureIfNeeded(workInProgress: Fiber): Fiber | null {
  const flags = workInProgress.flags;
  if ((flags & ShouldCapture) !== NoFlags && (flags & DidCapture) === NoFlags) {
    workInProgress.flags = (flags & ~ShouldCapture) | DidCapture;
    return workInProgress;
  }
  return null;
}

export function unwindWork(
  _current: Fiber | null,
  workInProgress: Fiber,
  _renderLanes: Lanes,
): Fiber | null {
  switch (workInProgress.tag) {
    case ClassComponent:
    case SuspenseComponent:
    case SuspenseListComponent:
      return captureIfNeeded(workInProgress);
    case HostRoot:
      popHostContainer(workInProgress);
      return captureIfNeeded(workInProgress);
    case HostComponent:
      popHostContext(workInProgress);
      return null;
    case HostPortal:
      popHostContainer(workInProgress);
      return null;
    case ContextProvider:
      popProvider((workInProgress.type as { _context: ReactContext<unknown> })._context, workInProgress);
      return null;
    default:
      return null;
  }
}

export function unwindInterruptedWork(
  _current: Fiber | null,
  interruptedWork: Fiber,
  _renderLanes: Lanes,
): void {
  switch (interruptedWork.tag) {
    case HostRoot:
    case HostPortal:
      popHostContainer(interruptedWork);
      break;
    case HostComponent:
      popHostContext(interruptedWork);
      break;
    case ContextProvider:
      popProvider((interruptedWork.type as { _context: ReactContext<unknown> })._context, interruptedWork);
      break;
    default:
      break;
  }
}
