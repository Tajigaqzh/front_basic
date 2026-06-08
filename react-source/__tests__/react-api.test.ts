import { describe, expect, it } from "vitest";
import ReactSharedInternals from "../packages/shared/ReactSharedInternals.js";
import type { AsyncCacheDispatcher, RendererTask } from "../packages/shared/ReactSharedInternals.js";
import { act } from "../packages/react/src/ReactAct.js";
import { cache as cacheImpl, cacheSignal as cacheSignalImpl } from "../packages/react/src/ReactCacheImpl.js";
import { cache as clientCache, cacheSignal as clientCacheSignal } from "../packages/react/src/ReactCacheClient.js";
import { captureOwnerStack } from "../packages/react/src/ReactOwnerStack.js";
import { startTransition } from "../packages/react/src/ReactStartTransition.js";
import { useSyncExternalStore as builtInUseSyncExternalStore } from "../packages/use-sync-external-store/src/forks/useSyncExternalStore.forward-to-built-in.js";
import { useSyncExternalStore as shimUseSyncExternalStore } from "../packages/use-sync-external-store/src/forks/useSyncExternalStore.forward-to-shim.js";
import { isServerEnvironment } from "../packages/use-sync-external-store/src/forks/isServerEnvironment.native.js";
import { hasBadMapPolyfill } from "../packages/react/src/BadMapPolyfill.js";
import { c as compilerMemoCache } from "../packages/react/src/ReactCompilerRuntime.js";
import { taintObjectReference, taintUniqueValue } from "../packages/react/src/ReactTaint.js";
import * as ReactServer from "../packages/react/src/ReactServer.js";
import ReactFreshBabelPlugin from "../packages/react-refresh/src/ReactFreshBabelPlugin.js";

function createDispatcher(signal: AbortSignal | null = null): AsyncCacheDispatcher {
  const roots = new Map<() => unknown, unknown>();
  return {
    getCacheForType<T>(resourceType: () => T): T {
      if (!roots.has(resourceType)) {
        roots.set(resourceType, resourceType());
      }
      return roots.get(resourceType) as T;
    },
    cacheSignal() {
      return signal;
    },
  };
}

describe("ReactCacheImpl", () => {
  it("按函数和参数树缓存返回值", () => {
    const previousDispatcher = ReactSharedInternals.A;
    ReactSharedInternals.A = createDispatcher();
    let calls = 0;
    const objectArg = {};
    const cached = cacheImpl((object: object, id: number) => ({ object, id, calls: ++calls }));

    try {
      expect(cached(objectArg, 1)).toBe(cached(objectArg, 1));
      expect(cached({}, 1)).not.toBe(cached(objectArg, 1));
      expect(calls).toBe(2);
    } finally {
      ReactSharedInternals.A = previousDispatcher;
    }
  });

  it("缓存第一次抛出的错误", () => {
    const previousDispatcher = ReactSharedInternals.A;
    ReactSharedInternals.A = createDispatcher();
    let calls = 0;
    const error = new Error("boom");
    const cached = cacheImpl(() => {
      calls += 1;
      throw error;
    });

    try {
      expect(() => cached()).toThrow(error);
      expect(() => cached()).toThrow(error);
      expect(calls).toBe(1);
    } finally {
      ReactSharedInternals.A = previousDispatcher;
    }
  });

  it("cacheSignal 透传当前 dispatcher signal", () => {
    const previousDispatcher = ReactSharedInternals.A;
    const controller = new AbortController();
    ReactSharedInternals.A = createDispatcher(controller.signal);

    try {
      expect(cacheSignalImpl()).toBe(controller.signal);
    } finally {
      ReactSharedInternals.A = previousDispatcher;
    }
  });
});

describe("ReactCacheClient", () => {
  it("client cache 在 disableClientCache 下只返回无缓存包装函数", () => {
    let calls = 0;
    const cached = clientCache((value: number) => {
      calls += 1;
      return value * 2;
    });

    expect(cached(2)).toBe(4);
    expect(cached(2)).toBe(4);
    expect(calls).toBe(2);
    expect(clientCacheSignal()).toBe(null);
  });
});

describe("ReactAct", () => {
  it("同步 act scope 退出时 flush actQueue", () => {
    const calls: string[] = [];

    act(() => {
      ReactSharedInternals.actQueue?.push((() => {
        calls.push("task");
        return null;
      }) as RendererTask);
      return "done";
    });

    expect(calls).toEqual(["task"]);
    expect(ReactSharedInternals.actQueue).toBe(null);
  });

  it("await act(async) 后 flush 异步 scope 中的任务", async () => {
    const calls: string[] = [];

    await act(async () => {
      ReactSharedInternals.actQueue?.push((() => {
        calls.push("async-task");
        return null;
      }) as RendererTask);
      return "async-done";
    });

    expect(calls).toEqual(["async-task"]);
    expect(ReactSharedInternals.actQueue).toBe(null);
  });
});

