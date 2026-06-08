# compiler-core 全链路总览

这篇文档不再盯某一个具体模板，而是把 Vue `compiler-core` 的完整工作链路梳理清楚：

```ts
模板字符串
-> tokenizer
-> parser
-> 模板 AST
-> transform
-> 带 codegenNode 的 AST
-> codegen
-> render 函数字符串
```

如果你前面已经看过这两篇：

- [template-ast-flow.md](./template-ast-flow.md)
- [vfor-component-slot-ast-flow.md](./vfor-component-slot-ast-flow.md)

那这篇可以当成它们的“总地图”。

---

## 1. compiler-core 到底负责什么

`compiler-core` 的职责只有一句话：

> 把模板语法翻译成 render 函数代码。

它不关心平台 DOM 细节，也不直接操作真实节点。  
它主要做的是：

1. 解析模板
2. 建立 AST
3. 把模板语义改写成运行时调用语义
4. 生成 render 函数字符串

所以它是“模板编译器核心”，不是运行时。

---

## 2. 最核心的 4 个入口文件

先记住这 4 个文件：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)
2. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
3. [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)
4. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

它们分别对应：

- `compile.ts`
  负责总调度

- `parser.ts`
  负责从模板字符串生成模板 AST

- `transform.ts`
  负责遍历 AST、应用各种 transform、收集 helper/hoist/cache 等编译信息

- `codegen.ts`
  负责把 transform 后的 AST 输出成 render 代码

可以把它们理解成三段流水线外加一个总控。

---

## 3. 第一步：compile 总调度

入口函数：

- [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) `baseCompile`

它的核心结构非常简单：

```ts
const ast = baseParse(source, options)
transform(ast, options)
return generate(ast, options)
```

这里要特别注意两件事：

1. `transform()` 是“原地修改 AST”
2. `generate()` 不是重新理解模板，而是读取 `transform` 后已经准备好的 `codegenNode`

也就是说，真正最复杂的部分，其实在 `transform` 阶段。

---

## 4. 第二步：模板解析

解析阶段由两层组成：

1. [tokenizer.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/tokenizer.ts)
2. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)

### 4.1 tokenizer 做什么

`tokenizer.ts` 做的是：

- 逐字符扫描模板
- 维护状态机
- 识别文本、标签、属性、指令、注释、CDATA、插值
- 通过回调把这些片段交给 parser

它不直接创建 AST。

可以把它理解成：

```ts
原始字符串 -> 有语义边界的 token 片段
```

### 4.2 parser 做什么

`parser.ts` 则负责：

- 接收 tokenizer 的回调
- 创建 `ElementNode` / `DirectiveNode` / `InterpolationNode` 等 AST 节点
- 维护元素栈
- 拼装父子关系

可以把它理解成：

```ts
token 片段 -> 模板 AST
```

### 4.3 parse 阶段产物

parse 结束后，得到的是 [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts) 里定义的模板 AST。

这时的 AST 还是“语法意义上的树”：

- `v-if` 还是 directive
- `v-for` 还是 directive
- `@click` 还是 directive
- `{{ count }}` 还是 interpolation

它还没有变成 JS 生成结构。

---

## 5. AST 是什么

要看懂后面的 transform，必须先知道 [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts) 里定义了两层节点：

### 5.1 模板 AST 节点

比如：

- `RootNode`
- `ElementNode`
- `TextNode`
- `CommentNode`
- `InterpolationNode`
- `DirectiveNode`
- `IfNode`
- `ForNode`

这些节点更偏“模板语义”。

### 5.2 codegen JS AST 节点

比如：

- `VNodeCall`
- `CallExpression`
- `ObjectExpression`
- `FunctionExpression`
- `ConditionalExpression`
- `CacheExpression`

这些节点更偏“将来 render 函数要长什么样”。

### 5.3 transform 的真正工作

transform 的核心，不是“再造一棵全新的树”，而是：

> 在模板 AST 上逐步补出 codegen AST

最典型的表现就是：

```ts
ElementNode.codegenNode = VNodeCall(...)
```

---

## 6. 第三步：transform 总框架

核心文件：

- [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)

关键函数：

- `createTransformContext`
- `transform`
- `traverseNode`
- `traverseChildren`
- `createRootCodegen`

### 6.1 transformContext 是什么

`TransformContext` 是整个 transform 阶段的共享上下文，里面会记录：

