import ReactSharedInternals from "shared/ReactSharedInternals.js";

export function captureOwnerStack(): string | null {
  const getCurrentStack = ReactSharedInternals.getCurrentStack;
  return getCurrentStack === null ? null : getCurrentStack();
}
