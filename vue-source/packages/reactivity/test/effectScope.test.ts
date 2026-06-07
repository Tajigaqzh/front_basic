import { describe, expect, it } from "vitest";

import {
    effect,
    effectScope,
    getCurrentScope,
    onScopeDispose,
    ref,
} from "../src";

describe("effectScope", () => {
    it("collects effects created inside scope.run", () => {
        const count = ref(1);
        let dummy = 0;
        const scope = effectScope();

        scope.run(() => {
            effect(() => {
                dummy = count.value;
            });
        });

        expect(dummy).toBe(1);

        count.value = 2;
        expect(dummy).toBe(2);

        scope.stop();
        count.value = 3;
        expect(dummy).toBe(2);
    });

    it("supports nested scopes", () => {
        const count = ref(1);
        let parentDummy = 0;
        let childDummy = 0;
        const scope = effectScope();

        scope.run(() => {
            effect(() => {
                parentDummy = count.value;
            });

            const child = effectScope();
            child.run(() => {
                effect(() => {
                    childDummy = count.value;
                });
            });
        });

        count.value = 2;
        expect(parentDummy).toBe(2);
        expect(childDummy).toBe(2);

        scope.stop();
        count.value = 3;
        expect(parentDummy).toBe(2);
        expect(childDummy).toBe(2);
    });

    it("supports onScopeDispose", () => {
        const scope = effectScope();
        let disposed = false;

        scope.run(() => {
            expect(getCurrentScope()).toBe(scope);
            onScopeDispose(() => {
                disposed = true;
            });
        });

        scope.stop();
        expect(disposed).toBe(true);
    });
});