- 当前节点
- 当前父节点
- 当前作用域变量
- 已使用的 helper
- 已发现的组件
- 已发现的指令
- hoists
- cached

你可以把它理解成“遍历中的编译状态机”。

### 6.2 traverseNode 做什么

`traverseNode()` 做的是：

1. 执行当前节点的所有 `nodeTransforms`
2. 递归遍历子节点
3. 逆序执行退出回调

这是典型的“进入 + 退出”访问模型。

很多关键 transform 都依赖退出阶段，因为：

> 父节点往往要等子节点先 transform 完，才能决定自己的 codegenNode

最典型的例子就是 `transformElement`。

---

## 7. transform 阶段有哪些关键变换

默认变换顺序在：

- [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts) `getBaseTransformPreset`

最关键的几类变换如下。

### 7.1 结构型指令

文件：

- [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)
- [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)

它们的特点是：

- 不只是改 props
- 而是直接改 AST 结构

比如：

```ts
Element + v-if -> IfNode
Element + v-for -> ForNode
```

最终分别会变成：

- 条件表达式
- `renderList(...)`

### 7.2 表达式改写

文件：

- [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)

职责是把模板表达式改成明确的运行时访问路径：

- `count` -> `_ctx.count`
- `foo` -> `$props.foo`
- `bar` -> `bar.value`

这一层本质上解决的是：

> 模板里的名字，运行时到底该从哪里取值

### 7.3 元素和组件生成

文件：

- [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)

这是最关键的 transform 之一。

它负责把：

```ts
ElementNode
```

变成：

```ts
VNodeCall(...)
```

同时会决定：

- tag 是字符串还是组件解析结果
- props 怎么生成
- children 是文本、数组还是 slots
- patchFlag 是什么
- 要不要变成 block

### 7.4 指令级变换

文件：

- [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOn.ts)
- [vBind.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vBind.ts)
- [vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vModel.ts)

它们的职责是把单个指令翻译成 props / runtime helper 调用。

例如：

- `@click="inc"` -> `onClick: _ctx.inc`
- `:id="foo"` -> `id: _ctx.foo`
- `v-model="name"` -> `modelValue + onUpdate:modelValue`

### 7.5 slot 变换

文件：

