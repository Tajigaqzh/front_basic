# 同一个 `component + slot` 模板在 compiler-dom 和 compiler-ssr 下的并排对照

这一篇继续做“同模板并排对照”，但这次聚焦在：

- 组件
- 默认插槽
- `<slot/>` outlet
- slot props

因为这正是客户端编译和 SSR 编译最容易开始明显分叉的地方。

---

## 1. 例子模板

我们用一对父子模板来对照。

### 父组件模板

```vue
<Child>
  <template #default="{ row }">
    <span>{{ row.name }}</span>
  </template>
</Child>
```

### 子组件模板

```vue
<slot :row="item" />
```

这个例子刚好覆盖：

- 组件 vnode
- slots 对象
- 作用域插槽参数
- `<slot/>` outlet
- DOM 和 SSR 在 slot 消费上的不同输出目标

---

## 2. 先给一句话结论

这组模板在两边的核心差异可以压成一句话：

### compiler-dom

```ts
父组件：
  生成 vnode + slots 对象

子组件：
  生成 renderSlot($slots, name, props)
```

### compiler-ssr

```ts
父组件：
  生成 ssrRenderComponent(..., slots)

子组件：
  生成 _ssrRenderSlot(_ctx.$slots, name, props, fallback, _push, _parent)
```

所以：

> DOM 版本还是围绕 vnode/slot 函数调用展开，SSR 版本则围绕字符串输出 helper 展开

---

## 3. Parse 后：两边仍然先得到相似的模板 AST

关键解析文件仍然是：

