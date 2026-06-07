import { describe, expect, it, vi } from "vitest";

import { reactive, ref, watch } from "../src";

describe("watch", () => {
    it("watches ref sources", () => {
        const count = ref(1);
        const spy = vi.fn();

        watch(count, spy);
        count.value = 2;

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(2, 1, expect.any(Function));
    });

    it("supports immediate option", () => {
        const count = ref(1);
        const spy = vi.fn();

        watch(count, spy, { immediate: true });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(1, undefined, expect.any(Function));
    });

    it("supports once option", () => {
        const count = ref(1);
        const spy = vi.fn();

        watch(count, spy, { once: true });

        count.value = 2;
        count.value = 3;

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(2, 1, expect.any(Function));
    });

    it("supports deep watch on reactive objects", () => {
        const state = reactive({ nested: { count: 1 } });
        const spy = vi.fn();

        watch(state, spy, { deep: true });
        state.nested.count = 2;

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("supports cleanup between runs", () => {
        const count = ref(1);
        const cleanup = vi.fn();

        watch(count, (_newValue, _oldValue, onCleanup) => {
            onCleanup(cleanup);
        });

        count.value = 2;
        expect(cleanup).not.toHaveBeenCalled();

        count.value = 3;
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("supports scheduler", () => {
        const count = ref(1);
        const spy = vi.fn();
        let queuedJob: (() => void) | undefined;

        watch(count, spy, {
            scheduler(job) {
                queuedJob = job;
            },
        });

        count.value = 2;
        expect(spy).not.toHaveBeenCalled();

        queuedJob?.();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(2, 1, expect.any(Function));
    });

    it("returns a handle that can pause and resume", () => {
        const count = ref(1);
        const spy = vi.fn();

        const handle = watch(count, spy);

        handle.pause();
        count.value = 2;
        expect(spy).not.toHaveBeenCalled();

        handle.resume();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(2, 1, expect.any(Function));
    });
});
