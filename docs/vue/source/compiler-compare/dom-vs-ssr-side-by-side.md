# 同一个模板在 compiler-dom 和 compiler-ssr 下的并排对照

这一篇专门回答一个很实用的问题：

> 同一份模板，交给 `compiler-dom` 和 `compiler-ssr` 编译时，到底从哪一步开始分叉？最后分别会生成什么结构？

前面的文档已经分别讲过：

- [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)
- [compiler-dom-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)
- [compiler-ssr-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)

这篇不再分开讲，而是把两边放在一起对照。

---

## 1. 例子模板

我们用这个模板：

```vue
<ul v-if="ok">
  <li v-for="item in list">{{ item.name }}</li>
</ul>
```

选这个例子的原因很简单：

- 有 `v-if`
- 有 `v-for`
- 有普通元素
- 有插值

它足够覆盖：

- 结构型指令改写
- 表达式作用域
- 文本子节点
- 客户端 vnode codegen
- SSR 字符串 codegen

---

## 2. 总结先放前面

这份模板在两边的前半段其实很像：

```ts
template
-> parse
-> 模板 AST
-> 第一轮 transform
```

分叉点在这里：

### `compiler-dom`

```ts
第一轮 transform 后
-> 直接 generate()
-> 输出 createVNode / createElementBlock 风格代码
```

### `compiler-ssr`

```ts
第一轮 transform 后
-> ssrCodegenTransform()
-> generate()
-> 输出 _push / _ssrRenderList / IfStatement 风格代码
```

也就是说：

> parse 和大部分结构改写逻辑相近，真正大幅分叉的是最终 codegen AST 的形态

---

## 3. Parse 后：两边完全一样

这一阶段都来自：

- [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
- `compiler-dom` / `compiler-ssr` 都只是带不同 parserOptions 去调用 `baseParse`

Parse 后的大致模板 AST：

```ts
Root
└─ Element(tag="ul")
   ├─ Directive(name="if", exp="ok")
   └─ Element(tag="li")
      ├─ Directive(name="for", exp="item in list")
      └─ Interpolation("item.name")
```

这一步两边没有本质差异。

原因是：

- 它们处理的仍然是同一种模板语法
- 此时还没涉及“客户端 vnode”还是“SSR 输出字符串”

---

## 4. 第一轮结构改写：两边大体也一样

### 4.1 `v-if` 改结构

在两边第一轮 transform 里，`v-if` 都会先把结构改成：

```ts
Root
└─ IfNode
   └─ IfBranch(condition="ok")
      └─ Element(tag="ul")
         └─ Element(tag="li", v-for=...)
```

客户端这一步主要来自：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)

SSR 这一步主要来自：

- [ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)

但注意：

SSR 这里其实仍然复用了 core 的 `processIf`。

也就是说，这一步本质上还是“通用结构改写”。

### 4.2 `v-for` 改结构

接着 `li` 上的 `v-for` 会继续被改成：

```ts
Root
└─ IfNode
   └─ IfBranch(condition="ok")
      └─ Element(tag="ul")
         └─ ForNode
            ├─ source: "list"
            ├─ valueAlias: "item"
            └─ Element(tag="li")
               └─ Interpolation("item.name")
```

客户端这一步主要来自：

- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

SSR 这一步主要来自：

- [ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)

但同样：

SSR 第一轮这里本质上也还是复用 core 的 `processFor`。

### 4.3 表达式改写

两边都会把：

```ts
ok -> _ctx.ok
list -> _ctx.list
item.name -> item.name
```

因为：

- `ok`、`list` 属于外层上下文
- `item` 是 `v-for` 局部变量

这一步两边也基本一致。

---

## 5. 关键分叉前的“共同状态”

在真正大分叉之前，两边拿到的“模板语义 AST”其实已经很接近了：

```ts
Root
└─ IfNode(condition=_ctx.ok)
   └─ Element(ul)
      └─ ForNode(source=_ctx.list, alias=item)
         └─ Element(li)
            └─ Interpolation("item.name")
```

所以真正应该记住的是：

> `compiler-dom` 和 `compiler-ssr` 的大差异，不在 parse，也不完全在第一轮结构改写，而是在“这些结构最后要生成什么”

---

## 6. compiler-dom：第一轮 transform 后直接走客户端 codegen

客户端这一边最终关心的是：

```ts
VNode 调用树
```

所以每个节点最后都会尽量落成：

- `VNodeCall`
- `CallExpression`
- `ConditionalExpression`

### 6.1 `li` 在客户端的 codegenNode

```ts
VNodeCall(
  tag: "li",
  children: TextCall(Interpolation("item.name")),
  patchFlag: TEXT
)
```

### 6.2 `ForNode` 在客户端的 codegenNode

```ts
VNodeCall(
  tag: FRAGMENT,
  children: renderList(_ctx.list, item => liVNode),
  isBlock: true
)
```

### 6.3 `IfNode` 在客户端的 codegenNode

```ts
ConditionalExpression(
  test: _ctx.ok,
  consequent: ulVNode,
  alternate: createCommentVNode("v-if", true)
)
```

### 6.4 客户端最后输出的大致 render

