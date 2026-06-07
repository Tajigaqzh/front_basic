# `v-if + v-for` 组合场景 AST 变化

这一篇专门看一个在 Vue 模板里非常常见、但在编译器里又特别容易让人绕晕的组合场景：

```vue
<li v-for="item in list" v-if="item.ok">
  {{ item.name }}
</li>
```

这类模板最值得搞清楚的问题不是“最后 render 代码长什么样”，而是：

1. `v-if` 和 `v-for` 到底谁先处理？
2. 它们为什么都必须改写 AST 结构，而不是只改 props？
3. 组合在一起时，中间那几步 AST 到底长什么样？

---

## 1. 先给结论

对这个例子来说，编译器里的核心变化链可以压成一句话：

```ts
Element(li, [v-if, v-for])
-> IfNode
-> IfBranch 内部再变 ForNode
-> ForNode 的每一轮返回 li vnode
```

也就是说：

> 在这个具体例子里，`v-if` 先把节点改成 `IfNode`，然后分支里的原节点再继续被 `v-for` 改成 `ForNode`

这个顺序来自默认 transform 执行顺序，而不是拍脑袋决定的。

关键源码顺序在：

- [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)

`getBaseTransformPreset()` 里这几个 transform 的顺序是：

1. `transformIf`
2. `transformMemo`
3. `transformFor`

所以：

```ts
v-if
先于
v-for
```

---

## 2. 原始模板

```vue
<li v-for="item in list" v-if="item.ok">
  {{ item.name }}
</li>
```

这个模板里有两层结构语义：

- `v-for`
  代表“生成一组节点”

- `v-if`
  代表“条件决定某个分支要不要渲染”

这两个都不是简单属性，因此它们都必须在 transform 阶段改 AST 结构。

---

## 3. Parse 后的模板 AST

关键源码：

- [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
- [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)

Parse 完后，大致是：

```ts
Root
└─ Element(tag="li", tagType=ELEMENT)
   ├─ Directive(name="for", exp="item in list")
   ├─ Directive(name="if", exp="item.ok")
   └─ Interpolation("item.name")
```

贴近伪 AST 的写法：

```ts
{
  type: ROOT,
  children: [
    {
      type: ELEMENT,
      tag: "li",
      props: [
        { type: DIRECTIVE, name: "for", exp: "item in list" },
        { type: DIRECTIVE, name: "if", exp: "item.ok" }
      ],
      children: [
        {
          type: INTERPOLATION,
          content: "item.name"
        }
      ]
    }
  ]
}
```

这一阶段两个指令都还只是 `DirectiveNode`。

---

## 4. 第一步结构改写：`v-if`

关键源码：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)

关键函数：

- `transformIf`
- `processIf`

由于 `transformIf` 在默认顺序里先于 `transformFor` 执行，所以当前节点会先被改成 `IfNode`。

### 4.1 改写前

```ts
Element(li)
├─ Directive(v-for="item in list")
├─ Directive(v-if="item.ok")
└─ Interpolation("item.name")
```

### 4.2 改写后

```ts
IfNode
└─ IfBranch(condition="item.ok")
   └─ Element(li)
      ├─ Directive(v-for="item in list")
      └─ Interpolation("item.name")
```

注意这里：

- `v-if` 被从 `props` 中移除了
- `v-for` 还保留在 `li` 的 `props` 里

这就是为什么你会看到：

```ts
IfNode -> branch -> Element(with v-for)
```

而不是直接先变成 `ForNode`。

---

## 5. 第二步结构改写：`v-for`

关键源码：

- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

关键函数：

- `transformFor`
- `processFor`
- `finalizeForParseResult`

此时 `v-for` 已经不在 root 直接子节点上，而是在 `IfBranch` 里面那层 `Element(li)` 上。

### 5.1 改写前

```ts
IfNode
└─ IfBranch(condition="item.ok")
   └─ Element(li)
      ├─ Directive(v-for="item in list")
      └─ Interpolation("item.name")
```

### 5.2 改写后

```ts
IfNode
└─ IfBranch(condition="item.ok")
   └─ ForNode
      ├─ source: "list"
      ├─ valueAlias: "item"
      └─ children:
         └─ Element(li)
            └─ Interpolation("item.name")
```

贴近伪 AST：

```ts
{
  type: IF,
  branches: [
    {
      type: IF_BRANCH,
      condition: "item.ok",
      children: [
        {
          type: FOR,
          source: "list",
          valueAlias: "item",
          children: [
            {
              type: ELEMENT,
              tag: "li",
              children: [
                { type: INTERPOLATION, content: "item.name" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 6. 为什么这时 `item.ok` 还没变成 `_ctx.item.ok`

这是这个场景里最容易误解的点。

答案是：

因为 `item` 是 `v-for` 引入的局部别名，不属于 `_ctx`。

所以 transformExpression 处理之后，大致会变成：

```ts
condition: item.ok
source: _ctx.list
interpolation: item.name
```

对应关系是：

- `list` 来自外层上下文 -> `_ctx.list`
- `item` 来自 `v-for` 局部作用域 -> 保持 `item`

---

## 7. 表达式改写后

关键源码：

- [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)
- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

`finalizeForParseResult()` 会先处理 `v-for` 的 `source` / `value` 等表达式。

此时 AST 大致变成：

```ts
IfNode
└─ IfBranch(condition="item.ok")
   └─ ForNode
      ├─ source: _ctx.list
      ├─ valueAlias: item
      └─ children:
         └─ Element(li)
            └─ Interpolation("item.name")
