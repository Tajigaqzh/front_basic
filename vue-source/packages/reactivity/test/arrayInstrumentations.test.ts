import { describe, expect, it } from "vitest";

import { effect, reactive, ref } from "../src";

describe("arrayInstrumentations", () => {
    it("tracks array iteration methods", () => {
        const list = reactive([1, 2, 3]);
        let sum = 0;

        effect(() => {
            sum = list.reduce((acc, item) => acc + item, 0) as number;
        });

        expect(sum).toBe(6);

        list.push(4);
        expect(sum).toBe(10);
    });

    it("supports searching with raw and proxy values", () => {
        const raw = { count: 1 };
        const proxy = reactive(raw);
        const list = reactive([raw]);

        expect(list.includes(raw)).toBe(true);
        expect(list.includes(proxy as never)).toBe(true);
    });

    it("unwraps reactive values in iterators", () => {
        const list = reactive([{ count: 1 }]);
        const first = list.values().next().value as { count: number };

        expect(first.count).toBe(1);
    });

    it("does not create runaway tracking for length-changing methods", () => {
        const list = reactive<number[]>([]);
        const count = ref(0);
        let dummy = 0;

        effect(() => {
            dummy = list.length + count.value;
        });

        list.push(1);
        count.value = 1;

        expect(dummy).toBe(2);
    });
});
