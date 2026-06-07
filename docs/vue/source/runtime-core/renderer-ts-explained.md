# renderer.ts 核心步骤

如果你想顺着 renderer 更新链读，先看 [Renderer 更新链阅读地图](./renderer-update-reading-map.md)。

如果你现在主要在看 diff 这一段，建议配合下面几篇一起读：

- [Diff 算法与常见面试题](./diff-algorithm-interview.md)
- [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)
- [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)
- [元素更新源码走读](./element-update-source-walkthrough.md)
- [`move()` 源码走读](./move-source-walkthrough.md)
- [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)
- [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)

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