- [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
- [transformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformSlotOutlet.ts)

分两类：

1. 组件上的 slot 定义
   - 生成 slots 对象

2. `<slot/>` outlet
   - 生成 `renderSlot(...)`

### 7.6 文本变换

文件：

- [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)

职责是：

- 合并相邻文本和插值
- 预先转成文本 vnode 结构
- 给动态文本打 patch flag

### 7.7 优化相关变换

文件：

- [cacheStatic.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/cacheStatic.ts)
- [vOnce.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOnce.ts)
- [vMemo.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vMemo.ts)

它们负责：

- 静态提升
- handler cache
- `v-once`
- `v-memo`
- 常量性判断

---

## 8. transform 完成后，AST 变成什么样

transform 结束后，根节点会多出很多重要信息：

- `root.codegenNode`
- `root.helpers`
- `root.components`
- `root.directives`
- `root.hoists`
- `root.cached`

这里最重要的是：

```ts
root.codegenNode
```

因为 `codegen.ts` 基本就是从这里开始往下生成 render 代码。

可以把 transform 的目标压缩成一句话：

> 给 root 准备出一棵完整可生成 JS 的 codegen tree

---

## 9. 第四步：codegen

核心文件：

- [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)

关键函数：

- `createCodegenContext`
- `generate`
- `genFunctionPreamble`
- `genModulePreamble`
- `genNode`

### 9.1 codegen 做什么

它不再理解模板语义，而是只做一件事：

> 把 codegen AST 拼成字符串

比如：

- `VNodeCall` -> `_createVNode(...)`
- `ConditionalExpression` -> `test ? a : b`
- `FunctionExpression` -> `() => [...]`
- `CallExpression` -> `_renderList(...)`

### 9.2 preamble

在真正生成 render 函数体之前，会先生成一些前置代码：

- helper import / 解构
- 组件 resolve
- 指令 resolve
- hoisted 常量

这就是为什么你最后看到的 render 函数前面，会有很多：

```ts
const _component_Foo = _resolveComponent("Foo")
const _hoisted_1 = ...
```

### 9.3 render 函数体

当 `genNode(root.codegenNode)` 执行时，最终 render 主体就被输出出来了。

---

## 10. runtimeHelpers 的作用

文件：

- [runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/runtimeHelpers.ts)

这里的核心思想很简单：

- transform/codegen 内部不直接写 `"createVNode"` 这种字符串
- 而是统一使用 `symbol`

比如：

```ts
CREATE_VNODE
RENDER_LIST
TO_DISPLAY_STRING
```

到真正生成代码时，再通过 `helperNameMap` 映射成：

```ts
createVNode
renderList
toDisplayString
```

这样做的好处是：

- 内部逻辑更稳定
- 平台编译器更容易扩展
- helper 收集和注入更统一

---

## 11. utils 在整个链路中的位置

文件：

- [utils.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/utils.ts)

这是一个高频支撑文件，很多 transform 都会依赖它。

高频函数包括：

- `findDir`
- `findProp`
- `isStaticArgOf`
- `isMemberExpression`
- `isFnExpression`
- `injectProp`
- `hasScopeRef`
- `isCommentOrWhitespace`

这些函数并不直接代表某个编译阶段，但它们是各个 transform 的基础工具。

你可以把它理解成：

> transform 层的共享工具箱

---

## 12. errors 的作用

文件：

- [errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/errors.ts)

它解决的是统一错误体系：

- parse 错误
- transform 错误
- 通用编译错误

所有错误最后都会走：

```ts
createCompilerError(code, loc)
```

所以当你在源码里看到：

```ts
context.onError(createCompilerError(...))
```

你就知道这不是某个 transform 私有的错误格式，而是整个 compiler-core 的统一错误出口。

---

## 13. 一张脑图式总结

可以把整个 `compiler-core` 压成下面这张“职责图”：

### 13.1 输入

```ts
template string
```

### 13.2 词法扫描

```ts
tokenizer.ts
```

输出：标签、文本、属性、插值等语义片段

### 13.3 语法建树

```ts
parser.ts
```

输出：模板 AST

### 13.4 语义改写

```ts
transform.ts + transforms/*
```

输出：带 `codegenNode` 的 AST

### 13.5 代码生成

```ts
codegen.ts
```

输出：render 函数字符串

### 13.6 支撑层

```ts
ast.ts
runtimeHelpers.ts
utils.ts
errors.ts
```

---

## 14. 推荐阅读顺序

如果你要按源码真正读一遍，建议用这个顺序：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)
2. [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)
3. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
4. [tokenizer.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/tokenizer.ts)
5. [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)
6. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)
7. [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)
8. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)
9. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
10. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
11. [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOn.ts)
12. [vBind.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vBind.ts)
13. [vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vModel.ts)
14. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)
15. [cacheStatic.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/cacheStatic.ts)
16. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)
17. [runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/runtimeHelpers.ts)
18. [utils.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/utils.ts)
19. [errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/errors.ts)

---

## 15. 读源码时最容易卡住的点

### 15.1 为什么 AST 有两层

因为：

- parser 产生的是模板 AST
- codegen 需要的是 JS 生成 AST

transform 的职责就是把两者连接起来。

### 15.2 为什么很多 transform 用退出阶段

因为父节点往往要等子节点先确定下来，自己才能决定：

- children 该怎么表示
- patchFlag 是多少
- 是否生成 block

### 15.3 为什么 `v-if` / `v-for` 要先处理

因为它们会改 AST 结构，不只是改属性。

### 15.4 为什么 component 的 children 会变成 slots

因为组件和普通元素在运行时 children 语义不同：

- 普通元素要的是子节点数组
- 组件要的是 slots 对象

---

## 16. 建议怎么配合前两篇一起看

推荐这样组合：

1. 先看这篇总览，知道整条流水线长什么样
2. 再看基础案例
   - [template-ast-flow.md](./template-ast-flow.md)
3. 再看复杂案例
   - [vfor-component-slot-ast-flow.md](./vfor-component-slot-ast-flow.md)

这样你会同时具备：

- 总体框架感
- 简单案例的结构变化直觉
- 复杂案例的真实阅读经验

---

如果你要，我下一篇可以继续补：

1. `v-if + v-for` 组合场景 AST 变化
2. `<slot/>` outlet 和组件 slots 的对应关系
3. `compiler-dom` 是怎么在 `compiler-core` 之上加平台能力的