```ts
function render(_ctx, _cache) {
  return _ctx.ok
    ? (_openBlock(), _createElementBlock("ul", null, [
        (_openBlock(true), _createElementBlock(_Fragment, null,
          _renderList(_ctx.list, (item) => {
            return (_openBlock(), _createElementBlock(
              "li",
              null,
              _toDisplayString(item.name),
              1
            ))
          }),
        256))
      ]))
    : _createCommentVNode("v-if", true)
}
```

客户端关键词是：

- `createElementBlock`
- `Fragment`
- `renderList`
- `toDisplayString`

也就是：

> 输出 vnode 树

---

## 7. compiler-ssr：第一轮之后还要再跑第二轮

SSR 这一边不同。

关键文件：

- [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)

SSR 第一轮 transform 完之后，不会直接拿客户端风格的 `VNodeCall` 去生成代码，而是会：

```ts
ssrCodegenTransform(ast, options)
```

这一轮会把 `root.codegenNode` 改造成 SSR 专用 JS AST。

---

## 8. compiler-ssr：最终目标不是 vnode，而是 `_push`

SSR 最终关心的是：

```ts
_push("<ul>")
_ssrRenderList(...)
_push("</ul>")
```

所以它最终 codegen AST 更接近：

- `BlockStatement`
- `IfStatement`
- `CallExpression(_push, ...)`
- `CallExpression(_ssrRenderList, ...)`

而不是：

- `VNodeCall`

这就是 SSR 真正的分叉点。

---

## 9. 同一个 `li`，两边最终关心的东西不同

### compiler-dom

`li` 最终是：

```ts
VNodeCall("li", ..., item.name)
```

### compiler-ssr

`li` 最终更像：

```ts
_push(`<li>`)
_push(_ssrInterpolate(item.name))
_push(`</li>`)
```

也就是说：

- DOM：关心“创建节点”
- SSR：关心“输出字符串”

---

## 10. 同一个 `v-for`，两边也不同

### compiler-dom

客户端 `v-for`：

```ts
renderList(_ctx.list, item => liVNode)
```

返回的是：

```ts
一组 vnode
```

### compiler-ssr

SSR `v-for`：

```ts
_ssrRenderList(_ctx.list, item => {
  _push(`<li>...</li>`)
})
```

返回/执行的是：

```ts
一组字符串输出逻辑
```

关键源码：

- [compiler-ssr/src/transforms/ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)

这里甚至还会在必要时加：

```html
<!--[-->
<!--]-->
```

作为 SSR fragment 边界。

---

## 11. 同一个 `v-if`，两边也不同

### compiler-dom

客户端 `v-if`：

```ts
test ? vnodeA : commentVNode
```

是表达式形态。

### compiler-ssr

SSR `v-if`：

```ts
if (test) {
  _push(...)
} else {
  _push(`<!---->`)
}
```

是语句形态。

关键源码：

- [compiler-ssr/src/transforms/ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)

这也是一个很典型的区别：

- DOM：更偏表达式树
- SSR：更偏语句块树

---

## 12. 并排对照表

下面是这份模板最核心的并排对照。

### 12.1 parse 后

两边一样：

```ts
Element(ul, v-if)
  -> Element(li, v-for)
     -> Interpolation(item.name)
```

### 12.2 第一轮结构改写后

两边基本一样：

```ts
IfNode(_ctx.ok)
  -> Element(ul)
     -> ForNode(_ctx.list, item)
        -> Element(li)
           -> Interpolation(item.name)
```

### 12.3 codegen 目标

`compiler-dom`：

```ts
ConditionalExpression
  -> VNodeCall(ul)
     -> renderList(...)
        -> VNodeCall(li)
```

`compiler-ssr`：

```ts
IfStatement
  -> _push("<ul>")
  -> _ssrRenderList(...)
     -> _push("<li>...</li>")
  -> _push("</ul>")
```

### 12.4 输出结果类型

`compiler-dom`：

```ts
render() => vnode tree
```

`compiler-ssr`：

```ts
ssrRender() => string push logic
```

---

## 13. 一句话记忆法

如果你只想记一句话，记这个：

> `compiler-dom` 和 `compiler-ssr` 在“模板语义理解”上相近，在“最终输出目标”上完全不同。

再压缩一点：

- DOM：生成 vnode
- SSR：生成 HTML 输出逻辑

---

## 14. 建议怎么配合前面的文档一起看

建议顺序：

1. 看总览：
   - [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)

2. 看平台扩展：
   - [compiler-dom-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)
   - [compiler-ssr-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)

3. 再回来看这篇并排对照

这样效果最好，因为你已经先知道：

- core 在做什么
- dom 扩了什么
- ssr 为什么要多一轮

然后这篇会把三者拉到同一个模板上对比。

---

## 15. 推荐源码跳转顺序

如果你要直接跳源码，建议这样看：

1. [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)
2. [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)
3. [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)
4. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)
5. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
6. [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
7. [compiler-ssr/src/transforms/ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)
8. [compiler-ssr/src/transforms/ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)
9. [compiler-ssr/src/transforms/ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)

---

如果你要，我下一篇可以继续写：

1. `compiler-dom` 和 `compiler-ssr` 扩展点的“结构对照表”
2. 同一个包含 component + slot 的模板，在 DOM 和 SSR 下的并排对照版
