function shim(): never {
  throw new Error(
    "The current renderer does not support test selectors. This error is likely caused by a bug in React.",
  );
}

export const supportsTestSelectors = false;
export const findFiberRoot = shim;
export const getBoundingRect = shim;
export const getTextContent = shim;
export const isHiddenSubtree = shim;
export const matchAccessibilityRole = shim;
export const setFocusIfFocusable = shim;
export const setupIntersectionObserver = shim;
