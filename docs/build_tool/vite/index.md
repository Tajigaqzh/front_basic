# Vite 源码复刻阅读入口

这一组文档对应仓库里的 `vite-source`：

- `vite-source/packages/vite`
- `vite-source/packages/plugin-vue`
- `vite-source/packages/plugin-react`

阅读目标不是背 API，而是看懂 Vite 为什么快、请求来了以后经过哪些函数、插件 hook 在什么时候被调用、HMR 为什么能局部更新。

## 建议阅读顺序

1. [Dev Server 主流程](./dev-server-flow.md)
2. [插件 hook 调用机制](./plugin-hooks.md)
3. [HMR 原理与回调细节](./hmr-and-hot-hooks.md)
4. [Vue / React 插件实现](./framework-plugins.md)

## 一句话理解 Vite

Vite dev server 不先把整个项目打包。浏览器请求哪个模块，Vite 就现场把哪个模块转换成浏览器能执行的 ESM，并用模块图记录依赖关系。文件变化时，Vite 通过模块图找到能接受更新的边界，再让浏览器重新 import 新模块。

```mermaid
flowchart LR
  Browser[浏览器请求模块] --> Middleware[transformMiddleware]
  Middleware --> Transform[transformRequest]
  Transform --> Hooks[插件链 resolveId/load/transform]
  Hooks --> Graph[ModuleGraph 记录依赖和 HMR 边界]
  Graph --> Browser
  FileChange[文件变化] --> HMR[handleHMRUpdate]
  HMR --> Graph
  HMR --> WS[WebSocket 推送 update/full-reload]
  WS --> Client[/@vite/client]
  Client --> Browser
```

## 关键源码位置

- Dev server 入口：`vite-source/packages/vite/src/node/server/index.ts`
- 请求转换：`vite-source/packages/vite/src/node/server/transformRequest.ts`
- 插件容器：`vite-source/packages/vite/src/node/server/pluginContainer.ts`
- 插件类型：`vite-source/packages/vite/src/node/plugin.ts`
- 模块图：`vite-source/packages/vite/src/node/server/moduleGraph.ts`
- HMR 服务端：`vite-source/packages/vite/src/node/server/hmr.ts`
- HMR 浏览器端：`vite-source/packages/vite/src/client/client.ts`
- HTML 注入：`vite-source/packages/vite/src/node/plugins/html.ts`
- Vue 插件：`vite-source/packages/plugin-vue/src/index.ts`
- React 插件：`vite-source/packages/plugin-react/src/index.ts`
