/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber, FiberRoot } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostComponent, HostHoistable, HostRoot, HostSingleton, HostText } from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

// @beginner: 声明 COMPONENT_TYPE：保存当前步骤需要读取或更新的数据。
const COMPONENT_TYPE = "selector.component";
// @beginner: 声明 HAS_PSEUDO_CLASS_TYPE：保存当前步骤需要读取或更新的数据。
const HAS_PSEUDO_CLASS_TYPE = "selector.has_pseudo_class";
// @beginner: 声明 ROLE_TYPE：保存当前步骤需要读取或更新的数据。
const ROLE_TYPE = "selector.role";
// @beginner: 声明 TEST_NAME_TYPE：保存当前步骤需要读取或更新的数据。
const TEST_NAME_TYPE = "selector.test_id";
// @beginner: 声明 TEXT_TYPE：保存当前步骤需要读取或更新的数据。
const TEXT_TYPE = "selector.text";

// @beginner: 定义 ComponentSelector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ComponentSelector = { $$typeof: typeof COMPONENT_TYPE; value: unknown };
// @beginner: 定义 HasPseudoClassSelector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type HasPseudoClassSelector = { $$typeof: typeof HAS_PSEUDO_CLASS_TYPE; value: Selector[] };
// @beginner: 定义 RoleSelector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type RoleSelector = { $$typeof: typeof ROLE_TYPE; value: string };
// @beginner: 定义 TextSelector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type TextSelector = { $$typeof: typeof TEXT_TYPE; value: string };
// @beginner: 定义 TestNameSelector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type TestNameSelector = { $$typeof: typeof TEST_NAME_TYPE; value: string };
// @beginner: 定义 Selector：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Selector =
  | ComponentSelector
  | HasPseudoClassSelector
  | RoleSelector
  | TextSelector
  | TestNameSelector;

// @beginner: 定义 BoundingRect：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// @beginner: 定义 IntersectionObserverOptions：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type IntersectionObserverOptions = Record<string, unknown>;
// @beginner: 定义 ObserveVisibleRectsCallback：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ObserveVisibleRectsCallback = (
  intersections: Array<{ ratio: number; rect: BoundingRect }>,
) => void;

// @beginner: 声明 commitHooks：保存当前步骤需要读取或更新的数据。
const commitHooks: Array<() => void> = [];

// @beginner: 进入 createComponentSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createComponentSelector(component: unknown): ComponentSelector {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { $$typeof: COMPONENT_TYPE, value: component };
}

// @beginner: 进入 createHasPseudoClassSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createHasPseudoClassSelector(selectors: Selector[]): HasPseudoClassSelector {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { $$typeof: HAS_PSEUDO_CLASS_TYPE, value: selectors };
}

// @beginner: 进入 createRoleSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createRoleSelector(role: string): RoleSelector {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { $$typeof: ROLE_TYPE, value: role };
}

// @beginner: 进入 createTextSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createTextSelector(text: string): TextSelector {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { $$typeof: TEXT_TYPE, value: text };
}

// @beginner: 进入 createTestNameSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createTestNameSelector(id: string): TestNameSelector {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return { $$typeof: TEST_NAME_TYPE, value: id };
}

// @beginner: 进入 isHostLike：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isHostLike(fiber: Fiber): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fiber.tag === HostComponent || fiber.tag === HostText || fiber.tag === HostHoistable || fiber.tag === HostSingleton;
}

// @beginner: 进入 getRootFiber：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getRootFiber(hostRoot: Fiber | FiberRoot | { _reactRootFiber?: Fiber }): Fiber {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("tag" in hostRoot) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return hostRoot;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if ("current" in hostRoot) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return hostRoot.current;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (hostRoot._reactRootFiber !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return hostRoot._reactRootFiber;
  }
  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw new Error("Could not find React container within specified host subtree.");
}

// @beginner: 进入 getFiberTextContent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getFiberTextContent(fiber: Fiber): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (fiber.tag === HostText) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return String((fiber.pendingProps as { text?: unknown }).text ?? fiber.pendingProps ?? "");
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof (fiber.stateNode as { textContent?: unknown } | null)?.textContent === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return String((fiber.stateNode as { textContent: string }).textContent);
  }
  // @beginner: 声明 text：保存当前步骤需要读取或更新的数据。
  let text = "";
  // @beginner: 声明 child：保存当前步骤需要读取或更新的数据。
  let child = fiber.child;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (child !== null) {
    text += getFiberTextContent(child);
    child = child.sibling;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return text;
}

// @beginner: 进入 matchSelector：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function matchSelector(fiber: Fiber, selector: Selector): boolean {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (selector.$$typeof) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case COMPONENT_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return fiber.type === selector.value || fiber.elementType === selector.value;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HAS_PSEUDO_CLASS_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return hasMatchingPaths(fiber, selector.value);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ROLE_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return isHostLike(fiber) && (fiber.memoizedProps ?? fiber.pendingProps).role === selector.value;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TEXT_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return isHostLike(fiber) && getFiberTextContent(fiber).includes(selector.value);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TEST_NAME_TYPE: {
      // @beginner: 声明 testName：保存当前步骤需要读取或更新的数据。
      const testName = (fiber.memoizedProps ?? fiber.pendingProps)["data-testname"];
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return isHostLike(fiber) && typeof testName === "string" && testName.toLowerCase() === selector.value.toLowerCase();
    }
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error("Invalid selector type specified.");
  }
}