- [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
- [parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)

### 3.1 父组件 parse 后

```ts
Root
└─ Element(tag="Child", tagType=COMPONENT)
   └─ Element(tag="template", tagType=TEMPLATE)
      ├─ Directive(name="slot", arg="default", exp="{ row }")
      └─ Element(tag="span")
         └─ Interpolation("row.name")
```

### 3.2 子组件 parse 后

```ts
Root
└─ Element(tag="slot", tagType=SLOT)
   └─ Directive(name="bind", arg="row", exp="item")
```

这一阶段 DOM 和 SSR 仍然没有本质区别，因为大家都还在处理“模板语法树”。

---

## 4. 父组件：第一轮 transform 时两边都先要把插槽定义整理出来

关键文件：

- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
- [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)

### 4.1 DOM 这一边

`buildSlots()` 会把：

```vue
<template #default="{ row }">
  <span>{{ row.name }}</span>
</template>
```

整理成：

```ts
{
  default: ({ row }) => [
    VNodeCall("span", ...)
  ]
}
```

然后整个组件节点会得到：

```ts
VNodeCall(
  tag: resolveComponent("Child"),
  props: undefined,
  children: {
    default: ({ row }) => [spanVNode]
  }
)
```

### 4.2 SSR 这一边

SSR 在第一轮里也要先分析 slots，但它不能直接完成最终 SSR slot 函数。

关键点在：

- [ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)

文件里用了一个 `wipMap` 去保存：

```ts
WIP slot functions
```

原因是：

> slot 的作用域分析必须在第一轮就完成，但 slot children 的 SSR 输出逻辑要等第二轮再定

所以 SSR 这边第一轮得到的不是最终 slot 函数，而是：

```ts
先记录一个“半成品 slot 函数”
```

---

## 5. DOM 父组件最终关心什么

对 `compiler-dom` 来说，父组件最终关心的是：

```ts
createBlock(Child, null, {
  default: withCtx(({ row }) => [
    createElementVNode("span", null, toDisplayString(row.name), TEXT)
  ]),
  _: 1
})
```

这说明 DOM 侧的核心还是：

```ts
组件 vnode + slots 对象
```

slot 本质仍然是“一个返回 vnode 的函数”。

---

## 6. SSR 父组件最终关心什么

对 `compiler-ssr` 来说，父组件最终不会生成普通组件 vnode 调用，而会偏向：

```ts
_ssrRenderComponent(
  Child,
  props,
  slots,
  _parent
)
```

关键文件：

- [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)

如果是静态组件名，会生成：

```ts
SSR_RENDER_COMPONENT
```

如果是动态组件，还可能走：

```ts
SSR_RENDER_VNODE
```

这和 DOM 最大的差异是：

- DOM：组件先落成 vnode
- SSR：组件直接落成 server-renderer helper 调用

---

## 7. 子组件 `<slot/>`：DOM 侧怎么编译

关键文件：

- [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)

子组件模板：

```vue
<slot :row="item" />
```

DOM 下会变成：

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

如果有 fallback：

```vue
<slot :row="item">
  <span>fallback</span>
</slot>
```

则会变成：

```ts
renderSlot(_ctx.$slots, "default", { row: item }, () => [fallbackVNode])
```

所以 DOM 侧 `<slot/>` 的本质是：

```ts
调用一个“返回 vnode”的 slot 函数
```

---

## 8. 子组件 `<slot/>`：SSR 侧怎么编译

关键文件：

- [compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)

同样这段模板：

```vue
<slot :row="item" />
```

SSR 下不会生成 `renderSlot(...)`，而是生成：

```ts
_ssrRenderSlot(
  _ctx.$slots,
  "default",
  { row: item },
  null,
  _push,
  _parent
)
```

如果有 fallback 内容，会把 fallback 编译成一个 SSR 函数塞到第 4 个参数里。

所以 SSR 侧 `<slot/>` 的本质变成：

```ts
调用一个“往 _push 里写字符串”的 slot 渲染逻辑
```

---

## 9. 最关键的对照：slot 函数返回什么

这是这篇最重要的一点。

### DOM slot function

父组件提供的 slot 函数本质是：

```ts
({ row }) => [VNode, VNode, ...]
```

返回值是：

```ts
vnode children
```

### SSR slot function

父组件提供的 slot 函数在 SSR 下会被整理成两套分支：

1. SSR 优化分支
2. vnode fallback 分支

在 [ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts) 里，你会看到它最终生成的 slot 函数参数长这样：

```ts
(_props, _push, _parent, _scopeId) => { ... }
```

也就是说 SSR slot 函数的真正职责是：

```ts
接收 slot props
接收 _push
把内容直接输出成 HTML
```

所以两边最本质的区别是：

- DOM slot function 返回 vnode
- SSR slot function 写出 HTML

---

## 10. 父子两边如何真正对接

为了把关系彻底说清楚，我们把两边直接拼起来看。

### DOM

父组件生成：

```ts
$slots = {
  default: ({ row }) => [spanVNode]
}
```

子组件生成：

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

可以近似理解成：

```ts
_ctx.$slots.default({ row: item })
```

### SSR

父组件生成：

```ts
$slots = {
  default: (_props, _push, _parent, _scopeId) => {
    _push(`<span>...</span>`)
  }
}
```

子组件生成：

```ts
_ssrRenderSlot(_ctx.$slots, "default", { row: item }, ..., _push, _parent)
```

可以近似理解成：

```ts
_ctx.$slots.default({ row: item }, _push, _parent, _scopeId)
```

所以两边 slot 的“调用协议”已经完全不同了。

---

## 11. 为什么 SSR 组件 slots 需要两套分支

这是 `ssrTransformComponent.ts` 里最容易看不懂的一块。

文件里会先构造一份：

```ts
vnodeBranches
```

然后又构造一份：

```ts
SSR slot function body
```

原因是：

> 某些情况下 slot 仍然可能需要 fallback 到 vnode 分支，而不只是纯 SSR 字符串输出

所以 SSR slot 函数不是简单“一把梭”，而是：

- 如果有 `_push`，走 SSR 分支
- 否则走 vnode fallback 分支

这就是为什么你会看到它构造：

```ts
if (_push) {
  // ssr branch
} else {
  // vnode branch
}
```

---

## 12. 并排对照表

下面把这个例子压成最核心的对照表。

### 12.1 父组件：组件 children

`compiler-dom`

```ts
children = {
  default: ({ row }) => [spanVNode]
}
```

`compiler-ssr`

```ts
children = {
  default: (_props, _push, _parent, _scopeId) => {
    _push("<span>...</span>")
  }
}
```

### 12.2 子组件：slot outlet

`compiler-dom`

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

`compiler-ssr`

```ts
_ssrRenderSlot(_ctx.$slots, "default", { row: item }, null, _push, _parent)
```

### 12.3 组件渲染入口

`compiler-dom`

```ts
createBlock(Child, props, slots)
```

`compiler-ssr`

```ts
_ssrRenderComponent(Child, props, slots, _parent)
```

### 12.4 slot 的输出目标

`compiler-dom`

```ts
vnode tree
```

`compiler-ssr`

```ts
html string push logic
```

---

## 13. 一句话记忆法

如果只记一句话，记这个：

> 对 DOM 来说，slot 是“返回 vnode 的函数”；对 SSR 来说，slot 是“往 `_push` 写 HTML 的函数”。

这句话基本就把整篇的核心差异概括完了。

---

## 14. 推荐配合阅读顺序

建议和这些文档配合看：

- 总览：
  - [compiler-core-overview.md](../compiler-core/compiler-core-overview.md)

- slot 基础关系：
  - [slot-outlet-and-slots-relation.md](../compiler-core/slot-outlet-and-slots-relation.md)

- 平台层扩展：
  - [compiler-dom-on-top-of-compiler-core.md](../compiler-dom/compiler-dom-on-top-of-compiler-core.md)
  - [compiler-ssr-on-top-of-compiler-core.md](../compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)

- 另一个 DOM vs SSR 对照：
  - [dom-vs-ssr-side-by-side.md](./dom-vs-ssr-side-by-side.md)

---

## 15. 推荐源码跳转顺序

如果你想直接顺源码看，建议按这个顺序：

1. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
2. [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)
3. [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)
4. [compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)
5. [compiler-ssr/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/runtimeHelpers.ts)

---

如果你要，我下一篇可以继续写：

1. `compiler-dom` 和 `compiler-ssr` 的扩展点结构对照表
2. 一份整个 Vue 模板编译体系的总索引文档，把这些文档串成目录
