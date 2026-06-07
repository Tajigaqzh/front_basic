# compiler-ssr 源码顺读图

这篇文档专门回答一个问题：

> 如果你已经懂了 `compiler-core` 和 `compiler-dom`，接下来怎么顺着 `compiler-ssr` 源码读，才不容易在两阶段 transform 里迷路？

这篇默认你已经看过：

- [compiler-ssr 如何复用 compiler-core](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)

---

## 1. 先记住一条总线

读 `compiler-ssr` 时，最容易混淆的是：

- 哪些逻辑还在“第一轮模板 transform”
- 哪些逻辑已经进入“第二轮 SSR codegen transform”

你应该一直抓住这条线：

```text
第 1 阶段
parse + 第一轮 transform
  -> 复用大量 compiler-dom / compiler-core 逻辑
  -> 把模板 AST 结构处理正确

第 2 阶段
ssrCodegenTransform
  -> 把 AST 改造成 SSR 专用 JS AST
  -> 最终 generate() 输出 `_push(...)`
```

只要这条线没丢，读起来就不会乱。

---

## 2. 推荐源码顺序

建议按这个顺序读：

1. [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)
2. [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
3. [compiler-ssr/src/transforms/ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)
4. [compiler-ssr/src/transforms/ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)
5. [compiler-ssr/src/transforms/ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)
6. [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)
7. [compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)
8. [compiler-ssr/src/transforms/ssrTransformTeleport.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTeleport.ts)
9. [compiler-ssr/src/transforms/ssrTransformSuspense.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSuspense.ts)
10. [compiler-ssr/src/transforms/ssrTransformTransition.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTransition.ts)
11. [compiler-ssr/src/transforms/ssrTransformTransitionGroup.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTransitionGroup.ts)
12. [compiler-ssr/src/transforms/ssrInjectCssVars.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrInjectCssVars.ts)
13. [compiler-ssr/src/transforms/ssrInjectFallthroughAttrs.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrInjectFallthroughAttrs.ts)

---

## 3. 第一站：`index.ts`

先看：

- [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)

只抓四件事：

1. 它仍然复用 `baseParse`
2. 第一轮 `transform()` 仍然大量复用 `compiler-dom`
3. 之后额外执行 `ssrCodegenTransform(ast, options)`
4. 最后仍然复用 `generate(ast, options)`

这里最重要的认识是：

> SSR 的不同，不在 parser，也不完全在 generate，而在中间多插了一轮“改写 codegen AST”的 SSR 第二阶段

---

## 4. 第二站：`ssrCodegenTransform.ts`

看：

- [ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)

这份文件是整层最重要的“分水岭”。

它回答的是：

> 为什么客户端的 vnode codegen AST，不能直接给 SSR 用？

答案很简单：

- 客户端最终生成的是 vnode 调用树
- SSR 最终生成的是 `_push(...)`、条件语句、循环语句、render helper 调用

所以这里会：

1. 创建 SSR 专用 transform context
2. 注入 `_cssVars` 这类 SSR 级局部变量
3. 把 children 处理成 statement body
4. 把 `ast.codegenNode` 改成 `BlockStatement`
5. 最后拆分普通 helpers 和 `ssrHelpers`

如果你读这份文件时能记住一句话，就记：

> `ssrCodegenTransform()` 的职责不是继续补模板语义，而是把 AST 改造成“可以直接生成服务端 render 函数”的 JS AST

---

## 5. 第三站：先看结构型指令

建议先读：

- [ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)
- [ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)

因为它们最能直观看出 SSR 第二阶段的输出风格。

### 5.1 `ssrVIf.ts`

重点看：

- 第一阶段 `ssrTransformIf`
- 第二阶段 `ssrProcessIf`

这里最终会把：

```vue
<div v-if="ok">A</div>
```

编成类似：

```ts
if (ok) {
  _push("<div>A</div>")
} else {
  _push(`<!---->`)
}
```

最关键的是：

> SSR 下分支为空时也要输出注释占位，不然 hydrate 对不上

### 5.2 `ssrVFor.ts`

最终会变成：

```ts
_ssrRenderList(source, (item, i) => {
  _push(...)
})
```

而不是客户端的 vnode `renderList(...)` 结果。

同时你要注意 fragment 注释边界：

- `<!--[-->`
- `<!--]-->`

这也是 SSR 维持结构对齐的重要手段。

---

## 6. 第四站：原生元素输出核心

然后一定要细读：

- [ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)

这是 `compiler-ssr` 里最容易长、最值得啃的一份文件。

你不要试图一次把所有分支都背下来，只抓四条主线：

### 6.1 目标不是生成 vnode，而是拼开始标签片段

这里会先构造：

```ts
const openTag = [`<div`, ...]
```

也就是说，SSR 原生元素路径从一开始就是“标签字符串拼接思路”。

### 6.2 什么时候要退回 `ssrRenderAttrs(...)`

只要出现：

- `v-bind="obj"`
- 动态 key
- 自定义指令

就很难静态确定最终属性顺序和覆盖关系，所以要退回：

```ts
ssrRenderAttrs(mergeProps(...))
```

这是这份文件最重要的第一条边界。

### 6.3 `textarea`、`input + v-model` 为什么特别麻烦

这两类元素不是简单“多几个属性”：

- `textarea` 的 `value` 实际落在 children 文本
- `input + v-model` 还要看动态 type / model props 合并

所以它们都走了专门分支。

### 6.4 `rawChildrenMap` 在干什么

像这些场景：

- `v-html`
- `v-text`
- `textarea value`

都会覆盖默认 children 生成路径。

所以第一阶段先把“最终 children 应该输出什么”记进 `rawChildrenMap`，第二阶段真正 `_push` 时再取出来。

如果你只抓住这四条线，这份文件就已经读通了一半。

---

## 7. 第五站：组件和 slot

接下来读：

- [ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)
- [ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)

### 7.1 `ssrTransformComponent.ts`

这份文件的关键不是“组件怎么渲染”，而是：

> 为什么 slot 要同时保留 SSR 分支和 vnode fallback 分支

你要抓住：

1. 第一阶段先 build slots
2. 生成 WIP slot functions
3. 还会额外构造一套 vnode branch
4. 第二阶段再把 SSR `_push` 版函数体填进去
5. 最后根据是否有 `_push` 参数决定走哪条分支

也就是说：

> slot 在 SSR 下不是只有一套输出路径

### 7.2 `ssrTransformSlotOutlet.ts`

这份要重点看：

- `_ssrRenderSlot`
- `_ssrRenderSlotInner`

以及：

- fallback slot function
- slot scopeId 透传

最关键的一点是：

> `<slot/>` 在 SSR 下不是简单把 children 展开，而是要走 server-renderer 的 slot helper，以保持作用域、fallback、Transition 特例都正确

---

## 8. 第六站：Teleport / Suspense / Transition 系列

继续看：

- [ssrTransformTeleport.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTeleport.ts)
- [ssrTransformSuspense.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSuspense.ts)
- [ssrTransformTransition.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTransition.ts)
- [ssrTransformTransitionGroup.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformTransitionGroup.ts)

### 8.1 Teleport

看点是：

- `to` 必须存在
- children 被包装成独立 render function
- 最终交给 `_ssrRenderTeleport`

### 8.2 Suspense

看点是：

- 和组件 slot 类似，也要分 phase 1 / phase 2
- 第一阶段只 build slots
- 第二阶段才填 SSR 函数体

### 8.3 Transition

看点是：

- 过滤 comment children
- `appear` 场景会包一层 `<template>`

### 8.4 TransitionGroup

看点是：

- `tag` 可能是静态，也可能是动态
- children 要按“扁平 fragment”语义输出
- 没有 `tag` 时，自身不输出包裹元素

---

## 9. 最后一站：SSR 注入型 transform

最后看：

- [ssrInjectCssVars.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrInjectCssVars.ts)
- [ssrInjectFallthroughAttrs.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrInjectFallthroughAttrs.ts)

这两份非常适合放最后读，因为它们依赖你已经看懂整条 props/children 输出链。

### 9.1 `ssrInjectCssVars.ts`

重点是：

- `_cssVars` 是 SSR render 函数局部变量
- 根级可落地元素/组件会自动补一个 `v-bind="_cssVars"`
- Suspense 要继续往 slot 内容里递归注入

也就是说：

> CSS vars 在 SSR 下不是单独开一条 props 拼接逻辑，而是借现有 `v-bind` 合并链路注进去

### 9.2 `ssrInjectFallthroughAttrs.ts`

重点是：

- `_attrs` 同样是 render 函数参数
- 单根场景会自动注入 `v-bind="_attrs"`
- `Transition / KeepAlive / v-if root chain` 这些特殊根场景要额外分流

这一份最值得学的是：

> SSR 很多“框架级注入”逻辑，都不是硬编码到每个 transform 里，而是先转成一条普通 `v-bind`，再复用统一 props 处理链

---

## 10. 读完 `compiler-ssr` 后，你脑子里应该有的图

最理想的是形成这张图：

```text
index.ts
  -> 复用 parse
  -> 第一轮 transform
  -> ssrCodegenTransform
  -> generate

ssrCodegenTransform
  -> processChildren
  -> 生成 BlockStatement
  -> helpers 拆分

结构型指令
  -> ssrVIf
  -> ssrVFor

原生元素
  -> ssrTransformElement

组件 / slot
  -> ssrTransformComponent
  -> ssrTransformSlotOutlet

特殊内置组件
  -> Teleport / Suspense / Transition / TransitionGroup

注入型能力
  -> ssrInjectCssVars
  -> ssrInjectFallthroughAttrs
```

只要你能把这张图和 `compiler-dom` 那层对照起来，SSR 这一块就真正建立起整体理解了。

---

## 11. 下一步建议

接下来最顺的阅读路径是：

1. [DOM 和 SSR 并排对照](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/dom-vs-ssr-side-by-side.md)
2. [component + slot 在 DOM 和 SSR 下的并排对照](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/component-slot-dom-vs-ssr.md)

如果你准备继续回源码，建议再回看：

1. [compiler-dom/src/transforms/vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)
2. [compiler-ssr/src/transforms/ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)

这两份正好代表客户端和服务端最典型的“平台特化复杂点”。
