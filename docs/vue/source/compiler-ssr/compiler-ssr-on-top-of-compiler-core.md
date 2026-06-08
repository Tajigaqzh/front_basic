# compiler-ssr 如何复用 compiler-core

如果说：

- `compiler-core` 负责“模板 -> 通用 render 语义”
- `compiler-dom` 负责“浏览器 DOM 平台语义扩展”

那么 `compiler-ssr` 解决的是：

> 同样一份模板，如何编译成服务端字符串渲染逻辑

这一层最关键的点不是“它有没有复用 core”，而是：

> 它复用了很多，但又不能只复用一半，因为 SSR 的最终代码生成目标和客户端完全不同

---

## 1. 先看一句话结论

`compiler-ssr` 的整体策略可以压成两段：

```ts
第 1 段：
先复用 compiler-dom/compiler-core，
把模板变成结构正确、作用域正确、指令语义正确的 AST

第 2 段：
再额外跑一轮 SSR 专用 transform，
把客户端风格的 codegenNode 改造成 SSR 专用 JS AST
```

所以它不是：

```ts
完全重写 compiler-core
```

也不是：

```ts
直接拿 compiler-dom 的客户端 codegen 结果复用
```

而是：

```ts
前半段复用，后半段改道
```

---

## 2. 最核心的入口文件

先看：

- [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)

这里最重要的结构是：

```ts
const ast = baseParse(...)

transform(ast, {
  ...,
  nodeTransforms: [...SSR 专用 transforms],
  directiveTransforms: {...SSR 专用 directive transforms}
})

ssrCodegenTransform(ast, options)

return generate(ast, options)
```

这段代码直接暴露了 `compiler-ssr` 的三段式结构：

1. parse
2. 第一轮 transform
3. 第二轮 SSR codegen transform
4. generate

注意这里最关键的一点：

> `generate()` 仍然来自 `compiler-core`

也就是说，SSR 并没有重写最终字符串拼接器，而是：

> 通过改造 `ast.codegenNode`，让 core 的 `generate()` 去输出另一种 AST

---

## 3. 为什么 SSR 不能直接复用客户端 codegenNode

这个问题必须先想明白。

客户端 render 的目标大致是：

```ts
createVNode(...)
createElementBlock(...)
renderList(...)
```

也就是说，客户端 codegen 最终输出的是：

```ts
VNode 调用树
```

但 SSR 的目标不是 vnode 树，而是：

```ts
_push("<div>")
_push(escape(...))
_push("</div>")
```

也就是说，SSR codegen 更接近：

```ts
字符串片段 + 条件语句 + 循环语句 + _push 调用
```

所以：

- 模板语义解析可以复用
- 很多 transform 逻辑可以复用
- 但最终 codegen AST 必须改成另一种形态

这就是 `ssrCodegenTransform()` 存在的根本原因。

---

## 4. 第一步：SSR 仍然复用 parser

关键文件：

- [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)

你会看到：

```ts
baseParse(source, options)
```

而这些 `options` 又包含：

```ts
...parserOptions
```

这里的 `parserOptions` 来自 `compiler-dom`，也就是说：

> SSR 模板解析阶段仍然沿用 DOM 平台的 HTML 解析规则

这很合理，因为：

- SSR 处理的模板语法本质上还是 HTML 模板
- `svg/mathml/void tag/textarea/pre` 这些解析规则并不会因为 SSR 就消失

所以 parse 阶段关系是：

```ts
compiler-ssr
  -> 复用 compiler-dom 的 parserOptions
  -> 调用 compiler-core 的 baseParse
```

---

## 5. 第二步：第一轮 transform 复用大量 core/dom 逻辑

还是看：

- [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)

这一轮 transform 的 nodeTransforms 顺序非常重要：

```ts
[
  transformVBindShorthand,
  ssrTransformIf,
  ssrTransformFor,
  trackVForSlotScopes,
  transformExpression,
  ssrTransformSlotOutlet,
  ssrInjectFallthroughAttrs,
  ssrInjectCssVars,
  ssrTransformElement,
  ssrTransformComponent,
  trackSlotScopes,
  transformStyle,
]
```

你会发现这里有三类东西混在一起：

### 5.1 直接复用的通用 transform

例如：

- `transformVBindShorthand`
- `transformExpression`
- `trackSlotScopes`
- `trackVForSlotScopes`
- `transformStyle`

这些说明：

> 很多“模板语义”和“作用域语义”根本不分客户端还是 SSR

### 5.2 SSR 专用结构 transform

例如：

- `ssrTransformIf`
- `ssrTransformFor`
- `ssrTransformSlotOutlet`
- `ssrTransformElement`
- `ssrTransformComponent`

这些说明：

> 节点结构虽然类似，但 codegen 目标不同，所以 transform 实现要换成 SSR 版本