```

要点：

- `item.ok` 保持局部变量访问
- `item.name` 也保持局部变量访问
- 只有 `list` 被加 `_ctx`

---

## 8. `li` 元素生成自己的 `VNodeCall`

关键源码：

- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
- [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)

最内层 `Element(li)` 会先生成自己的 `codegenNode`：

```ts
Element(tag="li")
└─ codegenNode =
   VNodeCall(
     tag: "li",
     props: undefined,
     children: TextCall(Interpolation("item.name")),
     patchFlag: TEXT
   )
```

这一层没有 `v-if` 也没有 `v-for` 了，因为这两个结构型指令都已经升成了外层结构节点。

---

## 9. `ForNode` 生成 `renderList(...)`

关键源码：

- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

### 9.1 改写前

```ts
ForNode
├─ source: _ctx.list
└─ child: li vnode
```

### 9.2 改写后

```ts
ForNode.codegenNode =
VNodeCall(
  tag: FRAGMENT,
  children:
    renderList(_ctx.list, item =>
      VNodeCall("li", ..., item.name)
    ),
  isBlock: true
)
```

这里非常关键：

`ForNode` 不是直接生成一串元素，而是生成：

```ts
renderList(source, alias => childBlock)
```

---

## 10. `IfNode` 最后再包条件表达式

关键源码：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)

现在分支里的 `ForNode` 已经拥有 `codegenNode`，于是 `IfNode` 最终会变成：

```ts
IfNode.codegenNode =
ConditionalExpression(
  test: item.ok,
  consequent:
    FragmentBlock(
      renderList(_ctx.list, item => liVNode)
    ),
  alternate:
    createCommentVNode("v-if", true)
)
```

这一步很重要，因为它揭示了这个例子里真正的最终嵌套关系：

```ts
if (item.ok) {
  for (item in list) {
    render li
  }
}
```

从 AST 结构上看就是：

```ts
IfNode
  -> ForNode
    -> Element(li)
```

---

## 11. 这个结构意味着什么

这一步其实也能顺手解释：

> 为什么不推荐把 `v-if` 和 `v-for` 写在同一个节点上

因为同一个节点上同时出现这两个结构指令时，编译器必须做两层结构改写，而且最终谁包谁是由 transform 顺序决定的。

对阅读者来说，这会明显提高理解成本。

从编译角度看，它不是不能处理，而是：

- 结构更复杂
- 作用域更绕
- 更容易误判变量来源

---

## 12. 最终 render 代码的大致形态

关键源码：

- [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

大致会生成类似：

```ts
function render(_ctx, _cache) {
  return (item.ok)
    ? (_openBlock(true), _createElementBlock(_Fragment, null,
        _renderList(_ctx.list, (item) => {
          return (_openBlock(), _createElementBlock(
            "li",
            null,
            _toDisplayString(item.name),
            1
          ))
        }),
      256))
    : _createCommentVNode("v-if", true)
}
```

这里不是逐字符精确输出，但结构关系是对的：

- 外层是条件表达式
- 条件成立时进入 `renderList`
- `renderList` 每一轮返回一个 `li`

---

## 13. 一眼看懂版

把这个例子的 AST 演化压缩成 5 步：

### 第 1 步：Parse 后

```ts
Element(li, [v-for, v-if], [{{ item.name }}])
```

### 第 2 步：`v-if` 改结构后

```ts
IfNode(
  branch(condition = item.ok, child = li(v-for))
)
```

### 第 3 步：`v-for` 改结构后

```ts
IfNode(
  branch(
    condition = item.ok,
    child = ForNode(source = list, alias = item, child = li)
  )
)
```

### 第 4 步：表达式改写后

```ts
IfNode(
  branch(
    condition = item.ok,
    child = ForNode(source = _ctx.list, alias = item, child = li(item.name))
  )
)
```

### 第 5 步：最终 codegen 结构

```ts
item.ok
  ? renderList(_ctx.list, item => li(item.name))
  : comment
```

---

## 14. 对比另一个更常见的拆法

如果用户改写成：

```vue
<template v-for="item in list">
  <li v-if="item.ok">{{ item.name }}</li>
</template>
```

那结构会更自然：

```ts
ForNode
  -> IfNode
    -> Element(li)
```

而不是：

```ts
IfNode
  -> ForNode
    -> Element(li)
```

所以很多时候，把结构拆开不仅可读性更好，编译后的语义也更直观。

---

## 15. 推荐配合阅读顺序

建议配合源码按这个顺序跳：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) `getBaseTransformPreset`
2. [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts) `processIf`
3. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts) `processFor`
4. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts) `processExpression`
5. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts) `transformElement`
6. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts) `transformText`
7. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts) `generate`

---

## 16. 可以和哪几篇文档一起看

建议一起看：

- 总览：
  - [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)

- 基础案例：
  - [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)

- `v-for + component + slot`：
  - [vfor-component-slot-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vfor-component-slot-ast-flow.md)

这样你就能把：

- 单结构指令
- 组件/slot 结构
- 双结构指令叠加

三类场景都串起来。

---

如果你要，我下一篇可以继续写：

1. `compiler-ssr` 如何复用 `compiler-core`
2. `compiler-dom` 和 `compiler-ssr` 的扩展方式有什么异同
