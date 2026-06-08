import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
import { HostComponent, HostHoistable, HostRoot, HostSingleton, HostText } from "./ReactWorkTags.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

const COMPONENT_TYPE = "selector.component";
const HAS_PSEUDO_CLASS_TYPE = "selector.has_pseudo_class";
const ROLE_TYPE = "selector.role";
const TEST_NAME_TYPE = "selector.test_id";
const TEXT_TYPE = "selector.text";

type ComponentSelector = { $$typeof: typeof COMPONENT_TYPE; value: unknown };
type HasPseudoClassSelector = { $$typeof: typeof HAS_PSEUDO_CLASS_TYPE; value: Selector[] };
type RoleSelector = { $$typeof: typeof ROLE_TYPE; value: string };
type TextSelector = { $$typeof: typeof TEXT_TYPE; value: string };
type TestNameSelector = { $$typeof: typeof TEST_NAME_TYPE; value: string };
export type Selector =
  | ComponentSelector
  | HasPseudoClassSelector
  | RoleSelector
  | TextSelector
  | TestNameSelector;

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type IntersectionObserverOptions = Record<string, unknown>;
export type ObserveVisibleRectsCallback = (
  intersections: Array<{ ratio: number; rect: BoundingRect }>,
) => void;

const commitHooks: Array<() => void> = [];

export function createComponentSelector(component: unknown): ComponentSelector {
  return { $$typeof: COMPONENT_TYPE, value: component };
}

export function createHasPseudoClassSelector(selectors: Selector[]): HasPseudoClassSelector {
  return { $$typeof: HAS_PSEUDO_CLASS_TYPE, value: selectors };
}

export function createRoleSelector(role: string): RoleSelector {
  return { $$typeof: ROLE_TYPE, value: role };
}

export function createTextSelector(text: string): TextSelector {
  return { $$typeof: TEXT_TYPE, value: text };
}

export function createTestNameSelector(id: string): TestNameSelector {
  return { $$typeof: TEST_NAME_TYPE, value: id };
}

function isHostLike(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostText || fiber.tag === HostHoistable || fiber.tag === HostSingleton;
}

function getRootFiber(hostRoot: Fiber | FiberRoot | { _reactRootFiber?: Fiber }): Fiber {
  if ("tag" in hostRoot) {
    return hostRoot;
  }
  if ("current" in hostRoot) {
    return hostRoot.current;
  }
  if (hostRoot._reactRootFiber !== undefined) {
    return hostRoot._reactRootFiber;
  }
  throw new Error("Could not find React container within specified host subtree.");
}

function getFiberTextContent(fiber: Fiber): string {
  if (fiber.tag === HostText) {
    return String((fiber.pendingProps as { text?: unknown }).text ?? fiber.pendingProps ?? "");
  }
  if (typeof (fiber.stateNode as { textContent?: unknown } | null)?.textContent === "string") {
    return String((fiber.stateNode as { textContent: string }).textContent);
  }
  let text = "";
  let child = fiber.child;
  while (child !== null) {
    text += getFiberTextContent(child);
    child = child.sibling;
  }
  return text;
}

function matchSelector(fiber: Fiber, selector: Selector): boolean {
  switch (selector.$$typeof) {
    case COMPONENT_TYPE:
      return fiber.type === selector.value || fiber.elementType === selector.value;
    case HAS_PSEUDO_CLASS_TYPE:
      return hasMatchingPaths(fiber, selector.value);
    case ROLE_TYPE:
      return isHostLike(fiber) && (fiber.memoizedProps ?? fiber.pendingProps).role === selector.value;
    case TEXT_TYPE:
      return isHostLike(fiber) && getFiberTextContent(fiber).includes(selector.value);
    case TEST_NAME_TYPE: {
      const testName = (fiber.memoizedProps ?? fiber.pendingProps)["data-testname"];
      return isHostLike(fiber) && typeof testName === "string" && testName.toLowerCase() === selector.value.toLowerCase();
    }
    default:
      throw new Error("Invalid selector type specified.");
  }
}

