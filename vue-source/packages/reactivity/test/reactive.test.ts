import { describe, expect, it } from "vitest";

import {
    effect,
    isProxy,
    isReactive,
    isReadonly,
    isShallow,
    markRaw,
    reactive,
    readonly,
    shallowReactive,
    shallowReadonly,
    toRaw,
} from "../src";

describe("reactive", () => {
    it("creates reactive proxies and reuses them", () => {
        const raw = { count: 1 };
        const observed = reactive(raw);
        const observed2 = reactive(raw);

        expect(observed).not.toBe(raw);
        expect(observed).toBe(observed2);
        expect(isReactive(observed)).toBe(true);
        expect(isProxy(observed)).toBe(true);
        expect(toRaw(observed)).toBe(raw);
    });

    it("makes nested objects reactive lazily", () => {
        const observed = reactive({ nested: { count: 1 } });

        expect(isReactive(observed.nested)).toBe(true);
    });

    it("tracks and triggers object property changes", () => {
        const observed = reactive({ count: 1 });
        let dummy = 0;

        effect(() => {
            dummy = observed.count;
        });

        expect(dummy).toBe(1);

        observed.count = 2;
        expect(dummy).toBe(2);
    });

    it("tracks key iteration", () => {
        const observed = reactive<{ foo?: number }>({ foo: 1 });
        let keys = "";

        effect(() => {
            keys = Object.keys(observed).join(",");
        });

        expect(keys).toBe("foo");

        observed.bar = 2 as never;
        expect(keys).toBe("foo,bar");

        delete observed.foo;
        expect(keys).toBe("bar");
    });

    it("tracks has checks", () => {
        const observed = reactive<{ foo?: number }>({ foo: 1 });
        let hasFoo = false;

        effect(() => {
            hasFoo = "foo" in observed;
        });

        expect(hasFoo).toBe(true);

        delete observed.foo;
        expect(hasFoo).toBe(false);
    });
});

describe("readonly / shallow variants", () => {
    it("creates readonly proxies", () => {
        const wrapped = readonly({ nested: { count: 1 } });

        expect(isReadonly(wrapped)).toBe(true);
        expect(isReadonly(wrapped.nested)).toBe(true);
    });

    it("creates shallowReactive proxies", () => {
        const wrapped = shallowReactive({ nested: { count: 1 } });

        expect(isReactive(wrapped)).toBe(true);
        expect(isShallow(wrapped)).toBe(true);
        expect(isReactive(wrapped.nested)).toBe(false);
    });

    it("creates shallowReadonly proxies", () => {
        const wrapped = shallowReadonly({ nested: { count: 1 } });

        expect(isReadonly(wrapped)).toBe(true);
        expect(isShallow(wrapped)).toBe(true);
        expect(isReadonly(wrapped.nested)).toBe(false);
    });
});

describe("markRaw", () => {
    it("skips proxy conversion for marked objects", () => {
        const raw = markRaw({ count: 1 });
        const observed = reactive({ raw });

        expect(observed.raw).toBe(raw);
        expect(isReactive(observed.raw)).toBe(false);
    });
});
