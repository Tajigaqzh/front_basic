# `runtime-dom` 源码主流程图

```text
createApp()
  -> ensureRenderer()
  -> createRenderer(nodeOps + patchProp)
  -> runtime-core patch()
     -> host ops from nodeOps
     -> prop dispatch from patchProp
```

## 关键调用链

1. `createApp()` / `render()` in `src/index.ts`
2. `ensureRenderer()`
3. `createRenderer(rendererOptions)` from `@vue-source/runtime-core`
4. `nodeOps`
5. `patchProp()`
6. `modules/class|style|events|props|attrs`

## 关键节点

- `index.ts`
  把 `runtime-core` 的抽象渲染器和 DOM 宿主实现拼起来。
- `nodeOps.ts`
  提供最原子的 DOM 增删改查能力。
- `patchProp.ts`
  把属性更新分发到 class/style/event/prop/attr。
- `apiCustomElement.ts`
  补浏览器端自定义元素能力。

## 面试时怎么讲

- `runtime-dom = runtime-core + DOM host config`。
- `nodeOps` 解决“怎么动节点”，`patchProp` 解决“怎么改属性”。
- 平台特有指令和组件，例如 `vShow`、`Transition`，应当放在 DOM 层，而不是 core 层。

## 面试问法

- `runtime-dom` 和 `runtime-core` 的关系是什么？
- Vue 更新一个 DOM 属性时，为什么要先走 `patchProp` 分发？
- `nodeOps` 和 `patchProp` 各自负责什么？

## 源码定位

- 入口：`src/index.ts`
- DOM 宿主操作：`src/nodeOps.ts`
- 属性分发：`src/patchProp.ts`
- 具体模块：`src/modules/class.ts`、`style.ts`、`events.ts`、`props.ts`、`attrs.ts`

## 答题模板

`runtime-dom` 可以理解成把 `runtime-core` 的抽象渲染器落到浏览器环境。`nodeOps` 提供创建、插入、删除节点这些原子操作，`patchProp` 负责根据 key 语义把更新分发到 class、style、event、prop、attr。这样 core 层就不用关心浏览器细节，只依赖一组宿主能力接口。 
