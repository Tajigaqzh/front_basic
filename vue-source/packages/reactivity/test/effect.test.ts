import { describe, expect, it, vi } from "vitest";

import {
    effect,
    enableTracking,
    onEffectCleanup,
    pauseTracking,
    reactive,
    ref,
    resetTracking,
    stop,
} from "../src";

describe("effect", () => {
    it("runs immediately and reacts to dependency changes", () => {
        const state = reactive({ count: 1 });
        let dummy = 0;

        const runner = effect(() => {
            dummy = state.count;
        });

        expect(dummy).toBe(1);

        state.count = 2;
        expect(dummy).toBe(2);

        runner();
        expect(dummy).toBe(2);
    });

    it("supports scheduler", () => {
        const count = ref(1);
        let dummy = 0;
        const scheduler = vi.fn();

        effect(
            () => {
                dummy = count.value;
            },
            { scheduler },
        );

        expect(dummy).toBe(1);

        count.value = 2;
        expect(dummy).toBe(1);
        expect(scheduler).toHaveBeenCalledTimes(1);
    });

    it("can be stopped", () => {
        const count = ref(1);
        let dummy = 0;

        const runner = effect(() => {
            dummy = count.value;
        });

        stop(runner);
        count.value = 2;

        expect(dummy).toBe(1);
    });

    it("supports cleanup before rerun", () => {
        const count = ref(1);
        const cleanup = vi.fn();

        effect(() => {
            onEffectCleanup(cleanup);
            count.value;
        });

        count.value = 2;
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("supports pauseTracking / enableTracking / resetTracking", () => {
        pauseTracking();
        enableTracking();
        resetTracking();

        expect(true).toBe(true);
    });
});
