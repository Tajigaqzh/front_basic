# index.ts 核心步骤

## 这份文件在做什么

`index.ts` 是浏览器运行时入口，它负责把 `nodeOps` 和 `patchProp` 组合成一套 renderer，并暴露 `render`、`hydrate`、`createApp`。

## 关键步骤

1. 组合 `rendererOptions`
2. 惰性创建 renderer
3. 包装 `createApp`
4. 挂载前规范化容器
5. 注入浏览器环境相关检查
