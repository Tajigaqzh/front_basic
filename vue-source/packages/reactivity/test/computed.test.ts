import { describe, expect, it, vi } from "vitest";

import { computed, effect, ref } from "../src";

describe("computed", () => {
    it("is lazy", () => {
        const value = ref(1);
        const getter = vi.fn(() => value.value + 1);

        const plusOne = computed(getter);

        expect(getter).not.toHaveBeenCalled();

        expect(plusOne.value).toBe(2);
        expect(getter).toHaveBeenCalledTimes(1);
    });

    it("caches until dependency changes", () => {
        const value = ref(1);
        const getter = vi.fn(() => value.value + 1);
        const plusOne = computed(getter);

        expect(plusOne.value).toBe(2);
        expect(plusOne.value).toBe(2);
        expect(getter).toHaveBeenCalledTimes(1);

        value.value = 2;

        expect(getter).toHaveBeenCalledTimes(1);
        expect(plusOne.value).toBe(3);
        expect(getter).toHaveBeenCalledTimes(2);
    });

    it("triggers effects that depend on computed values", () => {
        const value = ref(1);
        const plusOne = computed(() => value.value + 1);

        let dummy = 0;
        effect(() => {
            dummy = plusOne.value;
        });

        expect(dummy).toBe(2);

        value.value = 2;
        expect(dummy).toBe(3);
    });

    it("supports writable computed", () => {
        const value = ref(1);
        const plusOne = computed({
            get: () => value.value + 1,
            set: (newValue: number) => {
                value.value = newValue - 1;
            },
        });

        expect(plusOne.value).toBe(2);

        plusOne.value = 10;
        expect(value.value).toBe(9);
        expect(plusOne.value).toBe(10);
    });

    it("works with chained computed values", () => {
        const value = ref(1);
        const plusOne = computed(() => value.value + 1);
        const plusTwo = computed(() => plusOne.value + 1);

        expect(plusTwo.value).toBe(3);

        value.value = 5;
        expect(plusTwo.value).toBe(7);
    });

    it("does not recompute if dependency value is set to the same value", () => {
        const value = ref(1);
        const getter = vi.fn(() => value.value + 1);
        const plusOne = computed(getter);

        expect(plusOne.value).toBe(2);
        expect(getter).toHaveBeenCalledTimes(1);

        value.value = 1;
        expect(plusOne.value).toBe(2);
        expect(getter).toHaveBeenCalledTimes(1);
    });
});
