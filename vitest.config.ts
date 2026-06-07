import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: [
            "promise/test/**/*.test.ts",
            "vue-source/packages/reactivity/test/**/*.test.ts",
        ],
        environment: "node",
    },
});
