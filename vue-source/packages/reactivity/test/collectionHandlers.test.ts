import { describe, expect, it } from "vitest";

import { effect, reactive } from "../src";

describe("collectionHandlers", () => {
    it("tracks Map.get and triggers Map.set", () => {
        const map = reactive(new Map<string, number>());
        let dummy: number | undefined;

        effect(() => {
            dummy = map.get("count");
        });

        expect(dummy).toBeUndefined();

        map.set("count", 1);
        expect(dummy).toBe(1);
    });

    it("tracks Set.has and triggers add/delete", () => {
        const set = reactive(new Set<number>());
        let hasOne = false;

        effect(() => {
            hasOne = set.has(1);
        });

        expect(hasOne).toBe(false);

        set.add(1);
        expect(hasOne).toBe(true);

        set.delete(1);
        expect(hasOne).toBe(false);
    });

    it("tracks Map size", () => {
        const map = reactive(new Map<string, number>());
        let size = 0;

        effect(() => {
            size = map.size;
        });

        expect(size).toBe(0);

        map.set("count", 1);
        expect(size).toBe(1);

        map.delete("count");
        expect(size).toBe(0);
    });

    it("tracks iteration with forEach", () => {
        const map = reactive(new Map<string, number>());
        let sum = 0;

        effect(() => {
            sum = 0;
            map.forEach((value) => {
                sum += value;
            });
        });

        map.set("a", 1);
        map.set("b", 2);
        expect(sum).toBe(3);
    });
});
