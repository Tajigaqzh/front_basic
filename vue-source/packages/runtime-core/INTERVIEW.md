# `runtime-core` 面试速记

- `runtime-core` 是平台无关运行时，核心是组件实例、VNode、调度器、渲染器。
- 渲染主链路通常是：`createVNode -> patch -> mount/update component -> effect 调度更新`。
- 组件更新不是“数据变了立即重渲染”，而是通过 scheduler 做批处理。
- `setup()` 返回对象会暴露给模板，返回函数则直接作为 render。
- `KeepAlive`、`Teleport`、`Suspense` 都是在 runtime-core 定义抽象行为，再由具体平台承接宿主操作。
- `shapeFlag` 和 `patchFlag` 分别服务运行时分类和编译期优化。
