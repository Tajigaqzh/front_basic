# compiler-core 复杂模板 AST 变化过程

本文继续用一个更复杂的模板例子，追踪它在 Vue `compiler-core` 里的 AST 变化过程：

```vue
<MyList v-for="item in list" :key="item.id">
  <template #default="{ row }">
    <span>{{ row.name }}</span>
  </template>
</MyList>
```

这个例子比基础版更有价值，因为它一次覆盖了：

- `v-for`
- 组件节点
- `:key`
- 作用域插槽 `v-slot`
- 插值表达式
- `renderList(...)`
- `createSlots(...)`

---

## 1. 总调用链

主入口还是：

- [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)

主流程不变：

```ts
模板字符串
-> baseParse()
-> transform()
-> generate()
-> render 函数字符串
```

但这次真正重要的 transform 变成了：

1. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)
2. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)
3. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
4. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
5. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)

---

## 2. 原始模板

```vue
<MyList v-for="item in list" :key="item.id">
  <template #default="{ row }">
    <span>{{ row.name }}</span>
  </template>
</MyList>
```

可以先粗看出 3 层语义：

1. 外层是组件 `MyList`
2. 外层组件上挂了 `v-for`
3. 组件 children 不是普通子节点，而是默认插槽

---

## 3. Parse 后的模板 AST

关键源码：

- [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
- [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)

Parse 完之后，大致是：

```ts
Root
└─ Element(tag="MyList", tagType=COMPONENT)
   ├─ Directive(name="for", exp="item in list")
   ├─ Directive(name="bind", arg="key", exp="item.id")
   └─ Element(tag="template", tagType=TEMPLATE)
      ├─ Directive(name="slot", arg="default", exp="{ row }")
      └─ Element(tag="span", tagType=ELEMENT)
         └─ Interpolation("row.name")
```

更贴近伪 AST：

```ts
{
  type: ROOT,
  children: [
    {
      type: ELEMENT,
      tag: "MyList",
      tagType: COMPONENT,
      props: [
        { type: DIRECTIVE, name: "for", exp: "item in list" },
        { type: DIRECTIVE, name: "bind", arg: "key", exp: "item.id" }
      ],
      children: [
        {
          type: ELEMENT,
          tag: "template",
          tagType: TEMPLATE,
          props: [
            { type: DIRECTIVE, name: "slot", arg: "default", exp: "{ row }" }
          ],
          children: [
            {
              type: ELEMENT,
              tag: "span",
              children: [
                { type: INTERPOLATION, content: "row.name" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

注意这里：

- `MyList` 在 parse 阶段已经会被识别成 `COMPONENT`
- `v-for` 还只是普通指令
- `#default` 会被规范化成 `slot`
- `{ row }` 还只是一个 slot 表达式

---

## 4. `v-for` 先改结构

关键源码：

- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

关键函数：

- `transformFor`
- `processFor`
- `finalizeForParseResult`

### 4.1 改写前

```ts
Component(MyList)
├─ Directive(v-for="item in list")
├─ Directive(:key="item.id")
└─ template #default ...
```

### 4.2 改写后

`v-for` 不再保留在组件 props 里，而是把外层节点替换成 `ForNode`：

```ts
Root
└─ ForNode
   ├─ source: "list"
   ├─ valueAlias: "item"
   └─ children:
      └─ Element(tag="MyList", tagType=COMPONENT)
         ├─ Directive(name="bind", arg="key", exp="item.id")
         └─ Element(tag="template", tagType=TEMPLATE)
            ├─ Directive(name="slot", arg="default", exp="{ row }")
            └─ Element(tag="span")
               └─ Interpolation("row.name")
```

### 4.3 为什么必须先做

因为 `v-for` 跟 `v-if` 一样，是结构型指令。

它最终不是变成一个 prop，而是要变成：

```ts
renderList(list, item => vnode)
```

所以编译器必须先把它提升成 `ForNode`。

---

## 5. 表达式改写

关键源码：

- [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)
- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)
- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)

