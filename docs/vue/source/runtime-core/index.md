# Runtime Core

这一组文档对应 `vue-source/packages/runtime-core`。

如果你现在刚开始看这部分源码，建议不要直接跳进 `renderer.ts`。

更稳的顺序是：

1. 先看“runtime-core 到底在做什么”
2. 再看“组件是怎么活起来的”
3. 再看“VNode 是怎么组织结构的”
4. 最后看“patch 怎么比较整棵树”

否则很容易出现一种情况：

- 每个函数名都认识
- 每段代码也都能看懂一点
- 但串不起来，不知道前后因果

## 核心流程

- [runtime-core 总览与渲染主流程](./runtime-core-overview.md)
- [renderer.ts 核心步骤](./renderer-ts-explained.md)
- [component.ts 核心步骤](./component-ts-explained.md)
- [vnode.ts 核心步骤](./vnode-ts-explained.md)
- [scheduler.ts 核心步骤](./scheduler-ts-explained.md)

## 常见面试题

- [renderer.ts 常见面试题](./renderer-interview.md)
- [component.ts 常见面试题](./component-interview.md)
- [vnode.ts 常见面试题](./vnode-interview.md)
- [scheduler.ts 常见面试题](./scheduler-interview.md)
- [KeepAlive 原理与常见面试题](./keepalive-interview.md)
- [插槽原理与常见面试题](./slots-interview.md)
- [Diff 算法与常见面试题](./diff-algorithm-interview.md)
- [Teleport 原理与常见面试题](./teleport-interview.md)
- [Suspense 原理与常见面试题](./suspense-interview.md)
- [组件更新链路常见面试题](./component-update-interview.md)
- [生命周期原理与常见面试题](./lifecycle-interview.md)
- [nextTick 原理与常见面试题](./nexttick-interview.md)

## 推荐阅读顺序

1. [runtime-core 总览与渲染主流程](./runtime-core-overview.md)
2. [component.ts 核心步骤](./component-ts-explained.md)
3. [vnode.ts 核心步骤](./vnode-ts-explained.md)
4. [renderer.ts 核心步骤](./renderer-ts-explained.md)
5. [scheduler.ts 核心步骤](./scheduler-ts-explained.md)
