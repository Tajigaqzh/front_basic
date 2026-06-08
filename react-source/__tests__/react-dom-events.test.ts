import { describe, expect, it, vi } from "vitest";
import { FiberNode } from "../packages/react-reconciler/src/ReactFiber.js";
import { HostComponent } from "../packages/react-reconciler/src/ReactWorkTags.js";
import {
  allNativeEvents,
  registrationNameDependencies,
} from "../packages/react-dom-bindings/src/events/EventRegistry.js";
import {
  registerSimpleEvents,
  topLevelEventsToReactNames,
} from "../packages/react-dom-bindings/src/events/DOMEventProperties.js";
import {
  listenToAllSupportedEvents,
  processDispatchQueue,
  type DispatchQueue,
} from "../packages/react-dom-bindings/src/events/DOMPluginEventSystem.js";
import {
  extractEvents,
  registerEvents,
} from "../packages/react-dom-bindings/src/events/plugins/SimpleEventPlugin.js";
import {
  extractEvents as extractChangeEvents,
  registerEvents as registerChangeEvents,
} from "../packages/react-dom-bindings/src/events/plugins/ChangeEventPlugin.js";
import {
  extractEvents as extractEnterLeaveEvents,
  registerEvents as registerEnterLeaveEvents,
} from "../packages/react-dom-bindings/src/events/plugins/EnterLeaveEventPlugin.js";
import {
  extractEvents as extractBeforeInputEvents,
  registerEvents as registerBeforeInputEvents,
} from "../packages/react-dom-bindings/src/events/plugins/BeforeInputEventPlugin.js";
import {
  extractEvents as extractSelectEvents,
  registerEvents as registerSelectEvents,
} from "../packages/react-dom-bindings/src/events/plugins/SelectEventPlugin.js";
import {
  extractEvents as extractScrollEndEvents,
  registerEvents as registerScrollEndEvents,
} from "../packages/react-dom-bindings/src/events/plugins/ScrollEndEventPlugin.js";
import {
  dispatchReplayedFormAction,
  extractEvents as extractFormActionEvents,
  getPendingFormStatus,
} from "../packages/react-dom-bindings/src/events/plugins/FormActionEventPlugin.js";
import {
  clearIfContinuousEvent,
  hasQueuedContinuousEvents,
  isDiscreteEventThatRequiresHydration,
  queueIfContinuousEvent,
  replayUnblockedEvents,
} from "../packages/react-dom-bindings/src/events/ReactDOMEventReplaying.js";
import {
  getFiberCurrentPropsFromNode,
  getScrollEndTimer,
  precacheFiberNode,
  updateFiberProps,
} from "../packages/react-dom-bindings/src/client/ReactDOMComponentTree.js";
import { updateProperties } from "../packages/react-dom-bindings/src/client/ReactDOMComponent.js";
import {
  enqueueStateRestore,
  needsStateRestore,
  restoreStateIfNeeded,
} from "../packages/react-dom-bindings/src/events/ReactDOMControlledComponent.js";
import { isReplayingEvent } from "../packages/react-dom-bindings/src/events/CurrentReplayingEvent.js";
import { IS_CAPTURE_PHASE } from "../packages/react-dom-bindings/src/events/EventSystemFlags.js";
import validAriaProperties from "../packages/react-dom-bindings/src/shared/validAriaProperties.js";
import {
  getValueDescriptorExpectingEnumForWarning,
  getValueDescriptorExpectingObjectForWarning,
  validateLinkPropsForStyleResource,
} from "../packages/react-dom-bindings/src/shared/ReactDOMResourceValidation.js";
import {
  dispatchHint,
  preinitScriptForSSR,
} from "../packages/react-dom-bindings/src/shared/ReactFlightClientConfigDOM.js";
import ReactDOMSharedInternals from "../packages/shared/ReactDOMSharedInternals.js";
import { addEventBubbleListener as addWWWEventBubbleListener } from "../packages/react-dom-bindings/src/events/forks/EventListener-www.js";
import {
  preconnect,
  preinit,
  preinitModule,
  preload,
} from "../packages/react-dom/src/shared/ReactDOMFloat.js";
import * as React from "../packages/react/src/index.js";
import { createRoot } from "../packages/react-dom/src/client/ReactDOMRoot.js";
import { flushSync } from "../packages/react-dom/src/shared/ReactDOMFlushSync.js";
import { defaultOnDefaultTransitionIndicator } from "../packages/react-dom/src/client/ReactDOMDefaultTransitionIndicator.js";
import { DiscreteEventPriority } from "../packages/react-reconciler/src/ReactEventPriorities.js";
import ReactSharedInternals from "../packages/shared/ReactSharedInternals.js";
import * as ReactDOMClientFB from "../packages/react-dom/src/client/ReactDOMClientFB.js";
import { initInput, updateInput } from "../packages/react-dom-bindings/src/client/ReactDOMInput.js";
import { initTextarea, updateTextarea } from "../packages/react-dom-bindings/src/client/ReactDOMTextarea.js";
import { initSelect, updateSelect } from "../packages/react-dom-bindings/src/client/ReactDOMSelect.js";
import { trackValueOnNode, updateValueIfChanged } from "../packages/react-dom-bindings/src/client/inputValueTracking.js";
import { createEventHandle } from "../packages/react-dom-bindings/src/client/ReactDOMEventHandle.js";
import { isValidContainer } from "../packages/react-dom-bindings/src/client/ReactDOMContainer.js";
import { validateDOMNesting, updatedAncestorInfoDev } from "../packages/react-dom-bindings/src/client/validateDOMNesting.js";
import cssShorthand from "../packages/react-dom-bindings/src/client/CSSShorthandProperty.js";
import accessibilityRoles from "../packages/react-dom-bindings/src/client/DOMAccessibilityRoles.js";

