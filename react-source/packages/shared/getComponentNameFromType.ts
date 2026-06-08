import {
  REACT_FRAGMENT_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_LAZY_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
} from "./ReactSymbols.js";

export default function getComponentNameFromType(type: unknown): string | null {
  if (type === null || type === undefined) {
    return null;
  }

  if (typeof type === "string") {
    return type;
  }

  if (typeof type === "function") {
    const fn = type as Function & { displayName?: string };
    return fn.displayName ?? fn.name ?? null;
  }

  if (typeof type === "symbol") {
    switch (type) {
      case REACT_FRAGMENT_TYPE:
        return "Fragment";
      case REACT_PROFILER_TYPE:
        return "Profiler";
      case REACT_STRICT_MODE_TYPE:
        return "StrictMode";
      case REACT_SUSPENSE_TYPE:
        return "Suspense";
      default:
        return null;
    }
  }

  if (typeof type === "object") {
    const maybeType = type as {
      $$typeof?: symbol;
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
      _payload?: unknown;
      _init?: (payload: unknown) => unknown;
    };

    switch (maybeType.$$typeof) {
      case REACT_CONTEXT_TYPE:
        return maybeType.displayName ?? "Context";
      case REACT_FORWARD_REF_TYPE:
        return maybeType.displayName ?? maybeType.render?.displayName ?? maybeType.render?.name ?? "ForwardRef";
      case REACT_MEMO_TYPE:
        return maybeType.displayName ?? getComponentNameFromType(maybeType.type) ?? "Memo";
      case REACT_LAZY_TYPE:
        try {
          return getComponentNameFromType(maybeType._init?.(maybeType._payload));
        } catch {
          return null;
        }
    }
  }

  return null;
}
