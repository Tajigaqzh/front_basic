import { describe, expect, it, vi } from "vitest";

import {
    customRef,
    effect,
    isReactive,
    proxyRefs,
    ref,
    shallowRef,
    toRef,
    toRefs,
    triggerRef,
} from "../src";

describe("ref", () => {
    it("tracks and triggers basic ref updates", () => {
        const count = ref(1);
        let dummy = 0;

        effect(() => {
            dummy = count.value;
        });

        expect(dummy).toBe(1);

        count.value = 2;
        expect(dummy).toBe(2);
    });

    it("converts object values to reactive for deep refs", () => {
        const state = ref({ count: 1 });

        expect(isReactive(state.value)).toBe(true);
    });

    it("does not trigger shallowRef nested mutations until triggerRef", () => {
        const state = shallowRef({ count: 1 });
        let dummy = 0;

        effect(() => {
            dummy = state.value.count;
        });

        expect(dummy).toBe(1);

        state.value.count = 2;
        expect(dummy).toBe(1);

        triggerRef(state);
        expect(dummy).toBe(2);
    });
});

describe("toRef / toRefs", () => {
    it("keeps property ref in sync with source object", () => {
        const state = { count: 1 };
        const count = toRef(state, "count");

        expect(count.value).toBe(1);

        count.value = 2;
        expect(state.count).toBe(2);

        state.count = 3;
        expect(count.value).toBe(3);
    });

    it("supports default values for missing properties", () => {
        const state: { count?: number } = {};
        const count = toRef(state, "count", 10);

        expect(count.value).toBe(10);

        count.value = 2;
        expect(state.count).toBe(2);
    });

    it("creates refs for each property with toRefs", () => {
        const state = { foo: 1, bar: 2 };
        const refs = toRefs(state);

        refs.foo.value = 10;
        expect(state.foo).toBe(10);

        state.bar = 20;
        expect(refs.bar.value).toBe(20);
    });
});

describe("proxyRefs", () => {
    it("unwraps refs on get and writes back to existing refs on set", () => {
        const user = proxyRefs({
            age: ref(18),
            name: "Evan",
        });

        expect(user.age).toBe(18);
        expect(user.name).toBe("Evan");

        user.age = 20;
        expect(user.age).toBe(20);
    });
});

describe("customRef", () => {
    it("allows manual control over tracking and triggering", () => {
        let value = 0;
        let trigger!: () => void;

        const manual = customRef<number>((track, notify) => {
            trigger = notify;
            return {
                get() {
                    track();
                    return value;
                },
                set(newValue) {
                    value = newValue;
                },
            };
        });

        let dummy = 0;
        effect(() => {
            dummy = manual.value;
        });

        expect(dummy).toBe(0);

        manual.value = 2;
        expect(dummy).toBe(0);

        trigger();
        expect(dummy).toBe(2);
    });

    it("supports delayed triggering patterns", async () => {
        vi.useFakeTimers();

        let value = "";
        const debounced = customRef<string>((track, trigger) => ({
            get() {
                track();
                return value;
            },
            set(newValue) {
                value = newValue;
                setTimeout(() => trigger(), 50);
            },
        }));

        let dummy = "";
        effect(() => {
            dummy = debounced.value;
        });

        debounced.value = "hello";
        expect(dummy).toBe("");

        await vi.advanceTimersByTimeAsync(50);
        expect(dummy).toBe("hello");

        vi.useRealTimers();
    });
});
