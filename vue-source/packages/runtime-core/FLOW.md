# `runtime-core` 源码主流程图

```text
createVNode()
  -> render()
  -> patch()
     -> processElement / processComponent / processFragment
     -> mount or update
  -> component effect
     -> renderComponentRoot()
     -> patch(subTree)
```

## 关键调用链

1. `createRenderer()` in `src/renderer.ts`
2. `render()` -> `patch()`
3. `processComponent()` / `mountComponent()` / `updateComponent()`
4. `createComponentInstance()` in `src/component.ts`
5. `setupComponent()` -> `initProps()` -> `initSlots()` -> `setupStatefulComponent()`
6. `setupRenderEffect()` -> `renderComponentRoot()` -> `patch()`

## 关键节点

- `renderer.ts`
  真正的总调度中心，决定 vnode 怎么挂载、更新、移动、卸载。
- `component.ts`
  负责把组件定义变成组件实例，并安装 `setup` / `render`。
- `scheduler.ts`
  把组件更新放进队列，做异步批处理。
- `componentRenderUtils.ts`
  负责 `shouldUpdateComponent` 和组件 render 根节点处理。

## 面试时怎么讲

- `runtime-core` 是平台无关运行时，核心抽象是 `VNode + renderer + component instance`。
- 响应式系统不会直接操作 DOM，它只负责触发组件 effect，真正更新由 renderer 完成。
- 组件更新的本质是：响应式依赖变更 -> scheduler 入队 -> effect 重跑 -> 新旧 subtree patch。

## 面试问法

- Vue 组件从挂载到更新的主流程是什么？
- 响应式系统和渲染器是怎么接起来的？
- scheduler 在组件更新里解决了什么问题？

## 源码定位

- 渲染入口：`src/renderer.ts`
- 组件实例：`src/component.ts`
- 调度器：`src/scheduler.ts`
- render 根处理：`src/componentRenderUtils.ts`

## 答题模板

`runtime-core` 的主线可以理解成：先有 `VNode`，再由 `renderer.patch()` 决定是挂载还是更新组件。组件挂载时会先 `createComponentInstance()`，再 `setupComponent()`，最后通过 `setupRenderEffect()` 把组件 render 包成响应式 effect。之后数据变化不会直接改 DOM，而是先触发 effect 进入 scheduler，再由 renderer 对新旧 subtree 做 patch。 