// @beginner: 进入 selectorToString：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function selectorToString(selector: Selector): string {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (selector.$$typeof) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case COMPONENT_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `<${typeof selector.value === "function" ? selector.value.name || "Unknown" : "Unknown"}>`;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HAS_PSEUDO_CLASS_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `:has(${selector.value.map(selectorToString).join(" > ")})`;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ROLE_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `[role="${selector.value}"]`;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TEXT_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `"${selector.value}"`;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case TEST_NAME_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `[data-testname="${selector.value}"]`;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error("Invalid selector type specified.");
  }
}

// @beginner: 进入 findPaths：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findPaths(root: Fiber, selectors: Selector[]): Fiber[] {
  // @beginner: 声明 matching：保存当前步骤需要读取或更新的数据。
  const matching: Fiber[] = [];
  // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
  const stack: Array<{ fiber: Fiber; selectorIndex: number }> = [{ fiber: root, selectorIndex: 0 }];
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (stack.length > 0) {
    // @beginner: 声明 变量：保存当前步骤需要读取或更新的数据。
    const { fiber, selectorIndex: startIndex } = stack.pop()!;
    // @beginner: 声明 selectorIndex：保存当前步骤需要读取或更新的数据。
    let selectorIndex = startIndex;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (selectors[selectorIndex] !== undefined && matchSelector(fiber, selectors[selectorIndex])) {
      selectorIndex += 1;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (selectorIndex === selectors.length) {
      matching.push(fiber);
      continue;
    }
    // @beginner: 声明 child：保存当前步骤需要读取或更新的数据。
    let child = fiber.child;
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (child !== null) {
      stack.push({ fiber: child, selectorIndex });
      child = child.sibling;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return matching;
}

// @beginner: 进入 hasMatchingPaths：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function hasMatchingPaths(root: Fiber, selectors: Selector[]): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return findPaths(root, selectors).length > 0;
}

// @beginner: 进入 findAllNodes：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function findAllNodes(hostRoot: Fiber | FiberRoot, selectors: Selector[]): unknown[] {
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = getRootFiber(hostRoot);
  // @beginner: 声明 matchingFibers：保存当前步骤需要读取或更新的数据。
  const matchingFibers = findPaths(root, selectors);
  // @beginner: 声明 nodes：保存当前步骤需要读取或更新的数据。
  const nodes: unknown[] = [];
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const fiber of matchingFibers) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (isHostLike(fiber)) {
      nodes.push(fiber.stateNode);
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nodes;
}

// @beginner: 进入 getFindAllNodesFailureDescription：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getFindAllNodesFailureDescription(hostRoot: Fiber | FiberRoot, selectors: Selector[]): string | null {
  // @beginner: 声明 root：保存当前步骤需要读取或更新的数据。
  const root = getRootFiber(hostRoot);
  // @beginner: 声明 matched：保存当前步骤需要读取或更新的数据。
  const matched = selectors.filter((selector) => findPaths(root, [selector]).length > 0);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (matched.length === selectors.length) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    "findAllNodes was able to match part of the selector:\n" +
    `  ${matched.map(selectorToString).join(" > ")}\n\n` +
    "No matching component was found for:\n" +
    `  ${selectors.slice(matched.length).map(selectorToString).join(" > ")}`
  );
}

// @beginner: 进入 findBoundingRects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function findBoundingRects(hostRoot: Fiber | FiberRoot, selectors: Selector[]): BoundingRect[] {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return findAllNodes(hostRoot, selectors).map((node) => {
    // @beginner: 声明 rect：保存宿主节点的布局矩形，没有该 DOM API 时使用空矩形兜底。
    const rect = (node as { getBoundingClientRect?: () => BoundingRect }).getBoundingClientRect?.();
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return rect ?? { x: 0, y: 0, width: 0, height: 0 };
  });
}

// @beginner: 进入 focusWithin：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function focusWithin(hostRoot: Fiber | FiberRoot, selectors: Selector[]): boolean {
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const node of findAllNodes(hostRoot, selectors)) {
    // @beginner: 声明 focus：保存宿主节点暴露的 focus 方法，存在时才调用。
    const focus = (node as { focus?: () => void }).focus;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof focus === "function") {
      focus.call(node);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return true;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}

// @beginner: 进入 onCommitRoot：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function onCommitRoot(): void {
  commitHooks.forEach((hook) => hook());
}

// @beginner: 进入 observeVisibleRects：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function observeVisibleRects(
  hostRoot: Fiber | FiberRoot,
  selectors: Selector[],
  callback: ObserveVisibleRectsCallback,
  _options?: IntersectionObserverOptions,
): { disconnect: () => void } {
  // @beginner: 定义 emit：测试选择器监听到提交后调用，用于把匹配节点通知给订阅方。
  const emit = () => {
    callback(findBoundingRects(hostRoot, selectors).map((rect) => ({ ratio: 1, rect })));
  };
  commitHooks.push(emit);
  emit();
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    disconnect() {
      // @beginner: 声明 index：保存当前步骤需要读取或更新的数据。
      const index = commitHooks.indexOf(emit);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (index >= 0) {
        commitHooks.splice(index, 1);
      }
    },
  };
}
