# Vue Router 阅读地图

## 你可以怎么读

这套文档现在适合三种读法：

1. 按主流程顺着读
2. 按问题定位读
3. 对照源码跳读

## 主流程阅读顺序

如果你想从“路由是怎么跑起来的”一路读到“页面为什么会刷新”，建议按这个顺序：

1. [源码复刻说明](./README.md)
2. [Route Config 到命中流程](./matcher-full-flow.md)
3. [导航主流程](./navigation-flow.md)
4. [组件 API 到 Router 内核](./component-api-flow.md)
5. [History 模式对照](./history-modes.md)
6. [运行时边角机制](./runtime-edge-mechanisms.md)

## 按问题查

### 想搞清楚“路径为什么命中这条路由”

- [Tokenizer 与 Ranker](./matcher-tokenizer-ranker.md)
- [Route Config 到命中流程](./matcher-full-flow.md)
- 对应源码：
  - `vue-router-source/packages/router/src/matcher/pathTokenizer.ts`
  - `vue-router-source/packages/router/src/matcher/pathParserRanker.ts`
  - `vue-router-source/packages/router/src/matcher/index.ts`

### 想搞清楚“router.push 之后发生了什么”

- [导航主流程](./navigation-flow.md)
- [组件 API 到 Router 内核](./component-api-flow.md)
- 对应源码：
  - `vue-router-source/packages/router/src/router.ts`
  - `vue-router-source/packages/router/src/navigationGuards.ts`
  - `vue-router-source/packages/router/src/RouterView.ts`

### 想搞清楚“为什么 RouterLink 会高亮”

- [组件 API 到 Router 内核](./component-api-flow.md)
- 对应源码：
  - `vue-router-source/packages/router/src/RouterLink.ts`
  - `vue-router-source/packages/router/src/location.ts`

### 想搞清楚“URL / query / hash 是怎么规范化的”

- [URL 规范化与编解码](./url-normalization.md)
- 对应源码：
  - `vue-router-source/packages/router/src/location.ts`
  - `vue-router-source/packages/router/src/query.ts`
  - `vue-router-source/packages/router/src/encoding.ts`

### 想搞清楚“三种 history 有什么区别”

- [History 模式对照](./history-modes.md)
- [Matcher 与 History 机制](./matcher-history.md)
- 对应源码：
  - `vue-router-source/packages/router/src/history/common.ts`
  - `vue-router-source/packages/router/src/history/html5.ts`
  - `vue-router-source/packages/router/src/history/hash.ts`
  - `vue-router-source/packages/router/src/history/memory.ts`

### 想搞清楚“导航失败、滚动恢复、告警机制”

- [运行时边角机制](./runtime-edge-mechanisms.md)
- 对应源码：
  - `vue-router-source/packages/router/src/errors.ts`
  - `vue-router-source/packages/router/src/scrollBehavior.ts`
  - `vue-router-source/packages/router/src/warning.ts`

## 一句话索引

| 文档 | 解决的问题 |
|---|---|
| `README.md` | 这次复刻的范围、结构、版本是什么 |
| `matcher-tokenizer-ranker.md` | path 是怎么被切词和评分的 |
| `matcher-full-flow.md` | route config 怎么变成最终可命中的 matcher |
| `matcher-history.md` | matcher 和 history 在总体系里各做什么 |
| `navigation-flow.md` | 一次导航从 resolve 到 finalize 怎么流转 |
| `component-api-flow.md` | useRoute / RouterLink / RouterView 怎么接内核 |
| `history-modes.md` | Web / Hash / Memory 三种 history 有什么差别 |
| `url-normalization.md` | URL、query、hash 是怎么规范化与编码的 |
| `runtime-edge-mechanisms.md` | 失败、告警、滚动恢复怎么工作 |
