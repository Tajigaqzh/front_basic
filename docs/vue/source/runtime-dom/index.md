# Runtime DOM

这一组文档对应 `vue-source/packages/runtime-dom`。

如果你看到这里总感觉“就是一些 DOM 操作包装”，那通常说明还没有建立这层的定位。

这层最重要的不是 API 数量，而是它在整个 Vue 运行时里的角色：

- `runtime-core` 已经决定了哪里该更新
- `runtime-dom` 负责把这个决定翻译成真实浏览器操作

所以读这一组文档时，建议始终带着一个问题：

`同样是“改属性”，为什么 Vue 不能直接全部 setAttribute？`

## 核心流程

- [runtime-dom 总览与 DOM 渲染流程](./runtime-dom-overview.md)
- [patchProp.ts 核心步骤](./patch-prop-explained.md)
- [nodeOps.ts 核心步骤](./node-ops-explained.md)
- [index.ts 核心步骤](./index-ts-explained.md)

## 常见面试题

- [patchProp.ts 常见面试题](./patch-prop-interview.md)
- [nodeOps.ts 常见面试题](./node-ops-interview.md)
- [index.ts 常见面试题](./index-interview.md)

## 推荐阅读顺序

1. [runtime-dom 总览与 DOM 渲染流程](./runtime-dom-overview.md)
2. [index.ts 核心步骤](./index-ts-explained.md)
3. [nodeOps.ts 核心步骤](./node-ops-explained.md)
4. [patchProp.ts 核心步骤](./patch-prop-explained.md)
