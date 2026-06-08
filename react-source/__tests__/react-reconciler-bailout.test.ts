import { describe, expect, it } from "vitest";
import * as React from "../packages/react/src/index.js";
import { createRoot } from "../packages/react-dom/src/client/ReactDOMRoot.js";
import { createPortal } from "../packages/react-dom/src/shared/ReactDOM.js";
import { cache as cacheImpl } from "../packages/react/src/ReactCacheImpl.js";

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

function walk(node: FakeNode, visit: (node: FakeNode) => void): void {
  visit(node);
  for (const child of node.childNodes) {
    walk(child, visit);
  }
}

function collectText(node: FakeNode): string {
  let text = "";
  walk(node, (item) => {
    if (item instanceof FakeText) {
      text += item.nodeValue;
    }
  });
  return text;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("reconciler bailout/context propagation", () => {
  it("父组件 bailout 时仍会把 Provider 变更传播给 useContext consumer", async () => {
    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    const previousElement = (globalThis as typeof globalThis & { Element?: unknown }).Element;
    const previousText = (globalThis as typeof globalThis & { Text?: unknown }).Text;
    const previousDocument = (globalThis as typeof globalThis & { document?: unknown }).document;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;
    (globalThis as typeof globalThis & { Element?: unknown }).Element = FakeElement;
    (globalThis as typeof globalThis & { Text?: unknown }).Text = FakeText;
    const fakeDocument = new FakeDocument();
    (globalThis as typeof globalThis & { document?: unknown }).document = fakeDocument;

    const ThemeContext = React.createContext("light");
    let setTheme: React.Dispatch<React.StateAction<string>> | null = null;
    let shellRenders = 0;
    let consumerRenders = 0;

    function ConsumerText() {
      consumerRenders += 1;
      const theme = React.useContext(ThemeContext);
      return React.createElement("span", { className: "theme" }, theme);
    }

    function Shell() {
      shellRenders += 1;
      return React.createElement(ConsumerText, null);
    }

    const stableShellElement = React.createElement(Shell, { marker: "stable" });

    function App() {
      const [theme, updateTheme] = React.useState("light");
      setTheme = updateTheme;
      return React.createElement(ThemeContext.Provider, { value: theme }, stableShellElement);
    }

    const rootElement = new FakeElement("root");
    rootElement.ownerDocument = fakeDocument;

    try {
      createRoot(rootElement as unknown as Element).render(React.createElement(App, null));
      await flushMicrotasks();

      expect(shellRenders).toBe(1);
      expect(consumerRenders).toBe(1);
      expect(collectText(rootElement)).toBe("light");

      setTheme?.("dark");
      await flushMicrotasks();

      expect(shellRenders).toBe(1);
      expect(consumerRenders).toBe(2);
      expect(collectText(rootElement)).toBe("dark");
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
      (globalThis as typeof globalThis & { Element?: unknown }).Element = previousElement;
      (globalThis as typeof globalThis & { Text?: unknown }).Text = previousText;
      (globalThis as typeof globalThis & { document?: unknown }).document = previousDocument;
    }
  });

  it("ForwardRef/Memo/LazyComponent 接入 beginWork 主流程", async () => {
    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    const previousElement = (globalThis as typeof globalThis & { Element?: unknown }).Element;
    const previousText = (globalThis as typeof globalThis & { Text?: unknown }).Text;
    const previousDocument = (globalThis as typeof globalThis & { document?: unknown }).document;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;
    (globalThis as typeof globalThis & { Element?: unknown }).Element = FakeElement;
    (globalThis as typeof globalThis & { Text?: unknown }).Text = FakeText;
    const fakeDocument = new FakeDocument();
    (globalThis as typeof globalThis & { document?: unknown }).document = fakeDocument;

    let setTick: React.Dispatch<React.SetStateAction<number>> | null = null;
    let memoRenders = 0;
    let lazyRenders = 0;
    let forwardedPropsHadRef = true;
    let forwardedRef: unknown = null;

    const Forwarded = React.forwardRef((props, ref) => {
      forwardedPropsHadRef = Object.prototype.hasOwnProperty.call(props, "ref");
      forwardedRef = ref;
      return React.createElement("span", { className: "forward" }, String(props.label));
    });

    const Memoed = React.memo((props: { label: string }) => {
      memoRenders += 1;
      return React.createElement("span", { className: "memo" }, props.label);
    });

    function LazyInner() {
      lazyRenders += 1;
      return React.createElement("span", { className: "lazy" }, "lazy");
    }

    const LazyResolved = React.lazy(async () => ({ default: LazyInner }));
    (LazyResolved as unknown as { _payload: { status: string; result: unknown } })._payload.status =
      "resolved";
    (LazyResolved as unknown as { _payload: { status: string; result: unknown } })._payload.result =
      LazyInner;

    function App() {
      const [tick, updateTick] = React.useState(0);
      setTick = updateTick;
      return React.createElement(
        "main",
        null,
        React.createElement(Forwarded, { ref: "forward-ref", label: "forward" }),
        React.createElement(Memoed, { label: "memo" }),
        React.createElement(LazyResolved, null),
        React.createElement("span", { className: "tick" }, String(tick)),
      );
    }

    const rootElement = new FakeElement("root");
    rootElement.ownerDocument = fakeDocument;

    try {
      createRoot(rootElement as unknown as Element).render(React.createElement(App, null));
      await flushMicrotasks();

      expect(collectText(rootElement)).toBe("forwardmemolazy0");
      expect(forwardedPropsHadRef).toBe(false);
      expect(forwardedRef).toBe("forward-ref");
      expect(memoRenders).toBe(1);
      expect(lazyRenders).toBe(1);

      setTick?.((value) => value + 1);
      await flushMicrotasks();

      expect(collectText(rootElement)).toBe("forwardmemolazy1");
      expect(memoRenders).toBe(1);
      expect(lazyRenders).toBe(2);
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
      (globalThis as typeof globalThis & { Element?: unknown }).Element = previousElement;
      (globalThis as typeof globalThis & { Text?: unknown }).Text = previousText;
      (globalThis as typeof globalThis & { document?: unknown }).document = previousDocument;
    }
  });

  it("扩展 Hooks API 接入 dispatcher 和 commit effect 主路径", async () => {
    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    const previousElement = (globalThis as typeof globalThis & { Element?: unknown }).Element;
    const previousText = (globalThis as typeof globalThis & { Text?: unknown }).Text;
    const previousDocument = (globalThis as typeof globalThis & { document?: unknown }).document;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;
    (globalThis as typeof globalThis & { Element?: unknown }).Element = FakeElement;
    (globalThis as typeof globalThis & { Text?: unknown }).Text = FakeText;
    const fakeDocument = new FakeDocument();
    (globalThis as typeof globalThis & { document?: unknown }).document = fakeDocument;

    const log: string[] = [];
    const imperativeRef: { current: { label: string } | null } = { current: null };
    let setValue: React.Dispatch<React.SetStateAction<string>> | null = null;
    let startTransition: ((callback: () => void) => void) | null = null;
    let firstId = "";

    function HookProbe() {
      const [value, updateValue] = React.useState("a");
      setValue = updateValue;
      const deferred = React.useDeferredValue(value, "initial");
      const [isPending, start] = React.useTransition();
      startTransition = start;
      const id = React.useId();
      if (firstId === "") {
        firstId = id;
      }

      React.useInsertionEffect(() => {
        log.push(`insertion:${value}`);
        return () => log.push(`insertion-clean:${value}`);
      }, [value]);

      React.useLayoutEffect(() => {
        log.push(`layout:${value}`);
        return () => log.push(`layout-clean:${value}`);
      }, [value]);

      React.useImperativeHandle(imperativeRef, () => ({ label: value }), [value]);

      return React.createElement("span", null, `${id}/${deferred}/${isPending ? "pending" : "ready"}`);
    }

    const rootElement = new FakeElement("root");
    rootElement.ownerDocument = fakeDocument;

    try {
      createRoot(rootElement as unknown as Element).render(React.createElement(HookProbe, null));
      await flushMicrotasks();

      expect(collectText(rootElement)).toBe(`${firstId}/initial/ready`);
      expect(imperativeRef.current).toEqual({ label: "a" });
      expect(log).toEqual(["insertion:a", "layout:a"]);

      startTransition?.(() => setValue?.("b"));
      await flushMicrotasks();

      expect(collectText(rootElement)).toBe(`${firstId}/b/ready`);
      expect(imperativeRef.current).toEqual({ label: "b" });
      expect(log).toContain("insertion:b");
      expect(log).toContain("layout:b");
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
      (globalThis as typeof globalThis & { Element?: unknown }).Element = previousElement;
      (globalThis as typeof globalThis & { Text?: unknown }).Text = previousText;
      (globalThis as typeof globalThis & { document?: unknown }).document = previousDocument;
    }
  });

  it("HostPortal/Profiler/Mode/CacheComponent 接入 render 和 commit 主路径", async () => {
    const previousNode = (globalThis as typeof globalThis & { Node?: unknown }).Node;
    const previousElement = (globalThis as typeof globalThis & { Element?: unknown }).Element;
    const previousText = (globalThis as typeof globalThis & { Text?: unknown }).Text;
    const previousDocument = (globalThis as typeof globalThis & { document?: unknown }).document;
    (globalThis as typeof globalThis & { Node?: unknown }).Node = FakeNode;
    (globalThis as typeof globalThis & { Element?: unknown }).Element = FakeElement;
    (globalThis as typeof globalThis & { Text?: unknown }).Text = FakeText;
    const fakeDocument = new FakeDocument();
    (globalThis as typeof globalThis & { document?: unknown }).document = fakeDocument;

    let cacheCalls = 0;
    const cachedValue = cacheImpl((key: string) => {
      cacheCalls += 1;
      return `${key}:${cacheCalls}`;
    });

    function CacheProbe() {
      const first = cachedValue("item");
      const second = cachedValue("item");
      return React.createElement("span", { className: "cache" }, `${first}/${second}`);
    }

    const rootElement = new FakeElement("root");
    rootElement.ownerDocument = fakeDocument;
    const portalContainer = new FakeElement("portal-root");
    portalContainer.ownerDocument = fakeDocument;

    function App() {
      return React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          React.Profiler,
          { id: "profile", onRender: () => undefined },
          React.createElement(
            React.unstable_Cache,
            null,
            React.createElement("span", null, "root"),
            React.createElement(CacheProbe, null),
            createPortal(React.createElement("span", null, "portal"), portalContainer as unknown as Element),
          ),
        ),
      );
    }

    try {
      createRoot(rootElement as unknown as Element).render(React.createElement(App, null));
      await flushMicrotasks();

      expect(collectText(rootElement)).toBe("rootitem:1/item:1");
      expect(collectText(portalContainer)).toBe("portal");
      expect(cacheCalls).toBe(1);
    } finally {
      (globalThis as typeof globalThis & { Node?: unknown }).Node = previousNode;
      (globalThis as typeof globalThis & { Element?: unknown }).Element = previousElement;
      (globalThis as typeof globalThis & { Text?: unknown }).Text = previousText;
      (globalThis as typeof globalThis & { document?: unknown }).document = previousDocument;
    }
  });
});
