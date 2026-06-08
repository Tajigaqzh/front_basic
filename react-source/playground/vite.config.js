import { fileURLToPath, URL } from "node:url";

const fromPlayground = (path) => fileURLToPath(new URL(path, import.meta.url));

export default {
  cacheDir: "node_modules/.vite-front-react-source",
  resolve: {
    alias: [
      {
        find: /^react\/jsx-runtime$/,
        replacement: fromPlayground("./src/vendor/react-jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: fromPlayground("./src/vendor/react-jsx-dev-runtime.js"),
      },
      {
        find: /^react$/,
        replacement: fromPlayground("./src/vendor/react.js"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: fromPlayground("./src/vendor/react-dom-client.js"),
      },
      {
        find: /^react-dom$/,
        replacement: fromPlayground("./src/vendor/react-dom.js"),
      },
      {
        find: /^react-cache$/,
        replacement: fromPlayground("./src/vendor/react-cache.js"),
      },
      {
        find: /^scheduler$/,
        replacement: fromPlayground("./src/vendor/scheduler.js"),
      },
      {
        find: /^use-sync-external-store$/,
        replacement: fromPlayground("./src/vendor/use-sync-external-store.js"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["react", "react-dom", "react-cache", "scheduler", "use-sync-external-store"],
    force: true,
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  server: {
    port: 5174,
    headers: {
      "Cache-Control": "no-store",
    },
  },
};