describe("EventRegistry / DOMEventProperties", () => {
  it("registerSimpleEvents 建立 React 事件名到原生事件依赖的映射", () => {
    registerSimpleEvents();

    expect(topLevelEventsToReactNames.get("click")).toBe("onClick");
    expect(topLevelEventsToReactNames.get("dblclick")).toBe("onDoubleClick");
    expect(registrationNameDependencies.onClick).toEqual(["click"]);
    expect(registrationNameDependencies.onClickCapture).toEqual(["click"]);
    expect(allNativeEvents.has("click")).toBe(true);
  });

  it("listenToAllSupportedEvents 在根容器注册所有插件事件且去重", () => {
    const root = new EventTarget();
    const registrations: Array<{ type: string; capture: boolean }> = [];
    const originalAdd = root.addEventListener.bind(root);
    root.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      registrations.push({
        type,
        capture: typeof options === "boolean" ? options : options?.capture === true,
      });
      originalAdd(type, listener, options);
    }) as typeof root.addEventListener;

    listenToAllSupportedEvents(root);
    listenToAllSupportedEvents(root);

    expect(registrations.filter((item) => item.type === "click" && !item.capture)).toHaveLength(1);
    expect(registrations.filter((item) => item.type === "click" && item.capture)).toHaveLength(1);
  });

  it("根事件委托通过 target DOM node 找到 Fiber listener", () => {
    class FakeNode extends EventTarget {
      nodeType = 1;
      parentNode: FakeNode | null = null;
    }

    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;

    const root = new FakeNode();
    const button = new FakeNode();
    button.parentNode = root;
    const calls: string[] = [];
    const fiber = new FiberNode(HostComponent, { onClick: () => calls.push("delegated") }, null);
    fiber.type = "button";
    fiber.stateNode = button;
    fiber.memoizedProps = fiber.pendingProps;
    precacheFiberNode(fiber, button as unknown as Node);
    updateFiberProps(button as unknown as Node, fiber.pendingProps);

    try {
      listenToAllSupportedEvents(root);
      const event = new Event("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: button });
      root.dispatchEvent(event);
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
    }

    expect(calls).toEqual(["delegated"]);
  });

  it("DOM props 层不重复写入文本 children，避免 HostText 初次挂载双文本", () => {
    const element = {
      textContent: "",
      attributes: {} as Record<string, string>,
      setAttribute(name: string, value: unknown) {
        this.attributes[name] = String(value);
      },
      removeAttribute(name: string) {
        delete this.attributes[name];
      },
    } as unknown as Element;

    updateProperties(element, "button", {}, { children: "卸载功能面板" });

    expect(element.textContent).toBe("");
  });
});

