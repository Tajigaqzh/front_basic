# React Source Playground

这个 Vite 工程用于验证 `@front/react-source` 的 Rollup 产物是否能在浏览器中运行。

## 运行

```bash
cd /Users/nwyzx/Desktop/project/source/front_basic/react-source/playground
pnpm dev
```

默认地址：`http://127.0.0.1:5174`

`dev` 脚本带有 `--force`，并且 Vite 配置会禁用浏览器缓存，避免继续命中旧的 `react/index.js?v=...` 转换结果。

## 验证范围

- `react`：JSX runtime、`createContext`、`Children`、`startTransition`、常用 Hooks。
- `react-dom/client`：`createRoot().render()`、root 更新和卸载。
- `react-dom-bindings`：DOM 属性、文本更新、根容器事件委托和插件派发。
- `scheduler`：异步 callback 调度。
- `react-cache`：非 render 阶段 `read/preload` 限制。

Vite alias 指向 `../build/node_modules/*`，因此需要先在 `react-source` 根目录执行：

```bash
pnpm build
```
