import type { Key, ReactNode, ReactPortal } from "shared";
import { REACT_PORTAL_TYPE, checkKeyStringCoercion } from "shared";

export function createPortal(
  children: ReactNode,
  containerInfo: unknown,
  implementation: unknown,
  key: Key = null,
): ReactPortal {
  const resolvedKey = key === null ? null : String(key);
  if (key !== null) {
    checkKeyStringCoercion(key);
  }

  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: resolvedKey,
    children,
    containerInfo,
    implementation,
  };
}
