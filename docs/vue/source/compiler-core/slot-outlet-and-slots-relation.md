# `<slot/>` outlet 和组件 slots 的对应关系

这一篇专门解决一个很常见、也很容易在源码里看散的问题：

> 父组件里写的 `#default` / `#foo`，和子组件模板里写的 `<slot/>` / `<slot name="foo" />`，在 `compiler-core` 里到底是怎么对应上的？

如果只看单边源码，通常会断在这里：

- 父组件这一边在 [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts) 里被编译成 `slots` 对象
- 子组件这一边在 [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts) 里被编译成 `renderSlot(...)`

这篇就是把这两边接起来看。

---

## 1. 先看最终目标

先把结论放前面：

### 父组件提供插槽内容时

模板：

```vue
<Child>
  <template #default="{ row }">
    <span>{{ row.name }}</span>
  </template>
</Child>
```

编译方向是：

```ts
Child({
  slots: {
    default: ({ row }) => [/* vnode children */]
  }
})
```

也就是：

> 父组件负责生成一个 `slots` 对象

### 子组件消费插槽内容时

模板：

```vue
<slot :row="item" />
```

编译方向是：

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

也就是：

> 子组件负责从 `$slots` 里取对应名字的 slot 函数，再传 props 调用它

所以整件事本质上就是：

```ts
父组件：提供 slots 对象
子组件：通过 renderSlot 读取并调用 slots 对象里的函数
```

---

## 2. 最小例子

先看最小配对例子：

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

这个例子刚好同时覆盖：

- 默认插槽
- 作用域插槽 props
- `<slot/>` outlet

---

## 3. 父组件这一边：slot 是怎么生成的

关键源码：

- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)

关键函数：

- `buildSlots`
- `buildClientSlotFn`

### 3.1 Parse 后的大致结构

父组件模板 parse 后大致是：

```ts
Element(tag="Child", tagType=COMPONENT)
└─ Element(tag="template", tagType=TEMPLATE)
   ├─ Directive(name="slot", arg="default", exp="{ row }")
   └─ Element(tag="span")
      └─ Interpolation("row.name")
```

这里的关键点是：

- `#default` 被规范化成 `Directive(name="slot")`
- `"{ row }"` 是 slot props 参数表达式

### 3.2 `buildSlots()` 做了什么

在 [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts) 的 `buildSlots()` 里，这段结构会被改写成：

```ts
{
  default: ({ row }) => [
    VNodeCall("span", ...)
  ]
}
```

更贴近 codegen AST 的写法：

```ts
SlotsObjectExpression({
  default: FunctionExpression(
    params: { row },
    returns: [
      VNodeCall(
        tag: "span",
        children: TextCall(Interpolation("row.name"))
      )
    ]
  )
})
```

### 3.3 这一步的本质

父组件不直接“把内容塞给子组件”，而是生成一个对象：

```ts
slots = {
  default: fn,
  foo: fn,
  bar: fn
}
```

子组件将来拿到的就是这个对象。

---

## 4. 父组件 codegen 后的大致形态

父组件这一边最终组件调用会接近：

```ts
createBlock(_component_Child, null, {
  default: _withCtx(({ row }) => [
    _createElementVNode("span", null, _toDisplayString(row.name), 1)
  ]),
  _: 1
})
```

你可以抓住两点：

1. 插槽内容被编译成函数
2. 这个函数挂在组件第三个参数的 slots 对象上

所以从父组件视角看：

```ts
Child(slotsObject)
```

---

## 5. 子组件这一边：`<slot/>` 是怎么消费的

关键源码：

- [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)

关键函数：

- `transformSlotOutlet`
- `processSlotOutlet`

### 5.1 Parse 后的大致结构

子组件模板：

```vue
<slot :row="item" />
```

parse 后大致是：

```ts
Element(tag="slot", tagType=SLOT)
└─ Directive(name="bind", arg="row", exp="item")
```

注意：

- `<slot/>` 在 parse 阶段已经不是普通元素
- 它会被识别成 `tagType=SLOT`

### 5.2 `processSlotOutlet()` 做了什么

`processSlotOutlet()` 会先拆出两部分：

1. `slotName`
2. `slotProps`

当前例子里会得到：

```ts
slotName = "default"
slotProps = { row: item }
```

如果是：

```vue
<slot name="foo" :row="item" />
```

那就是：

```ts
slotName = "foo"
slotProps = { row: item }
```

### 5.3 `transformSlotOutlet()` 做了什么

最终 `<slot/>` 会被改写成：

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

更完整一点时还可能有：

