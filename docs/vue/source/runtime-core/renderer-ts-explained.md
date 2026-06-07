# renderer.ts 核心步骤

## 这份文件在做什么

`renderer.ts` 实现 Vue 的平台无关渲染器。它不关心浏览器 DOM 细节，只关心：

- 当前节点是什么类型
- 首次挂载还是更新
- 新旧 VNode 怎么比较
- 哪些子树需要递归 patch

## 关键步骤

1. `createRenderer()`
   接收宿主能力，产出 `render` 和 `createApp`
2. `patch()`
   整个渲染器的总入口，按 vnode 类型分流
3. `processElement()`
   处理普通元素节点
4. `processComponent()`
   处理组件节点
5. `patchElement()`
   比较元素属性和子节点
6. `patchChildren()`
   比较 children
7. `unmount()`
   卸载整棵子树

## 最重要的认知

`patch()` 不是“只更新”，而是“统一处理挂载、更新、卸载和节点切换”的调度入口。