这一步最重要的不是“全改成 `_ctx.xxx`”，而是“哪些变量算局部作用域变量”。

### 5.1 `v-for` 引入局部变量

`item in list` 会被拆成：

```ts
source = _ctx.list
valueAlias = item
```

这里：

- `list` 属于外层上下文，所以会变成 `_ctx.list`
- `item` 是 `v-for` 局部别名，所以不能变成 `_ctx.item`

### 5.2 `v-slot` 继续引入局部变量

`#default="{ row }"` 里的 `row` 是 slot props，同样属于局部变量。

所以：

```ts
{{ row.name }}
```

会变成：

```ts
row.name
```

而不是：

```ts
_ctx.row.name
```

### 5.3 改写后的结构

大致可以看成：

```ts
ForNode
├─ source: _ctx.list
├─ valueAlias: item
└─ children:
   └─ Component(MyList)
      ├─ :key = item.id
      └─ template #default="{ row }"
         └─ span
            └─ Interpolation("row.name")
```

这里 `item` 和 `row` 都是局部变量，只有 `list` 才来自 `_ctx`。

---

## 6. 插槽结构建立

关键源码：

- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)

关键函数：

- `trackSlotScopes`
- `trackVForSlotScopes`
- `buildSlots`

### 6.1 改写前

组件 children 里还是：

```ts
template #default="{ row }"
  span
    {{ row.name }}
```

### 6.2 改写后

它会被编译成“slots 对象”语义：

```ts
slots = {
  default: ({ row }) => [
    <span>{{ row.name }}</span>
  ]
}
```

更贴近 `compiler-core` 的 AST 表示：

```ts
VNodeCall(
  tag: MyList,
  children:
    SlotsObjectExpression({
      default: FunctionExpression(
        params: { row },
        returns: [
          Element(span ...)
        ]
      )
    })
)
```

### 6.3 关键点

这一步之后，组件 children 就不再按“普通元素子节点数组”理解了，而是：

```ts
children = slotsObject
```

这正是组件和普通元素在 `transformElement.ts` 里最大的分岔点之一。

---

## 7. `span` 元素先变成 VNodeCall

关键源码：

- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
- [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)

### 7.1 改写前

```ts
Element(tag="span")
└─ Interpolation("row.name")
```

### 7.2 改写后

```ts
Element(tag="span")
└─ codegenNode =
   VNodeCall(
     tag: "span",
     props: undefined,
     children: TextCall(Interpolation("row.name")),
     patchFlag: TEXT
   )
```

也就是最终 slot 函数返回的内容，已经不是模板节点，而是可 codegen 的 vnode 结构。

---

## 8. 组件 `MyList` 生成自己的 `VNodeCall`

关键源码：

- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)

关键函数：

- `transformElement`
- `resolveComponentType`
- `buildProps`

### 8.1 改写前

组件节点还是模板节点，只是它的 children 已经变成 slots 语义。

### 8.2 改写后

组件会得到自己的 `codegenNode`：

```ts
VNodeCall(
  tag: resolveComponent("MyList"),
  props: {
    key: item.id
  },
  children: {
    default: ({ row }) => [
      VNodeCall("span", ...)
    ]
  },
  isComponent: true
)
```

注意两点：

1. 组件 `tag` 不再是字符串 `"MyList"`，而是组件解析结果
2. `children` 不是数组，而是 slots 对象

---

## 9. `ForNode` 生成 `renderList(...)`

关键源码：

- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

关键函数：

- `transformFor`
- `createForLoopParams`

### 9.1 改写前

```ts
ForNode
├─ source: _ctx.list
└─ child:
   Component(MyList ...)
```

### 9.2 改写后

它会变成：

```ts
VNodeCall(
  tag: FRAGMENT,
  children:
    renderList(_ctx.list, item =>
      VNodeCall(
        tag: resolveComponent("MyList"),
        props: { key: item.id },
        children: {
          default: ({ row }) => [
            VNodeCall("span", ...)
          ]
        }
      )
    ),
  isBlock: true
)
```

