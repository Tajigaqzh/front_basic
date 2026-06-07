# compiler-core 模板 AST 变化过程

本文用一个最小但足够典型的模板例子，串起 Vue `compiler-core` 的主编译链路：

```vue
<div v-if="ok" @click="inc">{{ count }}</div>
```

目标不是穷举所有字段，而是回答两个问题：

1. 这个模板在每个阶段的 AST 大致长什么样？
2. 每一步结构变化具体发生在哪个文件、哪个核心函数里？

---

## 1. 总调用链

入口在 [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) 的 `baseCompile()`：

```ts
模板字符串
-> baseParse()
-> transform()
-> generate()
-> render 函数字符串
```

对应源码主线：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)
2. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
3. [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)
4. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

---

## 2. 原始模板

```vue
<div v-if="ok" @click="inc">{{ count }}</div>
```

这个模板里同时包含了几类典型语法：

- 一个普通元素 `div`
- 一个结构型指令 `v-if`
- 一个事件指令 `@click`
- 一个插值表达式 `{{ count }}`

所以它刚好可以覆盖 `parse -> transform -> codegen` 的几条关键路径。

---

## 3. Parse 后的模板 AST

这一阶段主要发生在：

- [tokenizer.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/tokenizer.ts)
- [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
- [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)

关键函数：

- `baseParse()`
- `endOpenTag()`
- `onText()`
- `oninterpolation()` 回调
- `ondirname()` / `ondirarg()` / `onattribend()` 回调

### 3.1 tokenizer 看到的结构

`tokenizer.ts` 会把源码切成这些语义片段：

1. `<div`
2. `v-if="ok"`
3. `@click="inc"`
4. `{{ count }}`
5. `</div>`

注意，`tokenizer` 本身不创建 AST，只通过回调把这些片段交给 `parser.ts`。

### 3.2 parser 拼出的 AST

Parse 完成后，大致是下面这样：

```ts
Root
└─ Element(tag="div", tagType=ELEMENT)
   ├─ Directive(name="if", exp="ok")
   ├─ Directive(name="on", arg="click", exp="inc")
   └─ Interpolation
      └─ SimpleExpression(content="count")
```

如果换成更贴近 `ast.ts` 的伪结构，可以写成：

```ts
{
  type: ROOT,
  children: [
    {
      type: ELEMENT,
      tag: "div",
      tagType: ELEMENT,
      props: [
        { type: DIRECTIVE, name: "if", exp: "ok" },
        { type: DIRECTIVE, name: "on", arg: "click", exp: "inc" }
      ],
      children: [
        {
          type: INTERPOLATION,
          content: { type: SIMPLE_EXPRESSION, content: "count" }
        }
      ]
    }
  ]
}
```

### 3.3 这一阶段的特点

- `v-if` 还只是一个普通 `DirectiveNode`
- `@click` 也还只是一个 `DirectiveNode`
- `count` 还是模板里的原始表达式
- 还没有任何 `codegenNode`
- 也还没有 render 函数层面的 `createVNode` / `openBlock` 之类结构

也就是说，这一步得到的是“模板语法树”，不是“JS 生成树”。

---

## 4. transform 总调度

这一阶段从 [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts) 的 `transform()` 进入。

关键函数：

- `createTransformContext()`
- `traverseNode()`
- `traverseChildren()`
- `createRootCodegen()`

默认 transform 顺序定义在 [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) 的 `getBaseTransformPreset()`。

对当前这个例子，最关键的几个 transform 是：

1. `transformIf`
2. `transformExpression`
3. `transformElement`
4. `transformText`

下面按结构变化顺序看。

---

## 5. `v-if` 改写 AST 结构

这一阶段发生在：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)

关键函数：

- `transformIf`
- `processIf`
- `createIfBranch`

### 5.1 改写前

```ts
Root
└─ Element(div)
   ├─ Directive(v-if, exp="ok")
   ├─ Directive(v-on:click, exp="inc")
   └─ Interpolation("count")
```

### 5.2 改写后

`v-if` 不再留在元素 `props` 里，而是直接把节点结构改成：

```ts
Root
└─ IfNode
   └─ IfBranch(condition="ok")
      └─ Element(div)
         ├─ Directive(v-on:click, exp="inc")
         └─ Interpolation("count")
```

更贴近伪 AST：