describe("react-dom-bindings shared helpers", () => {
  it("validAriaProperties 包含官方 ARIA 白名单", () => {
    expect(validAriaProperties["aria-label"]).toBe(0);
    expect(validAriaProperties["aria-rowindextext"]).toBe(0);
    expect(validAriaProperties["aria-not-real"]).toBeUndefined();
  });

  it("validateLinkPropsForStyleResource 发现 precedence 冲突 props", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(
        validateLinkPropsForStyleResource({
          href: "/style.css",
          onLoad: () => undefined,
          disabled: false,
        }),
      ).toBe(true);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }

    expect(getValueDescriptorExpectingObjectForWarning(null)).toBe("`null`");
    expect(getValueDescriptorExpectingEnumForWarning("preload")).toBe("\"preload\"");
  });

  it("ReactFlightClientConfigDOM 分发 resource hint 到 ReactDOM dispatcher", () => {
    const calls: unknown[][] = [];
    const previous = ReactDOMSharedInternals.d;
    ReactDOMSharedInternals.d = {
      ...previous,
      D: (...args: unknown[]) => calls.push(["D", ...args]),
      C: (...args: unknown[]) => calls.push(["C", ...args]),
      X: (...args: unknown[]) => calls.push(["X", ...args]),
    };

    try {
      dispatchHint("D", "https://example.com");
      dispatchHint("C", ["https://cdn.example.com", "anonymous"]);
      preinitScriptForSSR("/app.js", "nonce", "use-credentials");
    } finally {
      ReactDOMSharedInternals.d = previous;
    }

    expect(calls).toEqual([
      ["D", "https://example.com"],
      ["C", "https://cdn.example.com", "anonymous"],
      ["X", "/app.js", { crossOrigin: "use-credentials", nonce: "nonce" }],
    ]);
  });

  it("EventListener-www fork 复用普通 DOM listener 实现", () => {
    const target = new EventTarget();
    const calls: string[] = [];
    const remove = addWWWEventBubbleListener(target, "ping", () => calls.push("ping"));

    target.dispatchEvent(new Event("ping"));
    remove();
    target.dispatchEvent(new Event("ping"));

    expect(calls).toEqual(["ping"]);
  });
});

describe("react-dom float/client forks", () => {
  it("flushSync 临时切换离散事件优先级并触发同步 flush", () => {
    const previousDispatcher = ReactDOMSharedInternals.d;
    const previousPriority = ReactDOMSharedInternals.p;
    const previousTransition = ReactSharedInternals.T;
    const calls: string[] = [];
    ReactDOMSharedInternals.p = 123;
    ReactSharedInternals.T = { name: "outer" };
    ReactDOMSharedInternals.d = {
      ...previousDispatcher,
      f: () => {
        calls.push("flush");
        return false;
      },
    };

    try {
      const result = flushSync(() => {
        expect(ReactDOMSharedInternals.p).toBe(DiscreteEventPriority);
        expect(ReactSharedInternals.T).toBe(null);
        return "done";
      });
      expect(result).toBe("done");
      expect(calls).toEqual(["flush"]);
      expect(ReactDOMSharedInternals.p).toBe(123);
      expect(ReactSharedInternals.T).toEqual({ name: "outer" });
    } finally {
      ReactDOMSharedInternals.d = previousDispatcher;
      ReactDOMSharedInternals.p = previousPriority;
      ReactSharedInternals.T = previousTransition;
    }
  });

  it("ReactDOMFloat resource APIs 分发到 ReactDOM dispatcher", () => {
    const calls: unknown[][] = [];
    const previous = ReactDOMSharedInternals.d;
    ReactDOMSharedInternals.d = {
      ...previous,
      C: (...args: unknown[]) => calls.push(["C", ...args]),
      L: (...args: unknown[]) => calls.push(["L", ...args]),
      S: (...args: unknown[]) => calls.push(["S", ...args]),
      M: (...args: unknown[]) => calls.push(["M", ...args]),
    };

    try {
      preconnect("https://cdn.example.com", { crossOrigin: "anonymous" });
      preload("/font.woff2", { as: "font", crossOrigin: "use-credentials", type: "font/woff2" });
      preinit("/style.css", { as: "style", precedence: "default" });
      preinitModule("/entry.js", { nonce: "nonce" });
    } finally {
      ReactDOMSharedInternals.d = previous;
    }

    expect(calls[0]).toEqual(["C", "https://cdn.example.com", "anonymous"]);
    expect(calls[1]).toEqual([
      "L",
      "/font.woff2",
      "font",
      expect.objectContaining({ crossOrigin: "", type: "font/woff2" }),
    ]);
    expect(calls[2]).toEqual(["S", "/style.css", "default", expect.any(Object)]);
    expect(calls[3]).toEqual(["M", "/entry.js", expect.objectContaining({ nonce: "nonce" })]);
  });

  it("DefaultTransitionIndicator 拦截 react-transition navigate 并可清理", () => {
    const navigationTarget = Object.assign(new EventTarget(), {
      transition: null,
      currentEntry: { url: "https://example.com", getState: () => ({}) },
      navigate: vi.fn(),
    });
    const previousNavigation = (globalThis as typeof globalThis & { navigation?: unknown }).navigation;
    (globalThis as typeof globalThis & { navigation?: unknown }).navigation = navigationTarget;
    const intercept = vi.fn();

    try {
      const cleanup = defaultOnDefaultTransitionIndicator();
      const event = new Event("navigate") as Event & {
        canIntercept: boolean;
        info: string;
        intercept: typeof intercept;
      };
      event.canIntercept = true;
      event.info = "react-transition";
      event.intercept = intercept;
      navigationTarget.dispatchEvent(event);
      cleanup?.();
    } finally {
      (globalThis as typeof globalThis & { navigation?: unknown }).navigation = previousNavigation;
    }

    expect(intercept).toHaveBeenCalledWith(
      expect.objectContaining({ focusReset: "manual", scroll: "manual" }),
    );
    expect(ReactDOMClientFB.createRoot).toBeTypeOf("function");
  });
});

