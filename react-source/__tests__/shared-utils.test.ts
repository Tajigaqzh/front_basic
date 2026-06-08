import { describe, expect, it } from "vitest";
import { REACT_ELEMENT_TYPE } from "shared";
import binaryToComparableString from "../packages/shared/binaryToComparableString.js";
import normalizeConsoleFormat from "../packages/shared/normalizeConsoleFormat.js";
import { getIODescription } from "../packages/shared/ReactIODescription.js";
import {
  describeObjectForErrorMessage,
  describeValueForErrorMessage,
  isGetter,
  isSimpleObject,
  jsxChildrenParents,
  jsxPropsParents,
} from "../packages/shared/ReactSerializationErrors.js";
import {
  addObjectDiffToProperties,
  addValueToProperties,
} from "../packages/shared/ReactPerformanceTrackProperties.js";
import { OMITTED_PROP_ERROR } from "../packages/shared/ReactFlightPropertyAccess.js";
import { compareDocumentPositionForEmptyFragment } from "../packages/shared/ReactDOMFragmentRefShared.js";
import { FiberNode } from "../packages/react-reconciler/src/ReactFiber.js";
import { Fragment, HostComponent } from "../packages/react-reconciler/src/ReactWorkTags.js";
import readonlyFeatureFlags from "../packages/shared/forks/ReactFeatureFlags.readonly.js";
import { eprh_enableExhaustiveEffectDependenciesCompilerLint } from "../packages/shared/forks/ReactFeatureFlags.eslint-plugin.www.js";

describe("binaryToComparableString", () => {
  it("只比较 TypedArray 当前视图覆盖的字节", () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const left = binaryToComparableString(new Uint8Array(buffer, 1, 2));
    const right = binaryToComparableString(new Uint8Array([2, 3]));

    expect(left).toBe(right);
  });
});

describe("normalizeConsoleFormat", () => {
  it("转义没有对应参数的 format specifier", () => {
    expect(normalizeConsoleFormat("value %s %s", ["a"], 0)).toBe("value %s %%s");
  });

  it("为额外参数补齐 %s/%o", () => {
    expect(normalizeConsoleFormat("value", ["text", { a: 1 }], 0)).toBe("value %s %o");
  });
});

describe("ReactIODescription", () => {
  it("从常见对象字段提取可读描述", () => {
    expect(getIODescription({ request: { url: "https://example.com/api" } })).toBe(
      "https://example.com/api",
    );
    expect(getIODescription({ id: 42 })).toBe("42");
    expect(getIODescription("abc")).toBe("");
  });
});

describe("ReactSerializationErrors", () => {
  it("识别简单对象和 getter", () => {
    const object = { visible: true };
    Object.defineProperty(object, "key", {
      enumerable: false,
      get() {
        return "k";
      },
    });

    expect(isSimpleObject(object)).toBe(true);
    expect(isGetter(object, "key")).toBe(true);
  });

  it("压缩值描述并截断长字符串", () => {
    expect(describeValueForErrorMessage("hello world from react")).toBe("\"hello worl...\"");
    expect(describeValueForErrorMessage([1, 2, 3])).toBe("[...]");
  });

  it("为普通对象输出字段并高亮 expandedName", () => {
    const message = describeObjectForErrorMessage({ id: 1, title: "ok" }, "title");
    const [objectLine, highlightLine] = message.slice(3).split("\n  ");

    expect(objectLine).toBe("{id: 1, title: \"ok\"}");
    expect(highlightLine.indexOf("^")).toBe(objectLine.indexOf("\"ok\""));
    expect(highlightLine).toContain("^^^^");
  });

  it("按 JSX props/children 父级输出 JSX 片段", () => {
    const props = { id: "root", count: 1 };
    jsxPropsParents.set(props, "div");
    expect(describeObjectForErrorMessage(props)).toBe("<div id=\"root\" count={1}>");

    const children = ["A", 2];
    jsxChildrenParents.set(children, "span");
    expect(describeObjectForErrorMessage(children)).toBe("<span>A{2}</span>");
  });
});

describe("ReactPerformanceTrackProperties", () => {
  it("把 ReactElement 和省略 prop 展开成性能属性", () => {
    const properties: Array<[string, string]> = [];
    addValueToProperties(
      "element",
      {
        $$typeof: REACT_ELEMENT_TYPE,
        type: "div",
        key: null,
        props: { id: "root" },
      },
      properties,
      0,
      "",
    );
    addValueToProperties("omitted", OMITTED_PROP_ERROR, properties, 0, "");

    expect(properties).toEqual([
      ["element", "<div … />"],
      ["omitted", "…"],
    ]);
  });

  it("递归输出对象 diff 并标记增删改", () => {
    const properties: Array<[string, string]> = [];
    const equal = addObjectDiffToProperties(
      { stable: 1, nested: { a: 1 }, removed: true },
      { stable: 1, nested: { a: 2 }, added: "new" },
      properties,
      0,
    );

    expect(equal).toBe(false);
    expect(properties).toContainEqual(["- removed", "…"]);
    expect(properties).toContainEqual(["+ added", "…"]);
    expect(properties.some(([key, value]) => key.includes("nested") && value === "")).toBe(true);
    expect(properties.some(([key, value]) => key.startsWith("-") && key.endsWith("a") && value === "1")).toBe(true);
    expect(properties.some(([key, value]) => key.startsWith("+") && key.endsWith("a") && value === "2")).toBe(true);
  });
});

describe("ReactDOMFragmentRefShared", () => {
  it("空 Fragment 通过下一个 host sibling 推断 document position", () => {
    const constants = {
      DOCUMENT_POSITION_CONTAINED_BY: 16,
      DOCUMENT_POSITION_CONTAINS: 8,
      DOCUMENT_POSITION_FOLLOWING: 4,
      DOCUMENT_POSITION_PRECEDING: 2,
      DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32,
    };
    (globalThis as typeof globalThis & { Node?: typeof constants }).Node = constants;

    const otherNode = {};
    const parentHostInstance = {
      compareDocumentPosition: () => constants.DOCUMENT_POSITION_CONTAINED_BY,
    };
    const nextSiblingInstance = {
      compareDocumentPosition: (other: unknown) => (other === otherNode ? 0 : constants.DOCUMENT_POSITION_PRECEDING),
    };
    const fragmentFiber = new FiberNode(Fragment, {}, null);
    const siblingFiber = new FiberNode(HostComponent, {}, null);
    siblingFiber.stateNode = nextSiblingInstance;
    fragmentFiber.sibling = siblingFiber;

    const result = compareDocumentPositionForEmptyFragment(
      fragmentFiber,
      parentHostInstance,
      otherNode as typeof parentHostInstance,
      (fiber) => fiber.stateNode as typeof nextSiblingInstance,
    );

    expect(result).toBe(
      constants.DOCUMENT_POSITION_FOLLOWING |
        constants.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC,
    );
  });
});

describe("ReactFeatureFlags forks", () => {
  it("readonly fork 冻结默认 feature flags", () => {
    expect(Object.isFrozen(readonlyFeatureFlags)).toBe(true);
    expect(readonlyFeatureFlags.disableLegacyMode).toBe(true);
  });

  it("eslint-plugin www fork 暴露 compiler lint 专用值", () => {
    expect(eprh_enableExhaustiveEffectDependenciesCompilerLint).toBe("extra-only");
  });
});
