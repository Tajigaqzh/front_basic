import { describe, expect, it } from "vitest";
import ReactSharedInternals from "../packages/shared/ReactSharedInternals.js";
import { unstable_createResource } from "../packages/react-cache/src/ReactCacheOld.js";

describe("react-cache", () => {
  it("read/preload 只能在 render dispatcher 中调用", () => {
    const previousDispatcher = ReactSharedInternals.H;
    ReactSharedInternals.H = null;
    const resource = unstable_createResource(async (id: string) => id);

    try {
      expect(() => resource.preload("a")).toThrow("react-cache: read and preload may only be called");
      expect(() => resource.read("a")).toThrow("react-cache: read and preload may only be called");
    } finally {
      ReactSharedInternals.H = previousDispatcher;
    }
  });

  it("通过 dispatcher.readContext 后复用 preload 创建的 LRU entry", async () => {
    const previousDispatcher = ReactSharedInternals.H;
    let calls = 0;
    ReactSharedInternals.H = {
      readContext: () => null,
    } as typeof ReactSharedInternals.H;
    const resource = unstable_createResource(async (id: string) => {
      calls += 1;
      return `value:${id}`;
    });

    try {
      resource.preload("a");
      let thrown: unknown;
      try {
        resource.read("a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Promise);
      await thrown;
      expect(resource.read("a")).toBe("value:a");
      expect(calls).toBe(1);
    } finally {
      ReactSharedInternals.H = previousDispatcher;
    }
  });
});
