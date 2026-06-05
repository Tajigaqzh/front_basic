import { describe, expect, test } from "vitest";

import { MyPromise } from "../index";

describe("MyPromise", () => {
    test("resolves and chains values", async () => {
        const result = await new MyPromise<number>((resolve) => {
            resolve(1);
        })
            .then((value) => value + 1)
            .then((value) => value * 10);

        expect(result).toBe(20);
    });

    test("catch handles rejection", async () => {
        const result = await new MyPromise<number>((_, reject) => {
            reject("boom");
        }).catch((reason) => `error:${String(reason)}`);

        expect(result).toBe("error:boom");
    });

    test("finally keeps fulfilled value", async () => {
        const calls: string[] = [];

        const result = await MyPromise.resolve(100)
            .finally(() => {
                calls.push("finally");
            });

        expect(result).toBe(100);
        expect(calls).toEqual(["finally"]);
    });

    test("finally keeps rejection reason", async () => {
        const calls: string[] = [];

        await expect(
            MyPromise.reject("failed").finally(() => {
                calls.push("finally");
            }),
        ).rejects.toBe("failed");

        expect(calls).toEqual(["finally"]);
    });

    test("resolve absorbs thenable", async () => {
        const result = await MyPromise.resolve({
            then(resolve: (value: number) => void) {
                resolve(123);
            },
        });

        expect(result).toBe(123);
    });

    test("all resolves in input order", async () => {
        const result = await MyPromise.all([
            MyPromise.resolve(1),
            2,
            new MyPromise<number>((resolve) => {
                setTimeout(() => resolve(3), 5);
            }),
        ] as const);

        expect(result).toEqual([1, 2, 3]);
    });

    test("race settles with first resolved promise", async () => {
        const slow = new MyPromise<number>((resolve) => {
            setTimeout(() => resolve(2), 20);
        });

        const fast = new MyPromise<number>((resolve) => {
            setTimeout(() => resolve(1), 5);
        });

        await expect(MyPromise.race([slow, fast] as const)).resolves.toBe(1);
    });

    test("allSettled returns statuses", async () => {
        const result = await MyPromise.allSettled([
            MyPromise.resolve("ok"),
            MyPromise.reject("err"),
        ] as const);

        expect(result).toEqual([
            { status: "fulfilled", value: "ok" },
            { status: "rejected", reason: "err" },
        ]);
    });

    test("any resolves when one promise fulfills", async () => {
        const result = await MyPromise.any([
            MyPromise.reject("a"),
            MyPromise.resolve("b"),
            MyPromise.reject("c"),
        ] as const);

        expect(result).toBe("b");
    });

    test("any rejects with AggregateError when all reject", async () => {
        await expect(
            MyPromise.any([
                MyPromise.reject("a"),
                MyPromise.reject("b"),
            ] as const),
        ).rejects.toBeInstanceOf(AggregateError);
    });

    test("then callback runs asynchronously", async () => {
        const order: string[] = [];

        const promise = MyPromise.resolve(1).then(() => {
            order.push("then");
        });

        order.push("sync");
        await promise;

        expect(order).toEqual(["sync", "then"]);
    });
});