### 5.3 SSR 注入型 transform

例如：

- `ssrInjectFallthroughAttrs`
- `ssrInjectCssVars`

这些是纯 SSR 额外需求，客户端没有完全对等的逻辑。

---

## 6. 第三步：directiveTransforms 也会切到 SSR 版本

同样在：

- [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)

可以看到：

```ts
directiveTransforms: {
  bind: transformBind,
  on: transformOn,
  model: ssrTransformModel,
  show: ssrTransformShow,
  cloak: noopDirectiveTransform,
  once: noopDirectiveTransform,
  memo: noopDirectiveTransform,
}
```

这里也能看出 SSR 的策略：

### 6.1 仍可直接复用的

- `bind`
- `on`

说明：

这些指令在第一轮里仍然可以先被翻成通用 props 语义。

### 6.2 需要 SSR 特化的

- `model`
- `show`

原因是：

- 客户端 `v-model` 更偏事件/双向绑定
- SSR 的 `v-model` 更偏最终 HTML 属性输出

例如：

- `checked`
- `selected`
- `value`

这些都需要 SSR 侧特化处理。

### 6.3 SSR 下直接忽略的

- `cloak`
- `once`
- `memo`

这些要么不影响最终字符串输出，要么客户端优化意义更强，在 SSR 首轮里可以跳过。

---

## 7. 第四步：SSR 第一轮 transform 到底产出了什么

这一点很关键。

第一轮 SSR transform 跑完后，AST 已经具备：

- 正确的结构型节点
  - `IfNode`
  - `ForNode`
- 正确的表达式作用域
  - `_ctx.xxx`
  - slot / v-for 局部变量
- 正确的元素/组件/slot outlet 分类
- 正确的 props / 指令语义

但这时候：

> 它还不是最终 SSR JS AST

也就是说，这一步更像是：

```ts
先把模板语义整理正确
```

而不是：

```ts
已经可以直接输出 _push 代码
```

---

## 8. 第五步：第二轮 `ssrCodegenTransform`

关键文件：

- [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)

这是 SSR 和客户端最大的分水岭。

文件里自己就写得很清楚：

> SSR codegen output is completely different from client-side output

### 8.1 它做的事情

`ssrCodegenTransform(ast, options)` 会：

1. 创建 SSR 专用 transform context
2. 按 SSR 逻辑重新遍历模板 AST
3. 构造新的 SSR JS AST
4. 最终把：

```ts
ast.codegenNode
```

替换成：

```ts
BlockStatement(context.body)
```

所以这一步本质上是：

> 用 SSR 专用 AST，覆盖客户端风格的 codegenNode

### 8.2 为什么还能继续用 `generate()`

因为 `compiler-core` 的 `generate()` 本身支持多种 JS AST 节点：

- `BlockStatement`
- `IfStatement`
- `TemplateLiteral`
- `CallExpression`
- `SequenceExpression`

SSR 不需要重写整个 `generate()`，只要先把 `root.codegenNode` 改造成这些 SSR 节点即可。

---

## 9. SSR 专用 codegen AST 长什么样

从 [ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts) 可以看出，最终：

```ts
ast.codegenNode = createBlockStatement(context.body)
```

也就是说 SSR 最终更像：

```ts
{
  type: JS_BLOCK_STATEMENT,
  body: [
    ...一系列 _push(...)、if 语句、renderList 调用...
  ]
}
```

客户端是：

```ts
return VNodeTree
```

SSR 是：

```ts
block statement that pushes html
```

这是两边最根本的差异。

---

## 10. `ssrTransformElement` 做了什么

关键文件：

- [ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)

它处理的不是：

```ts
createElementVNode(...)
```

而是更接近：

```ts
"<div"
+ attrs
+ ">"
+ children
+ "</div>"
```

### 10.1 客户端元素 transform 关注什么

客户端 `transformElement` 关注：

- tag
- props
- children
- patchFlag
- dynamicProps
- block 语义

### 10.2 SSR 元素 transform 关注什么

SSR `ssrTransformElement` 关注：

- 开始标签字符串
- 属性如何序列化成 HTML
- `textarea` / `input` / `v-model` 等特殊 SSR 规则
- `v-html` / `v-text` 这种会覆盖 children 的场景
- children 如何变成字符串片段或 `_push` 逻辑

所以它不是“生成 vnode”，而是“生成 HTML 输出逻辑”。

---

## 11. `ssrTransformIf` 做了什么

关键文件：

- [ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)

这个文件分两部分：

### 11.1 第一轮

```ts
ssrTransformIf = createStructuralDirectiveTransform(..., processIf)
```

这里其实仍然复用了 core 的 `processIf`，也就是：

> 先把模板结构改成 `IfNode`

### 11.2 第二轮

