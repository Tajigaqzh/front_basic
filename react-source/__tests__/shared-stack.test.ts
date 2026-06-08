import { describe, expect, it } from "vitest";
import type { ReactElement as OfficialReactElement } from "../packages/shared/ReactElementType.js";
import { REACT_ELEMENT_TYPE } from "shared";
import { disableLogs, reenableLogs } from "../packages/shared/ConsolePatchingDev.js";
import DefaultPrepareStackTraceV8 from "../packages/shared/DefaultPrepareStackTraceV8.js";
import {
  describeBuiltInComponentFrame,
  describeDebugInfoFrame,
  describeFunctionComponentFrame,
} from "../packages/shared/ReactComponentStackFrame.js";
import { getOwnerStackByComponentInfoInDev } from "../packages/shared/ReactComponentInfoStack.js";
import { formatOwnerStack } from "../packages/shared/ReactOwnerStackFrames.js";

function makeOwnerStack(...frames: string[]): Error {
  const error = new Error("react-stack-top-frame");
  error.stack = [
    "Error: react-stack-top-frame",
    "    at jsxDEV",
    ...frames,
    "    at react_stack_bottom_frame",
    "    at internal",
  ].join("\n");
  return error;
}

describe("shared ReactElementType", () => {
  it("保留官方 ReactElement 调试字段形态", () => {
    const element: OfficialReactElement<{ id: string }> = {
      $$typeof: REACT_ELEMENT_TYPE,
      type: "div",
      key: "k",
      ref: null,
      props: { id: "root" },
      _owner: null,
      _store: { validated: 0 },
      _debugInfo: null,
    };

    expect(element.$$typeof).toBe(REACT_ELEMENT_TYPE);
    expect(element.props.id).toBe("root");
    expect(element._store?.validated).toBe(0);
  });
});

describe("ConsolePatchingDev", () => {
  it("嵌套 disable/reenable 时只在最外层恢复 console", () => {
    const originalLog = console.log;

    try {
      disableLogs();
      const disabledLog = console.log as typeof console.log & { __reactDisabledLog?: true };
      expect(disabledLog.__reactDisabledLog).toBe(true);

      disableLogs();
      reenableLogs();
      expect(console.log).toBe(disabledLog);

      reenableLogs();
      expect(console.log).toBe(originalLog);
    } finally {
      while (console.log !== originalLog) {
        reenableLogs();
      }
    }
  });
});

describe("DefaultPrepareStackTraceV8", () => {
  it("把 V8 structured stack 格式化成默认文本栈", () => {
    const stack = DefaultPrepareStackTraceV8(new Error("boom"), [
      { toString: () => "Component (/src/App.tsx:1:2)" },
      { toString: () => "render (/src/index.tsx:3:4)" },
    ]);

    expect(stack).toBe(
      "Error: boom\n    at Component (/src/App.tsx:1:2)\n    at render (/src/index.tsx:3:4)",
    );
  });
});

describe("ReactOwnerStackFrames", () => {
  it("裁剪 JSX 顶部帧和 React 内部底部帧", () => {
    const stack = formatOwnerStack(
      makeOwnerStack("    at Parent (/src/App.tsx:10:3)", "    at Root (/src/main.tsx:4:1)"),
    );

    expect(stack).toBe("    at Parent (/src/App.tsx:10:3)\n    at Root (/src/main.tsx:4:1)");
  });

  it("没有底部哨兵时返回空字符串", () => {
    const error = new Error("react-stack-top-frame");
    error.stack = "Error: react-stack-top-frame\n    at jsxDEV\n    at Parent";

    expect(formatOwnerStack(error)).toBe("");
  });
});

describe("ReactComponentStackFrame", () => {
  it("为内置组件生成与原生 stack 对齐的帧", () => {
    const frame = describeBuiltInComponentFrame("div");

    expect(frame).toContain("div");
    expect(frame.startsWith("\n")).toBe(true);
  });

  it("优先复用 debug location 中的 owner 帧", () => {
    const frame = describeDebugInfoFrame(
      "ServerChild",
      "server",
      makeOwnerStack("    at ServerChild (/src/server.tsx:5:1)"),
    );

    expect(frame).toBe("\n    at ServerChild (/src/server.tsx:5:1)");
  });

  it("通过 sample/control stack 差分提取函数组件帧", () => {
    function StackProbe(): never {
      throw new Error("sample");
    }

    const frame = describeFunctionComponentFrame(StackProbe);

    expect(frame).toContain("StackProbe");
  });
});

describe("ReactComponentInfoStack", () => {
  it("无 owner 的组件用组件名补一帧", () => {
    expect(getOwnerStackByComponentInfoInDev({ name: "Root" })).toContain("Root");
  });

  it("沿 ReactComponentInfo.owner 链拼接 debugStack", () => {
    const info = getOwnerStackByComponentInfoInDev({
      name: "Child",
      owner: { name: "Parent" },
      debugStack: makeOwnerStack("    at Parent (/src/App.tsx:12:1)"),
    });

    expect(info).toBe("\n    at Parent (/src/App.tsx:12:1)");
  });
});
