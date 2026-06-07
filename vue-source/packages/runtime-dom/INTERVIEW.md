# `runtime-dom` 面试速记

- `runtime-dom` = `runtime-core` + 浏览器宿主实现。
- `nodeOps` 解决“怎么操作 DOM”，`patchProp` 解决“怎么更新属性/事件/class/style”。
- `createApp()` 在 DOM 侧会额外挂接容器归一化、清空容器和运行时编译告警。
- `v-model`、`v-show`、过渡组件这些都是 DOM 平台增强，不应放进 `runtime-core`。
- SSR hydrate 和普通 render 共用大部分 renderer，只是在入口和 patch 细节上分流。