```ts
ssrProcessIf(...)
```

这里才真正按 SSR 方式生成：

```ts
IfStatement
```

也就是说：

- 第一轮：模板结构改写
- 第二轮：SSR JS AST 生成

---

## 12. `ssrTransformFor` 做了什么

关键文件：

- [ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)

逻辑和 `ssrVIf` 很像。

### 12.1 第一轮

```ts
ssrTransformFor = createStructuralDirectiveTransform('for', processFor)
```

也就是先复用 core 的 `processFor`，把节点变成 `ForNode`。

### 12.2 第二轮

```ts
ssrProcessFor(...)
```

这里会生成：

```ts
_ssrRenderList(source, loopFn)
```

而不是客户端那种：

```ts
renderList(source, item => vnode)
```

同时它还会在必要时插入：

```html
<!--[-->
...
<!--]-->
```

作为 SSR fragment 边界。

---

## 13. slot outlet 和 component 在 SSR 下也会走专用分支

相关文件：

- [ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)
- [ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)

原因也很直接：

客户端：

- slot outlet -> `renderSlot(...)`
- component -> vnode + slots object

SSR：

- 要直接输出字符串
- 需要生成 server-renderer helper 调用

所以组件和 slot 在 SSR 里也必须有自己的第二轮 codegen 逻辑。

---

## 14. helper 还要再分成 SSR helper 和普通 helper

关键文件：

- [ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
- [compiler-ssr/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/runtimeHelpers.ts)

在 `ssrCodegenTransform()` 最后，会把 helpers 拆成两类：

```ts
ast.ssrHelpers
ast.helpers
```

原因是：

有些 helper 来自：

- `vue`

有些 helper 来自：

- `vue/server-renderer`

SSR 编译必须把它们区分开，不然 import 会错。

这也是 SSR 层必须额外参与 codegen 收尾的原因之一。

---

## 15. 一张完整关系图

可以把 `compiler-ssr` 压成下面这张图：

```ts
template
-> compiler-ssr.compile()
   -> baseParse()                       // compiler-core + compiler-dom parserOptions
   -> first transform pass              // 复用 core/dom + SSR 特化 transform
      -> IfNode / ForNode / props / slots / expressions 准备正确
   -> ssrCodegenTransform()             // 第二轮 SSR 专用 AST 改写
      -> BlockStatement / IfStatement / _push / _ssrRenderList
   -> generate()                        // 仍然复用 compiler-core
```

所以最准确的描述不是：

```ts
compiler-ssr 重写了 compiler-core
```

而是：

```ts
compiler-ssr 复用了 compiler-core 的 parse + transform 骨架，
并在 codegen 前插入了一轮 SSR 专用 AST 改写
```

---

## 16. 和 compiler-dom 的扩展方式有什么不同

你可以顺手把它和 `compiler-dom` 对比一下。

### compiler-dom

重点是：

- parserOptions 扩展
- DOM transforms
- DOM directiveTransforms
- DOM runtime helpers

它主要是在：

```ts
“模板语义 -> 客户端 vnode 语义”
```

这条路上做平台扩展。

### compiler-ssr

重点是：

- 仍然会扩展第一轮 transform
- 但最关键的是第二轮 `ssrCodegenTransform`

它真正不同的地方在于：

```ts
“客户端 vnode 形态不适合 SSR”
```

所以必须在 codegen 前把 AST 改成：

```ts
SSR 专用 JS AST
```

一句话区分：

- `compiler-dom` 主要改“平台语义”
- `compiler-ssr` 主要改“输出目标”

---

## 17. 推荐阅读顺序

如果你要顺着源码往下看，建议按这个顺序：

1. [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)
2. [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
3. [compiler-ssr/src/transforms/ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)
4. [compiler-ssr/src/transforms/ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)
5. [compiler-ssr/src/transforms/ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)
6. [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)
7. [compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)
8. [compiler-ssr/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/runtimeHelpers.ts)

如果你想先看更大的地图，再回来看这篇，建议先读：

- [compiler-core-overview.md](../compiler-core/compiler-core-overview.md)
- [compiler-dom-on-top-of-compiler-core.md](../compiler-dom/compiler-dom-on-top-of-compiler-core.md)

---

## 18. 现在可以把三层关系一起记住

到这里可以把三层关系压缩成一句话：

### compiler-core

```ts
模板通用语义
```

### compiler-dom

```ts
浏览器平台语义扩展
```

### compiler-ssr

```ts
服务端输出目标改写
```

这三层合起来，就是 Vue 模板编译体系最核心的骨架。

---

如果你要，我下一篇可以继续写：

1. `compiler-dom` 和 `compiler-ssr` 的扩展方式对照版
2. 一个模板同时在客户端编译和 SSR 编译下，各自 AST/codegen 结果的并排对照版