更抽象地说：

```ts
ForNode.codegenNode =
FragmentBlock(
  renderList(_ctx.list, item => componentVNode)
)
```

### 9.3 为什么外层是 Fragment

因为 `v-for` 语义本质上是“生成一组节点”，不是单一节点。  
所以它外层通常需要一个 Fragment block 来承接这组结果。

---

## 10. Root 最终拿到的 `codegenNode`

最终根节点会近似是：

```ts
Root.codegenNode =
VNodeCall(
  tag: FRAGMENT,
  children:
    renderList(_ctx.list, item =>
      resolveComponent("MyList", {
        key: item.id,
        slots: {
          default: ({ row }) => [
            createElementVNode("span", null, toDisplayString(row.name), TEXT)
          ]
        }
      })
    ),
  isBlock: true
)
```

这里你会同时看到几条主线已经汇合：

- `v-for` -> `renderList`
- component -> `resolveComponent`
- `#default` -> slots 对象
- `{{ row.name }}` -> `toDisplayString`

---

## 11. 最终 render 代码的大致形态

关键源码：

- [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

最终输出会接近：

```ts
function render(_ctx, _cache) {
  const _component_MyList = _resolveComponent("MyList")

  return (_openBlock(true), _createElementBlock(_Fragment, null,
    _renderList(_ctx.list, (item) => {
      return (_openBlock(), _createBlock(_component_MyList, {
        key: item.id
      }, {
        default: _withCtx(({ row }) => [
          _createElementVNode(
            "span",
            null,
            _toDisplayString(row.name),
            1
          )
        ]),
        _: 1
      }))
    }),
  128))
}
```

这不是逐字符精确输出，但结构已经是对的：

- `renderList(_ctx.list, item => ...)`
- 每轮返回一个组件 vnode
- 组件第三个参数是 slots
- 默认插槽是一个函数

---

## 12. 一眼看懂版

把整个过程压缩成 5 步：

### 第 1 步：Parse 后

```ts
Component(MyList, [v-for, :key], [template #default -> span -> {{ row.name }}])
```

### 第 2 步：`v-for` 改结构后

```ts
ForNode(
  source = list,
  valueAlias = item,
  child = MyList(:key="item.id", template #default ...)
)
```

### 第 3 步：表达式和作用域处理后

```ts
ForNode(
  source = _ctx.list,
  valueAlias = item,
  child = MyList(:key="item.id", slotProps={ row }, {{ row.name }})
)
```

### 第 4 步：组件 children 变成 slots 对象后

```ts
MyList(
  props = { key: item.id },
  children = {
    default: ({ row }) => [ span(row.name) ]
  }
)
```

### 第 5 步：最终 codegen 结构

```ts
renderList(_ctx.list, item =>
  createBlock(MyList, { key: item.id }, {
    default: ({ row }) => [createElementVNode("span", ..., row.name)]
  })
)
```

---

## 13. 文件跳转顺序建议

如果你要拿源码一步一步点，建议按这个顺序看：

1. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts) `baseParse`
2. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts) `processFor`
3. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts) `processExpression`
4. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts) `buildSlots`
5. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts) `transformElement`
6. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts) `transformText`
7. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts) `generate`

---

## 14. 和基础例子的最大区别

和基础例子 [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md) 相比，这个复杂例子多出来的关键点只有两个：

1. `v-for` 会把单节点改造成 `renderList(...)`
2. 组件 children 会从“子节点数组”切换成“slots 对象”

这两条一旦理解，后面读大多数复杂模板就会顺很多。

---

如果你要，我下一篇可以继续写：

1. `compiler-core` 全链路总览
2. `v-if + v-for` 组合场景 AST 变化
3. `slot outlet <slot/>` 和组件插槽是怎么对应上的
