# vue playground

启动：

```bash
pnpm --dir vite-source dev:vue
```

入口是 `src/main.ts`。当前复刻版没有完整 TypeScript 编译器，所以这个入口
会先经过 `packages/vite/src/node/plugins/esbuild.ts`，可以写常见 TS 类型语法。

`App.vue` 由 `packages/plugin-vue` 中本地复刻版 `@vitejs/plugin-vue` 转换，
页面运行的 `createApp` 来自真实 `vue` runtime。

当前 playground 还包含 `node_modules/vite-source-resolve-demo`，用于测试复刻版
resolver 的 package `exports`、`imports`、`conditions` 和 `browser` 字段。
