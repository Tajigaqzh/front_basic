import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: /^shared\/(.+)\.js$/, replacement: fromRoot("./packages/shared/$1.ts") },
      { find: /^scheduler\/(.+)\.js$/, replacement: fromRoot("./packages/scheduler/src/$1.ts") },
      { find: /^react\/(.+)\.js$/, replacement: fromRoot("./packages/react/$1.ts") },
      { find: /^react-reconciler\/(.+)\.js$/, replacement: fromRoot("./packages/react-reconciler/$1.ts") },
      { find: /^react-dom-bindings\/(.+)\.js$/, replacement: fromRoot("./packages/react-dom-bindings/$1.ts") },
      { find: /^shared$/, replacement: fromRoot("./packages/shared/index.ts") },
      { find: /^shared\/(.+)$/, replacement: fromRoot("./packages/shared/$1") },
      { find: /^react$/, replacement: fromRoot("./packages/react/src/index.ts") },
      { find: /^react\/(.+)$/, replacement: fromRoot("./packages/react/$1") },
      {
        find: /^react-reconciler$/,
        replacement: fromRoot("./packages/react-reconciler/src/ReactFiberReconciler.ts"),
      },
      { find: /^react-reconciler\/(.+)$/, replacement: fromRoot("./packages/react-reconciler/$1") },
      { find: /^scheduler$/, replacement: fromRoot("./packages/scheduler/src/index.ts") },
      { find: /^scheduler\/(.+)$/, replacement: fromRoot("./packages/scheduler/src/$1") },
      { find: /^react-dom-bindings\/(.+)$/, replacement: fromRoot("./packages/react-dom-bindings/$1") },
    ],
  },
  root,
});