```ts
renderSlot(_ctx.$slots, "default", { row: item }, fallbackFn)
```

所以子组件侧的本质是：

```ts
从 $slots 找 default
把 { row: item } 传进去
执行这个 slot 函数
```

---

## 6. 父子两边怎么对上

这是整篇最核心的地方。

### 父组件产物

父组件生成：

```ts
$slots = {
  default: ({ row }) => [
    <span>{{ row.name }}</span>
  ]
}
```

### 子组件产物

子组件生成：

```ts
renderSlot(_ctx.$slots, "default", { row: item })
```

### 实际对应关系

运行时你可以把它直接脑补成：

```ts
_ctx.$slots.default({ row: item })
```

于是：

- 父组件定义了参数名 `row`
- 子组件提供了参数值 `item`
- 执行后父组件插槽内容内部的 `row` 就等于 `item`

也就是说：

```ts
父：default: ({ row }) => ...
子：renderSlot($slots, "default", { row: item })
```

两边是靠同名 prop 字段 `row` 对上的。

---

## 7. 换成命名插槽时怎么对应

再看一个命名插槽版本。

### 父组件

```vue
<Child>
  <template #header="{ title }">
    <h1>{{ title }}</h1>
  </template>
</Child>
```

### 子组件

```vue
<slot name="header" :title="pageTitle" />
```

### 父组件编译结果的大意

```ts
{
  header: ({ title }) => [
    h1(title)
  ]
}
```

### 子组件编译结果的大意

```ts
renderSlot(_ctx.$slots, "header", { title: pageTitle })
```

### 对应关系

本质仍然是：

```ts
_ctx.$slots.header({ title: pageTitle })
```

所以命名插槽只是把 `default` 换成了别的 key。

---

## 8. fallback 内容是怎么接进去的

如果子组件写的是：

```vue
<slot :row="item">
  <span>fallback</span>
</slot>
```

关键源码还是：

- [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)

这时会生成：

```ts
renderSlot(
  _ctx.$slots,
  "default",
  { row: item },
  () => [VNodeCall("span", ...)]
)
```

所以 fallback 的本质是：

> 如果父组件没提供对应 slot，就执行第 4 个参数这个 fallback 函数

这也解释了为什么 `renderSlot` 的参数会长成：

```ts
renderSlot(slots, name, props, fallback)
```

---

## 9. 动态插槽名怎么对应

如果子组件写：

```vue
<slot :name="current" :row="item" />
```

那么子组件这一边会变成：

```ts
renderSlot(_ctx.$slots, _ctx.current, { row: item })
```

父组件那边如果也有动态插槽定义，就会在 [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts) 中走 `createSlots(...)` 的动态分支。

所以：

- 静态插槽名 -> 普通对象属性
- 动态插槽名 -> `createSlots` + 运行时按名字查找

---

## 10. 为什么组件 slots 和 `<slot/>` 要拆成两套 transform

看起来它们都叫 slot，但语义完全不同。

### 父组件侧

文件：

- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)

职责：

```ts
“我提供哪些 slot 内容”
```

### 子组件侧

文件：

- [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)

职责：

```ts
“我从 $slots 里取哪个 slot 来渲染”
```

所以它们本来就不是一回事：

- `v-slot` 是“定义 slot”
- `<slot/>` 是“消费 slot”

---

## 11. 一眼看懂版

可以把整件事压缩成一句话：

```ts
父组件把 slot 内容编译成函数，挂到 slots 对象上；
子组件把 <slot/> 编译成 renderSlot($slots, name, props)；
运行时本质上就是调用对应的 slot 函数。
```

再压缩成最短对照：

### 父组件

```vue
<template #default="{ row }">
  <span>{{ row.name }}</span>
</template>
```

变成：

```ts
default: ({ row }) => [span(row.name)]
```

### 子组件

```vue
<slot :row="item" />
```

变成：

```ts
renderSlot($slots, "default", { row: item })
```

### 真正对应关系

```ts
$slots.default({ row: item })
```

---

## 12. 推荐配合阅读顺序

如果你要边看文档边跳源码，建议按这个顺序：

1. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
2. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
3. [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)
4. [runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/runtimeHelpers.ts)
5. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

如果想先看更大的地图，再配合这篇看，可以先读：

- [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)

如果想看具体 AST 案例，可以回看：

- [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)
- [vfor-component-slot-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vfor-component-slot-ast-flow.md)

---

如果你要，我下一篇可以继续写：

1. `compiler-dom` 是怎么在 `compiler-core` 之上扩展平台能力的
2. `v-if + v-for` 组合场景 AST 变化