```ts
{
  type: ROOT,
  children: [
    {
      type: IF,
      branches: [
        {
          type: IF_BRANCH,
          condition: "ok",
          children: [
            {
              type: ELEMENT,
              tag: "div",
              props: [
                { type: DIRECTIVE, name: "on", arg: "click", exp: "inc" }
              ],
              children: [
                { type: INTERPOLATION, content: "count" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 5.3 为什么要这么做

因为 `v-if` 不是一个“改 props”的指令，而是一个“改结构”的指令。

最终它会编译成：

```ts
condition ? vnodeA : vnodeB
```

所以编译器必须先把它从“元素属性”提升成“条件结构节点”。

---

## 6. 表达式改写

这一阶段发生在：

- [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)

关键函数：

- `transformExpression`
- `processExpression`

### 6.1 改写前

```ts
condition: "ok"
event exp: "inc"
interpolation exp: "count"
```

### 6.2 改写后

如果当前构建启用 `prefixIdentifiers`，表达式会被改成显式上下文访问：

```ts
condition: "_ctx.ok"
event exp: "_ctx.inc"
interpolation exp: "_ctx.count"
```

所以 AST 现在大致是：

```ts
Root
└─ IfNode
   └─ IfBranch(condition="_ctx.ok")
      └─ Element(div)
         ├─ Directive(v-on:click, exp="_ctx.inc")
         └─ Interpolation
            └─ SimpleExpression("_ctx.count")
```

### 6.3 为什么要这一步

模板里的 `ok` / `inc` / `count` 只是“用户写出来的名字”，并不等于运行时作用域里的合法访问代码。

编译器必须决定它们到底来自：

- `_ctx`
- `$props`
- `$setup`
- `ref.value`

当前这个例子里，它们最终都被看成 `_ctx.xxx`。

---

## 7. `@click` 事件指令改写

这一阶段发生在：

- [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOn.ts)
- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)

关键函数：

- `transformOn`
- `buildProps`

### 7.1 改写前

```ts
Directive(name="on", arg="click", exp="_ctx.inc")
```

### 7.2 改写后

它会被翻译成 VNode props 语义：

```ts
{
  onClick: _ctx.inc
}
```

如果用户写的是内联语句，例如：

```vue
@click="count++"
```

那就会变成：

```ts
{
  onClick: $event => (_ctx.count++)
}
```

当前这个例子因为只是一个成员表达式 `inc`，所以比较简单，直接保留成函数引用。

---

## 8. `div` 元素生成 `VNodeCall`

这一阶段发生在：

- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)

关键函数：

- `transformElement`
- `resolveComponentType`
- `buildProps`

### 8.1 改写前

`Element(div)` 还是模板节点，只是它内部表达式和指令已经处理过。

### 8.2 改写后

它会新增一个 `codegenNode`：

```ts
Element(tag="div")
├─ props: [...]
├─ children: [...]
└─ codegenNode =
   VNodeCall(
     tag: "div",
     props: {
       onClick: _ctx.inc
     },
     children: Interpolation("_ctx.count")
   )
```

更贴近伪结构：

```ts
{
  type: ELEMENT,
  tag: "div",
  codegenNode: {
    type: VNODE_CALL,
    tag: "div",
    props: {
      onClick: _ctx.inc
    },
    children: Interpolation("_ctx.count")
  }
}
```

### 8.3 这一阶段意味着什么

从这里开始，AST 已经不再只是“模板长什么样”，而是“将来 render 函数要生成什么调用结构”。

也就是：模板 AST 开始拥有 JS codegen AST。

---

## 9. 插值/文本优化

这一阶段发生在：

- [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)

关键函数：

- `transformText`

### 9.1 改写前

`div` 的子节点还是：

```ts
Interpolation("_ctx.count")
```

### 9.2 改写后

它会朝“文本 vnode”方向靠拢，并打上动态文本标记：

```ts
VNodeCall(
  tag: "div",
  props: { onClick: _ctx.inc },
  children: TextCall(Interpolation("_ctx.count")),
  patchFlag: TEXT
)
```

你也可以把它理解成更接近最终代码的形式：

```ts
createTextVNode(_toDisplayString(_ctx.count), TEXT)
```

### 9.3 为什么要这一步

因为运行时更容易优化“已经归一化好的文本 vnode”，而不是原始模板层的插值节点。

---

## 10. `IfNode` 生成自己的 `codegenNode`

这一阶段继续发生在：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)

关键函数：

- `createCodegenNodeForBranch`
- `createChildrenCodegenNode`

现在分支里的 `div` 已经有完整的 `codegenNode`，所以 `IfNode` 自己也能生成条件表达式：

```ts
IfNode
└─ codegenNode =
   ConditionalExpression(
     test: _ctx.ok,
     consequent:
       VNodeCall(
         tag: "div",
         props: { onClick: _ctx.inc },
         children: TextCall(...),
         patchFlag: TEXT,
         isBlock: true
       ),
     alternate:
       createCommentVNode("v-if", true)
   )
