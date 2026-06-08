export const bundles = [
  {
    label: "react/index",
    input: "dist/packages/react/src/index.js",
    packageName: "react",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react.development.cjs" },
    ],
    types: [
      ["dist/packages/react/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "react/jsx-runtime",
    input: "dist/packages/react/src/jsx-runtime.js",
    packageName: "react",
    files: [
      { format: "esm", file: "jsx-runtime.js" },
      { format: "cjs", file: "cjs/react-jsx-runtime.development.cjs" },
    ],
    types: [
      ["dist/packages/react/src/jsx-runtime.d.ts", "jsx-runtime.d.ts"],
    ],
  },
  {
    label: "react/jsx-dev-runtime",
    input: "dist/packages/react/src/jsx-dev-runtime.js",
    packageName: "react",
    files: [
      { format: "esm", file: "jsx-dev-runtime.js" },
      { format: "cjs", file: "cjs/react-jsx-dev-runtime.development.cjs" },
    ],
    types: [
      ["dist/packages/react/src/jsx-dev-runtime.d.ts", "jsx-dev-runtime.d.ts"],
    ],
  },
  {
    label: "react-dom/client",
    input: "dist/packages/react-dom/src/client/ReactDOMClient.js",
    packageName: "react-dom",
    files: [
      { format: "esm", file: "client.js" },
      { format: "cjs", file: "cjs/react-dom-client.development.cjs" },
    ],
    types: [
      ["dist/packages/react-dom/src/client/ReactDOMClient.d.ts", "client.d.ts"],
    ],
  },
  {
    label: "react-dom/index",
    input: "dist/packages/react-dom/src/shared/ReactDOM.js",
    packageName: "react-dom",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react-dom.development.cjs" },
    ],
    types: [
      ["dist/packages/react-dom/src/shared/ReactDOM.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "scheduler/index",
    input: "dist/packages/scheduler/src/index.js",
    packageName: "scheduler",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/scheduler.development.cjs" },
    ],
    types: [
      ["dist/packages/scheduler/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "react-reconciler/index",
    input: "dist/packages/react-reconciler/src/ReactFiberReconciler.js",
    packageName: "react-reconciler",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react-reconciler.development.cjs" },
    ],
    types: [
      ["dist/packages/react-reconciler/src/ReactFiberReconciler.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "react-is/index",
    input: "dist/packages/react-is/src/index.js",
    packageName: "react-is",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react-is.development.cjs" },
    ],
    types: [
      ["dist/packages/react-is/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "react-cache/index",
    input: "dist/packages/react-cache/src/index.js",
    packageName: "react-cache",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react-cache.development.cjs" },
    ],
    types: [
      ["dist/packages/react-cache/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "react-refresh/index",
    input: "dist/packages/react-refresh/src/index.js",
    packageName: "react-refresh",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/react-refresh.development.cjs" },
    ],
    types: [
      ["dist/packages/react-refresh/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "use-sync-external-store/index",
    input: "dist/packages/use-sync-external-store/src/index.js",
    packageName: "use-sync-external-store",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/use-sync-external-store.development.cjs" },
    ],
    types: [
      ["dist/packages/use-sync-external-store/src/index.d.ts", "index.d.ts"],
    ],
  },
  {
    label: "use-sync-external-store/with-selector",
    input: "dist/packages/use-sync-external-store/src/with-selector.js",
    packageName: "use-sync-external-store",
    files: [
      { format: "esm", file: "with-selector.js" },
      { format: "cjs", file: "cjs/use-sync-external-store-with-selector.development.cjs" },
    ],
    types: [
      ["dist/packages/use-sync-external-store/src/with-selector.d.ts", "with-selector.d.ts"],
    ],
  },
  {
    label: "use-subscription/index",
    input: "dist/packages/use-subscription/src/index.js",
    packageName: "use-subscription",
    files: [
      { format: "esm", file: "index.js" },
      { format: "cjs", file: "cjs/use-subscription.development.cjs" },
    ],
    types: [
      ["dist/packages/use-subscription/src/index.d.ts", "index.d.ts"],
    ],
  },
];
