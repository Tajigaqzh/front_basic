# Vue Router

这里现在对应的是对 `/Users/nwyzx/Desktop/project/source/router` 整个仓库的源码复刻说明，而不是单独某个包。

## 先看

- [源码复刻说明](./README.md)
- [阅读地图](./reading-guide.md)

## 主流程文档

- [Route Config 到命中流程](./matcher-full-flow.md)
- [导航主流程](./navigation-flow.md)
- [组件 API 到 Router 内核](./component-api-flow.md)
- [History 模式对照](./history-modes.md)
- [URL 规范化与编解码](./url-normalization.md)
- [运行时边角机制](./runtime-edge-mechanisms.md)

## Matcher 专题

- [Matcher 与 History 机制](./matcher-history.md)
- [Tokenizer 与 Ranker](./matcher-tokenizer-ranker.md)

## 关键源码位置

- `vue-router-source/packages/router/src/router.ts`
- `vue-router-source/packages/router/src/matcher/*`
- `vue-router-source/packages/router/src/history/*`
- `vue-router-source/packages/router/src/navigationGuards.ts`
- `vue-router-source/packages/router/src/RouterView.ts`
- `vue-router-source/packages/router/src/RouterLink.ts`

核心实现代码根目录位于：

- `vue-router-source/packages/router`

仓库根目录级文件也已复刻，包括：

- `vue-router-source/pnpm-workspace.yaml`
- `vue-router-source/package.json`

## 导航

- 返回 [Vue 模块](../index.md)