```

这一步很关键：

- `v-if` 最终不再是模板指令
- 它彻底变成 JS 条件表达式结构

---

## 11. Root 节点拿到最终 `codegenNode`

这一阶段发生在：

- [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)

关键函数：

- `createRootCodegen`

最终根节点大致会长成：

```ts
Root
├─ children:
│  └─ IfNode(...)
├─ helpers:
│  ├─ OPEN_BLOCK
│  ├─ CREATE_ELEMENT_BLOCK
│  ├─ CREATE_COMMENT
│  └─ TO_DISPLAY_STRING
└─ codegenNode:
   ConditionalExpression(
     test: _ctx.ok,
     consequent: ElementBlock(div ...),
     alternate: CommentVNode(...)
   )
```

这里要区分两个概念：

- `root.children`：仍然保留模板层 AST
- `root.codegenNode`：真正给 `generate()` 用的 JS 生成树

---

## 12. Codegen 前的最终形态

这是最值得记住的“最终 AST”：

```ts
Root.codegenNode =
ConditionalExpression(
  test: _ctx.ok,
  consequent:
    VNodeCall(
      tag: "div",
      props: { onClick: _ctx.inc },
      children: TextCall(Interpolation(_ctx.count)),
      patchFlag: TEXT,
      isBlock: true
    ),
  alternate:
    CallExpression(
      callee: CREATE_COMMENT,
      args: ["v-if", true]
    )
)
```

你可以把它理解成：

```ts
_ctx.ok
  ? createElementBlock("div", { onClick: _ctx.inc }, ...)
  : createCommentVNode("v-if", true)
```

---

## 13. 最终生成 render 函数

这一阶段发生在：

- [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

关键函数：

- `generate`
- `genNode`

最终输出大致类似：

```ts
function render(_ctx, _cache) {
  return _ctx.ok
    ? (_openBlock(), _createElementBlock(
        "div",
        { onClick: _ctx.inc },
        _toDisplayString(_ctx.count),
        1
      ))
    : _createCommentVNode("v-if", true)
}
```

---

## 14. 一眼看懂版

把这个例子的 AST 演化压缩成 4 步，就是：

### 第 1 步：Parse 后

```ts
Element(div, [v-if, @click], [{{ count }}])
```

### 第 2 步：`v-if` 改结构后

```ts
IfNode(
  branch(condition = ok, child = div)
)
```

### 第 3 步：表达式改写后

```ts
IfNode(
  branch(
    condition = _ctx.ok,
    child = div(@click = _ctx.inc, {{ _ctx.count }})
  )
)
```

### 第 4 步：生成 codegenNode 后

```ts
_ctx.ok
  ? createElementBlock("div", { onClick: _ctx.inc }, ...)
  : createCommentVNode(...)
```

---

## 15. 文件跳转顺序建议

如果你要拿着源码一路点进去，建议按这个顺序跳：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) 的 `baseCompile`
2. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts) 的 `baseParse`
3. [tokenizer.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/tokenizer.ts) 的 `parse`
4. [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts) 的 `processIf`
5. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts) 的 `processExpression`
6. [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOn.ts) 的 `transformOn`
7. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts) 的 `transformElement`
8. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts) 的 `transformText`
9. [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts) 的 `createRootCodegen`
10. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts) 的 `generate`

---

## 16. 相关阅读文件

为了看懂上面每一步，你会频繁回跳这几个底层文件：

- [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)
- [runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/runtimeHelpers.ts)
- [utils.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/utils.ts)
- [errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/errors.ts)

---

如果你要，我下一步可以继续补两种文档之一：

1. 再写一篇 `v-for + component + slot` 的 AST 变化过程
2. 再写一篇“从 `tokenizer -> parser -> transform -> codegen` 的完整调用链总览”