describe("ReactOwnerStack", () => {
  it("captureOwnerStack 调用 renderer 注入的 getCurrentStack", () => {
    const previous = ReactSharedInternals.getCurrentStack;
    ReactSharedInternals.getCurrentStack = () => "\n    at Owner";

    try {
      expect(captureOwnerStack()).toBe("\n    at Owner");
    } finally {
      ReactSharedInternals.getCurrentStack = previous;
    }
  });
});

describe("ReactStartTransition", () => {
  it("设置当前 transition，调用 finish hook 后恢复旧状态", () => {
    const previousTransition = ReactSharedInternals.T;
    const previousFinish = ReactSharedInternals.S;
    const seen: unknown[] = [];
    ReactSharedInternals.S = (transition, returnValue) => {
      seen.push(transition, returnValue, ReactSharedInternals.T);
    };

    try {
      startTransition(() => {
        expect(ReactSharedInternals.T).not.toBe(null);
        return "done";
      });
      expect(seen[1]).toBe("done");
      expect(seen[0]).toBe(seen[2]);
      expect(ReactSharedInternals.T).toBe(previousTransition);
    } finally {
      ReactSharedInternals.T = previousTransition;
      ReactSharedInternals.S = previousFinish;
    }
  });

  it("thenable transition 完成后释放 async transition 计数", async () => {
    const before = ReactSharedInternals.asyncTransitions;
    startTransition(() => Promise.resolve("ok"));
    expect(ReactSharedInternals.asyncTransitions).toBe(before + 1);
    await Promise.resolve();
    expect(ReactSharedInternals.asyncTransitions).toBe(before);
  });
});

describe("use-sync-external-store forks", () => {
  it("built-in fork 转发到 react.useSyncExternalStore", () => {
    const previousDispatcher = ReactSharedInternals.H;
    ReactSharedInternals.H = {
      useSyncExternalStore: (_subscribe: () => () => void, getSnapshot: () => number) => getSnapshot(),
    } as typeof ReactSharedInternals.H;

    try {
      expect(builtInUseSyncExternalStore(() => () => undefined, () => 7)).toBe(7);
    } finally {
      ReactSharedInternals.H = previousDispatcher;
    }
  });

  it("shim fork 使用本地 shim 读取 snapshot", () => {
    expect(shimUseSyncExternalStore(() => () => undefined, () => "snapshot")).toBe("snapshot");
    expect(isServerEnvironment).toBe(false);
  });

  it("shim 在 dispatcher 环境中通过 effect 订阅 store change", () => {
    const previousDispatcher = ReactSharedInternals.H;
    let effect: (() => void | (() => void)) | null = null;
    let listener: (() => void) | null = null;
    const updates: unknown[] = [];
    let snapshot = "a";

    ReactSharedInternals.H = {
      useState: (initialState: unknown) => [initialState, (value: unknown) => updates.push(value)],
      useEffect: (create: () => void | (() => void)) => {
        effect = create;
      },
    } as typeof ReactSharedInternals.H;

    try {
      expect(
        shimUseSyncExternalStore(
          (onStoreChange) => {
            listener = onStoreChange;
            return () => {
              listener = null;
            };
          },
          () => snapshot,
        ),
      ).toBe("a");

      const cleanup = effect?.();
      listener?.();
      expect(updates).toHaveLength(0);
      snapshot = "b";
      listener?.();
      expect(updates).toHaveLength(1);
      cleanup?.();
      expect(listener).toBe(null);
    } finally {
      ReactSharedInternals.H = previousDispatcher;
    }
  });
});

describe("remaining react package support modules", () => {
  it("BadMapPolyfill 暴露检测结果", () => {
    expect(typeof hasBadMapPolyfill).toBe("boolean");
  });

  it("ReactCompilerRuntime.c 创建固定长度 memo cache", () => {
    expect(compilerMemoCache(3)).toEqual([null, null, null]);
  });

  it("ReactTaint 在 enableTaint 关闭时保持官方 Not implemented 行为", () => {
    expect(() => taintObjectReference("secret", {})).toThrow("Not implemented.");
    expect(() => taintUniqueValue("secret", {}, "token")).toThrow("Not implemented.");
  });

  it("ReactServer 入口导出 server 可用 API 子集", () => {
    expect(ReactServer.createElement("div", null).type).toBe("div");
    expect(ReactServer.cache((value: number) => value)(1)).toBe(1);
  });

  it("ReactFreshBabelPlugin 校验 development 环境并返回 visitor", () => {
    expect(() =>
      ReactFreshBabelPlugin({
        env: () => "production",
        types: { identifier: (name: string) => ({ name }) },
      }),
    ).toThrow("development environment");

    const plugin = ReactFreshBabelPlugin(
      {
        env: () => "production",
        types: { identifier: (name: string) => ({ name }) },
      },
      { skipEnvCheck: true },
    );
    expect(plugin.name).toBe("react-refresh");
    expect(plugin.visitor.Program.exit).toBeTypeOf("function");
  });
});
