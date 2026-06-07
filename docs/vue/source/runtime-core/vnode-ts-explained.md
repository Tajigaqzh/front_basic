# vnode.ts 核心步骤

## 这份文件在做什么

`vnode.ts` 定义了 Vue 的虚拟节点结构，以及创建、克隆、children 归一化逻辑。

## 关键点

- VNode 是渲染器 diff 的输入
- `shapeFlag` 用来快速判断节点大类
- children 会在创建阶段尽量归一化，减少后续 patch 成本
- 组件、元素、Fragment、Teleport、Suspense 都统一落在 VNode 抽象上