describe("react-dom root integration", () => {
  it("条件卸载和重新挂载 host 子树不会留下重复 DOM", async () => {
    class FakeNode extends EventTarget {
      parentNode: FakeNode | null = null;
      childNodes: FakeNode[] = [];
      nodeType = 1;

      appendChild(node: FakeNode): FakeNode {
        if (node.parentNode !== null) {
          node.parentNode.removeChild(node);
        }
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
      }

      removeChild(node: FakeNode): FakeNode {
        const index = this.childNodes.indexOf(node);
        if (index >= 0) {
          this.childNodes.splice(index, 1);
        }
        node.parentNode = null;
        return node;
      }

      contains(node: FakeNode): boolean {
        let current: FakeNode | null = node;
        while (current !== null) {
          if (current === this) {
            return true;
          }
          current = current.parentNode;
        }
        return false;
      }
    }

    class FakeElement extends FakeNode {
      attributes: Record<string, string> = {};
      className = "";
      ownerDocument: FakeDocument | null = null;
      textContent = "";

      constructor(readonly tagName: string) {
        super();
      }

      setAttribute(name: string, value: unknown): void {
        this.attributes[name] = String(value);
        if (name === "class") {
          this.className = String(value);
        }
      }

      removeAttribute(name: string): void {
        delete this.attributes[name];
        if (name === "class") {
          this.className = "";
        }
      }
    }

    class FakeText extends FakeNode {
      nodeType = 3;
      constructor(public nodeValue: string) {
        super();
      }
    }

    class FakeDocument extends EventTarget {
      nodeType = 9;
      documentElement = { dataset: {} };

      createElement(tagName: string): FakeElement {
        const element = new FakeElement(tagName);
        element.ownerDocument = this;
        return element;
      }

      createTextNode(text: string): FakeText {
        return new FakeText(text);
      }
    }

    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    const previousElement = (globalThis as typeof globalThis & { Element?: unknown }).Element;
    const previousText = (globalThis as typeof globalThis & { Text?: unknown }).Text;
    const previousDocument = (globalThis as typeof globalThis & { document?: unknown }).document;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;
    (globalThis as typeof globalThis & { Element?: unknown }).Element = FakeElement;
    (globalThis as typeof globalThis & { Text?: unknown }).Text = FakeText;
    const fakeDocument = new FakeDocument();
    (globalThis as typeof globalThis & { document?: unknown }).document = fakeDocument;

    function Panel() {
      return React.createElement("div", { className: "panel" }, "panel");
    }

    function App() {
      const [mounted, setMounted] = React.useState(true);
      return React.createElement(
        "main",
        null,
        React.createElement(
          "button",
          { onClick: () => setMounted((value) => !value) },
          mounted ? "卸载功能面板" : "重新挂载功能面板",
        ),
        mounted
          ? React.createElement(
              "div",
              { className: "grid" },
              React.createElement(Panel, null),
              React.createElement(Panel, null),
            )
          : React.createElement("section", { className: "empty" }, "empty"),
      );
    }

    const rootElement = new FakeElement("root");
    rootElement.ownerDocument = fakeDocument;

    function walk(node: FakeNode, predicate: (node: FakeNode) => boolean, result: FakeNode[] = []): FakeNode[] {
      if (predicate(node)) {
        result.push(node);
      }
      for (const child of node.childNodes) {
        walk(child, predicate, result);
      }
      return result;
    }

    function countByClass(className: string): number {
      return walk(rootElement, (node) => node instanceof FakeElement && node.className === className).length;
    }

    function getButton(): FakeElement {
      return walk(rootElement, (node) => node instanceof FakeElement && node.tagName === "button")[0] as FakeElement;
    }

    async function clickToggle(): Promise<void> {
      const event = new Event("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: getButton() });
      rootElement.dispatchEvent(event);
      await Promise.resolve();
      await Promise.resolve();
    }

    try {
      createRoot(rootElement as unknown as Element).render(React.createElement(App, null));
      await Promise.resolve();
      await Promise.resolve();

      expect([countByClass("grid"), countByClass("panel"), countByClass("empty")]).toEqual([1, 2, 0]);
      await clickToggle();
      expect([countByClass("grid"), countByClass("panel"), countByClass("empty")]).toEqual([0, 0, 1]);
      await clickToggle();
      expect([countByClass("grid"), countByClass("panel"), countByClass("empty")]).toEqual([1, 2, 0]);
      await clickToggle();
      expect([countByClass("grid"), countByClass("panel"), countByClass("empty")]).toEqual([0, 0, 1]);
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
      (globalThis as typeof globalThis & { Element?: unknown }).Element = previousElement;
      (globalThis as typeof globalThis & { Text?: unknown }).Text = previousText;
      (globalThis as typeof globalThis & { document?: unknown }).document = previousDocument;
    }
  });
});

describe("react-dom-bindings client form/control helpers", () => {
  it("inputValueTracking 检测值变化", () => {
    const input = { type: "text", value: "a" } as HTMLInputElement;
    trackValueOnNode(input);
    input.value = "b";
    expect(updateValueIfChanged(input)).toBe(true);
    expect(updateValueIfChanged(input)).toBe(false);
  });

  it("ReactDOMInput/Textarea/Select 初始化和更新受控状态", () => {
    const input = { type: "text", value: "", defaultValue: "", checked: false, defaultChecked: false, name: "" } as HTMLInputElement;
    initInput(input, "a", null, null, null, "text", "field");
    updateInput(input, "b", null, null, null, "text", "field");
    expect(input.value).toBe("b");

    const textarea = { value: "", defaultValue: "" } as HTMLTextAreaElement;
    initTextarea(textarea, null, "hello", null);
    updateTextarea(textarea, "world", null);
    expect(textarea.value).toBe("world");

    const select = {
      multiple: false,
      options: [
        { value: "a", selected: false },
        { value: "b", selected: false },
      ],
    } as unknown as HTMLSelectElement;
    initSelect(select, "b", null, false);
    expect(select.options[1].selected).toBe(true);
    updateSelect(select, ["a"], null, true, false);
    expect(select.options[0].selected).toBe(true);
  });

  it("EventHandle、container、DOM nesting 和表数据辅助可用", () => {
    const target = new EventTarget();
    const calls: string[] = [];
    const click = createEventHandle("click");
    const remove = click(target, () => calls.push("click"));
    target.dispatchEvent(new Event("click"));
    remove();
    target.dispatchEvent(new Event("click"));

    expect(calls).toEqual(["click"]);
    expect(isValidContainer({ nodeType: 1 })).toBe(true);
    expect(cssShorthand.margin).toContain("marginTop");
    expect(accessibilityRoles.button).toBe(0);

    const pInfo = updatedAncestorInfoDev(null, "p");
    expect(validateDOMNesting("div", pInfo)).toBe(false);
  });

  it("ReactDOMControlledComponent 根据当前 Fiber props 恢复受控 input", () => {
    const input = { type: "text", value: "dirty", defaultValue: "", checked: false, defaultChecked: false } as HTMLInputElement;
    const fiber = new FiberNode(HostComponent, { value: "controlled" }, null);
    fiber.type = "input";
    fiber.stateNode = input;
    fiber.memoizedProps = { value: "controlled" };
    precacheFiberNode(fiber, input as unknown as Node);
    updateFiberProps(input as unknown as Node, { value: "controlled" });

    enqueueStateRestore(input as unknown as Node);
    expect(needsStateRestore()).toBe(true);
    restoreStateIfNeeded();

    expect(input.value).toBe("controlled");
    expect(needsStateRestore()).toBe(false);
  });
});

describe("ChangeEventPlugin", () => {
  it("input 事件提取 onChange dispatchQueue", () => {
    registerChangeEvents();
    const calls: string[] = [];
    const input = Object.assign(new EventTarget(), {
      nodeName: "INPUT",
      type: "text",
      value: "a",
    });
    const fiber = new FiberNode(HostComponent, { onChange: () => calls.push("change") }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = input;
    const queue: DispatchQueue = [];

    extractChangeEvents(queue, "input", fiber, new Event("input"), input, 0, input);
    expect(queue).toHaveLength(1);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["change"]);
  });

  it("checkbox 使用 click 触发 onChange", () => {
    registerChangeEvents();
    const checkbox = Object.assign(new EventTarget(), {
      nodeName: "INPUT",
      type: "checkbox",
    });
    const fiber = new FiberNode(HostComponent, { onChange: () => undefined }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = checkbox;
    const queue: DispatchQueue = [];

    extractChangeEvents(queue, "click", fiber, new Event("click"), checkbox, 0, checkbox);
    expect(queue).toHaveLength(1);
    expect(queue[0].event.type).toBe("change");
  });
});

describe("EnterLeaveEventPlugin", () => {
  it("mouseout 提取 leave 和 enter 事件", () => {
    registerEnterLeaveEvents();
    const calls: string[] = [];
    const fromNode = Object.assign(new EventTarget(), {});
    const toNode = Object.assign(new EventTarget(), {});
    const from = new FiberNode(HostComponent, { onMouseLeave: () => calls.push("leave") }, null);
    const to = new FiberNode(HostComponent, { onMouseEnter: () => calls.push("enter") }, null);
    from.memoizedProps = from.pendingProps;
    to.memoizedProps = to.pendingProps;
    from.stateNode = fromNode;
    to.stateNode = toNode;
    (toNode as EventTarget & { __reactFiber?: typeof to }).__reactFiber = to;
    const queue: DispatchQueue = [];
    const nativeEvent = new Event("mouseout") as Event & { relatedTarget: EventTarget };
    Object.defineProperty(nativeEvent, "relatedTarget", { value: toNode });

    extractEnterLeaveEvents(queue, "mouseout", from, nativeEvent, fromNode, 0, fromNode);
    expect(queue).toHaveLength(2);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["leave", "enter"]);
  });
});

describe("BeforeInputEventPlugin", () => {
  it("keypress 提取 beforeinput data", () => {
    registerBeforeInputEvents();
    const calls: string[] = [];
    const target = new EventTarget();
    const fiber = new FiberNode(HostComponent, { onBeforeInput: (event: { data?: string | null }) => calls.push(event.data ?? "") }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = target;
    const queue: DispatchQueue = [];

    extractBeforeInputEvents(
      queue,
      "keypress",
      fiber,
      { type: "keypress", which: 65, charCode: 65 } as Event & { which: number; charCode: number },
      target,
      0,
      target,
    );

    expect(queue).toHaveLength(1);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["A"]);
  });

  it("compositionend 提取 composition 和 beforeinput", () => {
    registerBeforeInputEvents();
    const calls: string[] = [];
    const target = new EventTarget();
    const fiber = new FiberNode(HostComponent, {
      onCompositionEnd: (event: { data?: string | null }) => calls.push(`composition:${event.data}`),
      onBeforeInput: (event: { data?: string | null }) => calls.push(`before:${event.data}`),
    }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = target;
    const queue: DispatchQueue = [];

    extractBeforeInputEvents(
      queue,
      "compositionend",
      fiber,
      { type: "compositionend", data: "中" } as Event & { data: string },
      target,
      0,
      target,
    );

    expect(queue).toHaveLength(2);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["composition:中", "before:中"]);
  });
});

describe("SelectEventPlugin", () => {
  it("selectionchange 在 selection 变化时触发 onSelect", () => {
    registerSelectEvents();
    const calls: string[] = [];
    const input = Object.assign(new EventTarget(), {
      nodeName: "INPUT",
      type: "text",
      selectionStart: 0,
      selectionEnd: 0,
    });
    const fiber = new FiberNode(HostComponent, { onSelect: () => calls.push("select") }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = input;

    extractSelectEvents([], "focusin", fiber, new Event("focusin"), input, 0, input);
    input.selectionEnd = 1;
    const queue: DispatchQueue = [];
    extractSelectEvents(queue, "selectionchange", fiber, new Event("selectionchange"), input, 0, input);

    expect(queue).toHaveLength(1);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["select"]);
  });
});

describe("ScrollEndEventPlugin", () => {
  it("native scrollend 提取 onScrollEnd", () => {
    registerScrollEndEvents();
    const calls: string[] = [];
    const target = new EventTarget();
    const fiber = new FiberNode(HostComponent, { onScrollEnd: () => calls.push("end") }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = target;
    const queue: DispatchQueue = [];

    extractScrollEndEvents(queue, "scrollend", fiber, new Event("scrollend"), target, 0, target);
    expect(queue).toHaveLength(1);
    processDispatchQueue(queue, 0);
    expect(calls).toEqual(["end"]);
  });

  it("scroll capture 阶段会挂上 scrollend 防抖 timer", () => {
    registerScrollEndEvents();
    const target = new EventTarget();
    const fiber = new FiberNode(HostComponent, { onScrollEnd: () => undefined }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = target;
    const queue: DispatchQueue = [];

    extractScrollEndEvents(queue, "scroll", fiber, new Event("scroll"), target, IS_CAPTURE_PHASE, target);
    expect(getScrollEndTimer(target)).not.toBeNull();
  });
});

describe("FormActionEventPlugin", () => {
  it("submit 时执行函数 action 并记录 pending form status", () => {
    const calls: string[] = [];
    const form = Object.assign(new EventTarget(), {
      method: "post",
    }) as EventTarget & HTMLFormElement;
    const action = () => calls.push("action");
    updateFiberProps(form, { action });
    const fiber = new FiberNode(HostComponent, {}, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = form;
    const queue: DispatchQueue = [];
    const nativeEvent = new Event("submit", { cancelable: true });

    extractFormActionEvents(queue, "submit", fiber, nativeEvent, form, 0, form);
    expect(queue).toHaveLength(1);
    processDispatchQueue(queue, 0);

    expect(calls).toEqual(["action"]);
    expect(nativeEvent.defaultPrevented).toBe(true);
    expect(getPendingFormStatus(fiber)?.pending).toBe(true);
  });

  it("dispatchReplayedFormAction 复用 form action 提交流程", () => {
    const calls: string[] = [];
    const form = Object.assign(new EventTarget(), {
      method: "get",
    }) as EventTarget & HTMLFormElement;
    const fiber = new FiberNode(HostComponent, {}, null);
    const formData = new FormData();
    const action = () => calls.push("replayed");

    dispatchReplayedFormAction(fiber, form, action, formData);

    expect(calls).toEqual(["replayed"]);
    expect(getPendingFormStatus(fiber)?.data).toBe(formData);
  });
});

describe("ReactDOMComponentTree / ReactDOMEventReplaying", () => {
  it("保存 DOM node 到 Fiber 和 props 的映射", () => {
    const node = new EventTarget() as EventTarget & Node;
    const fiber = new FiberNode(HostComponent, {}, null);
    const props = { id: "a" };

    precacheFiberNode(fiber, node);
    updateFiberProps(node, props);

    expect(getFiberCurrentPropsFromNode(node)).toBe(props);
  });

  it("continuous event 可以排队、重放并清理", () => {
    const target = new EventTarget();
    const event = { type: "mouseover" } as Event;

    expect(isDiscreteEventThatRequiresHydration("click")).toBe(true);
    expect(queueIfContinuousEvent(target, "mouseover", 0, target, event)).toBe(true);
    expect(hasQueuedContinuousEvents()).toBe(true);

    const replayed: string[] = [];
    replayUnblockedEvents((queued) => {
      replayed.push(queued.domEventName);
      expect(isReplayingEvent(queued.nativeEvent)).toBe(true);
    });

    expect(replayed).toEqual(["mouseover"]);
    expect(hasQueuedContinuousEvents()).toBe(false);
  });

  it("clearIfContinuousEvent 清理 pointer queue", () => {
    const target = new EventTarget();
    const event = { type: "pointerover", pointerId: 7 } as Event & { pointerId: number };

    queueIfContinuousEvent(target, "pointerover", 0, target, event);
    expect(hasQueuedContinuousEvents()).toBe(true);
    clearIfContinuousEvent("pointerover", event);
    expect(hasQueuedContinuousEvents()).toBe(false);
  });
});

describe("SimpleEventPlugin", () => {
  it("extractEvents 提取 bubble listener 并由 processDispatchQueue 执行", () => {
    registerEvents();
    const calls: string[] = [];
    const target = new EventTarget();
    const fiber = new FiberNode(HostComponent, { onClick: () => calls.push("target") }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = target;
    const dispatchQueue: DispatchQueue = [];
    const nativeEvent = new Event("click", { bubbles: true });

    extractEvents(dispatchQueue, "click", fiber, nativeEvent, target, 0, target);
    expect(dispatchQueue).toHaveLength(1);

    processDispatchQueue(dispatchQueue, 0);
    expect(calls).toEqual(["target"]);
    expect(dispatchQueue[0].event.type).toBe("click");
  });

  it("capture 阶段按父到子顺序执行", () => {
    registerEvents();
    const calls: string[] = [];
    const parent = new FiberNode(HostComponent, { onClickCapture: () => calls.push("parent") }, null);
    const child = new FiberNode(HostComponent, { onClickCapture: () => calls.push("child") }, null);
    parent.memoizedProps = parent.pendingProps;
    child.memoizedProps = child.pendingProps;
    parent.stateNode = new EventTarget();
    child.stateNode = new EventTarget();
    child.return = parent;
    const dispatchQueue: DispatchQueue = [];
    const nativeEvent = new Event("click", { bubbles: true });

    extractEvents(dispatchQueue, "click", child, nativeEvent, child.stateNode as EventTarget, IS_CAPTURE_PHASE, parent.stateNode as EventTarget);
    processDispatchQueue(dispatchQueue, IS_CAPTURE_PHASE);

    expect(calls).toEqual(["parent", "child"]);
  });

  it("忽略右键 click 和 charCode 为 0 的 keypress", () => {
    registerEvents();
    const fiber = new FiberNode(HostComponent, { onClick: () => undefined, onKeyPress: () => undefined }, null);
    fiber.memoizedProps = fiber.pendingProps;
    fiber.stateNode = new EventTarget();

    const rightClickQueue: DispatchQueue = [];
    extractEvents(
      rightClickQueue,
      "click",
      fiber,
      { type: "click", button: 2 } as Event & { button: number },
      fiber.stateNode as EventTarget,
      0,
      fiber.stateNode as EventTarget,
    );
    expect(rightClickQueue).toHaveLength(0);

    const keyPressQueue: DispatchQueue = [];
    extractEvents(
      keyPressQueue,
      "keypress",
      fiber,
      { type: "keypress", charCode: 0, keyCode: 0 } as KeyboardEvent,
      fiber.stateNode as EventTarget,
      0,
      fiber.stateNode as EventTarget,
    );
    expect(keyPressQueue).toHaveLength(0);
  });
});
