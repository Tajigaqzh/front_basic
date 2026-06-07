# Shared 源码说明

包名：`@vue-source/shared`

简介：

- 提供整个源码实验中可复用的通用工具函数
- 提供类型工具与基础判断逻辑
- 作为 `@vue-source/reactivity` 等包的底层依赖

## 当前内容

- [src/general.ts](./src/general.ts)
  基础工具函数集合
- [src/makeMap.ts](./src/makeMap.ts)
  `makeMap` 相关工具
- [src/typeUtils.ts](./src/typeUtils.ts)
  类型工具
- [src/index.ts](./src/index.ts)
  对外导出入口

## 和 `reactivity` 的关系

可以简单理解成：

```text
shared
  -> 提供 hasChanged / isObject / makeMap / 类型工具

reactivity
  -> 复用 shared 完成响应式实现
```

`shared` 自己不负责响应式逻辑，它只负责把底层通用能力抽出来，避免 `reactivity` 内部重复实现。