function selectorToString(selector: Selector): string {
  switch (selector.$$typeof) {
    case COMPONENT_TYPE:
      return `<${typeof selector.value === "function" ? selector.value.name || "Unknown" : "Unknown"}>`;
    case HAS_PSEUDO_CLASS_TYPE:
      return `:has(${selector.value.map(selectorToString).join(" > ")})`;
    case ROLE_TYPE:
      return `[role="${selector.value}"]`;
    case TEXT_TYPE:
      return `"${selector.value}"`;
    case TEST_NAME_TYPE:
      return `[data-testname="${selector.value}"]`;
    default:
      throw new Error("Invalid selector type specified.");
  }
}

function findPaths(root: Fiber, selectors: Selector[]): Fiber[] {
  const matching: Fiber[] = [];
  const stack: Array<{ fiber: Fiber; selectorIndex: number }> = [{ fiber: root, selectorIndex: 0 }];
  while (stack.length > 0) {
    const { fiber, selectorIndex: startIndex } = stack.pop()!;
    let selectorIndex = startIndex;
    while (selectors[selectorIndex] !== undefined && matchSelector(fiber, selectors[selectorIndex])) {
      selectorIndex += 1;
    }
    if (selectorIndex === selectors.length) {
      matching.push(fiber);
      continue;
    }
    let child = fiber.child;
    while (child !== null) {
      stack.push({ fiber: child, selectorIndex });
      child = child.sibling;
    }
  }
  return matching;
}

function hasMatchingPaths(root: Fiber, selectors: Selector[]): boolean {
  return findPaths(root, selectors).length > 0;
}

export function findAllNodes(hostRoot: Fiber | FiberRoot, selectors: Selector[]): unknown[] {
  const root = getRootFiber(hostRoot);
  const matchingFibers = findPaths(root, selectors);
  const nodes: unknown[] = [];
  for (const fiber of matchingFibers) {
    if (isHostLike(fiber)) {
      nodes.push(fiber.stateNode);
    }
  }
  return nodes;
}

export function getFindAllNodesFailureDescription(hostRoot: Fiber | FiberRoot, selectors: Selector[]): string | null {
  const root = getRootFiber(hostRoot);
  const matched = selectors.filter((selector) => findPaths(root, [selector]).length > 0);
  if (matched.length === selectors.length) {
    return null;
  }
  return (
    "findAllNodes was able to match part of the selector:\n" +
    `  ${matched.map(selectorToString).join(" > ")}\n\n` +
    "No matching component was found for:\n" +
    `  ${selectors.slice(matched.length).map(selectorToString).join(" > ")}`
  );
}

export function findBoundingRects(hostRoot: Fiber | FiberRoot, selectors: Selector[]): BoundingRect[] {
  return findAllNodes(hostRoot, selectors).map((node) => {
    const rect = (node as { getBoundingClientRect?: () => BoundingRect }).getBoundingClientRect?.();
    return rect ?? { x: 0, y: 0, width: 0, height: 0 };
  });
}

export function focusWithin(hostRoot: Fiber | FiberRoot, selectors: Selector[]): boolean {
  for (const node of findAllNodes(hostRoot, selectors)) {
    const focus = (node as { focus?: () => void }).focus;
    if (typeof focus === "function") {
      focus.call(node);
      return true;
    }
  }
  return false;
}

export function onCommitRoot(): void {
  commitHooks.forEach((hook) => hook());
}

export function observeVisibleRects(
  hostRoot: Fiber | FiberRoot,
  selectors: Selector[],
  callback: ObserveVisibleRectsCallback,
  _options?: IntersectionObserverOptions,
): { disconnect: () => void } {
  const emit = () => {
    callback(findBoundingRects(hostRoot, selectors).map((rect) => ({ ratio: 1, rect })));
  };
  commitHooks.push(emit);
  emit();
  return {
    disconnect() {
      const index = commitHooks.indexOf(emit);
      if (index >= 0) {
        commitHooks.splice(index, 1);
      }
    },
  };
}
