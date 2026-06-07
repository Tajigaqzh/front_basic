# nodeOps.ts 常见面试题

## 1. 为什么 `runtime-core` 不直接写 DOM API？

因为 Vue 运行时被设计成平台无关，DOM 只是其中一个宿主环境。

## 2. `insertStaticContent()` 为什么存在？

因为编译器会产出静态提升结果，运行时可以直接批量插入静态 DOM，而不是逐节点创建。
