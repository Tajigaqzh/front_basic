# Vue 编译链路面试讲解版总图

## 一句话总述

Vue 的模板编译本质上分三层：

```text
compiler-sfc
  负责拆 .vue 文件
compiler-dom + compiler-core
  负责把 template 编译成 render 函数
runtime-dom
  负责把 render/helper 真正执行成浏览器 DOM 行为
```

如果面试官问“Vue 模板怎么跑起来”，你可以先用这一句定框架。

## 先给面试官一个总流程

```text
.vue 文件
  -> compiler-sfc parse
  -> 拆成 template / script / style
  -> compileScript 处理 <script setup> / 宏 / bindingMetadata
  -> compileTemplate 调 compiler-dom
  -> compiler-core: parse -> transform -> codegen
  -> 生成 render 函数字符串
  -> runtime-dom 执行 helper
  -> 更新真实 DOM
```

这张图建议你直接背下来。

## 第一层：compiler-sfc 负责什么

### 你可以这样讲

`compiler-sfc` 不是直接把模板编译成 DOM，它先做的是“单文件组件拆块”。也就是先把 `.vue` 文件拆成 `template`、`script`、`script setup`、`style` 和自定义块。

然后它做两件关键事：

1. `compileScript()`
   处理 `defineProps`、`defineEmits`、`defineModel`、顶层 `await`、props 解构这些 SFC 专属能力。

2. `compileTemplate()`
   把 `<template>` 交给 `compiler-dom` 去真正编译成 render 函数。

### 这一层最关键的面试点

`compileScript()` 会产出 `bindingMetadata`。  
这个东西非常关键，因为后面的模板编译需要知道模板里的变量到底来自：

- `_ctx`
- `$setup`
- `$props`
- 还是 `ref.value`

所以 `script` 编译和 `template` 编译不是分离的，它们是靠 `bindingMetadata` 串起来的。

## 第二层：compiler-dom 和 compiler-core 怎么分工

### 一句话分工

- `compiler-core` 负责平台无关的主流程
- `compiler-dom` 负责浏览器平台规则

### 主流程怎么讲

`compiler-core` 的主线很简单，就是三步：

```text
parse
  -> transform
  -> generate
```

也就是：

1. 先把模板字符串变成 AST
2. 再把 AST 改造成更接近 render 代码的 AST
3. 最后把 AST 输出成 render 函数字符串

### compiler-dom 做什么

`compiler-dom` 不会重写这三步，它只是在 `compiler-core` 的扩展点里注入 DOM 平台规则，比如：

- HTML 解析规则
- `v-model`
- `v-on`
- `v-show`
- `Transition`
- 静态字符串化优化

所以它更像“平台增强层”，不是另一套编译器。

## 第三层：parse 阶段可以怎么讲

### 最短讲法

parse 阶段是：

```text
template string
  -> tokenizer
  -> parser
  -> template AST
```

### tokenizer 做什么

`tokenizer.ts` 是一个状态机，负责逐字符扫描模板字符串。

它本身不创建 AST，它只负责识别出：

- 文本
- 开始标签
- 结束标签
- 属性
- 指令
- 插值
- 注释

然后通过回调把这些片段交给 `parser.ts`。

### parser 做什么

`parser.ts` 负责把 tokenizer 送出来的这些片段真正组装成 AST 节点，比如：

- `ElementNode`
- `TextNode`
- `InterpolationNode`
- `DirectiveNode`

所以可以把它理解成：

- tokenizer：切 token
- parser：组 AST

### 面试里容易加分的一句

Vue 模板解析不是正则拼出来的，而是“状态机 tokenizer + AST parser”的经典编译器路线。

## 第四层：transform 阶段是整个编译的核心

### 你可以这样定义

transform 是 Vue 编译里最重要的一层，因为它把“模板 AST”改造成“可以直接 codegen 的 AST”。

### transform 里最关键的几类工作

#### 1. 表达式改写

`transformExpression.ts` 会决定模板里的变量怎么访问：

- `count` 变成 `_ctx.count`
- setup 变量可能变成 `$setup.count`
- ref 变量会变成 `.value` 或 `unref(...)`

这一步本质上是在解决“模板变量到底来自哪里”。

#### 2. 元素编译

`transformElement.ts` 会把一个元素节点变成 `VNodeCall`。

这里会决定：

- tag 是字符串标签还是组件解析结果
- props 怎么生成
- children 怎么生成
- patchFlag 是什么
- 是否需要 block

也就是说，普通元素和组件最后都会收敛成一个核心结构：`VNodeCall`。

#### 3. 结构指令改写

`v-if.ts` 和 `v-for.ts` 是 transform 里最典型的“结构改写”。

- `v-if` 最终会变成条件表达式链
- `v-for` 最终会变成 `renderList(...)`

这类指令不是改一个 prop，而是直接改 AST 结构。

#### 4. slots 编译

`vSlot.ts` 会把组件子节点编译成 slots 对象。

最终大致会变成：

```js
{
  default: () => [...],
  foo: props => [...]
}
```

动态插槽则会进一步变成 `createSlots(...)`。

#### 5. 文本合并

`transformText.ts` 会把相邻文本和插值合并，必要时提前包成 `createTextVNode(...)`。

### transform 阶段最核心的一句话

transform 的产物不是最终 JS 字符串，而是一棵“更接近 render 函数”的 JS AST。

## 第五层：codegen 阶段怎么讲

### 核心定义

codegen 不再关心模板语义本身，它只做一件事：

把 transform 阶段准备好的 `codegenNode` 输出成 render 函数字符串。

### 它主要读什么

codegen 会读取 root 上被 transform 填好的这些信息：

- `helpers`
- `components`
- `directives`
- `hoists`
- `codegenNode`

然后生成：

- helper import / 解构
- hoist 常量
- render 函数签名
- return 后面的 VNode 表达式

### 面试里一句总结

parse 解决“模板长什么样”，  
transform 解决“模板应该怎么编译”，  
codegen 解决“把结果写出来”。

## 第六层：runtime-dom 怎么接编译产物

### 最重要的认知

编译阶段生成的 helper 名，不是凭空出现的，它们在 `runtime-dom` 里都有真实实现。

比如：

- `vModelText`
- `withModifiers`
- `withKeys`
- `vShow`
- `Transition`
- `TransitionGroup`

这些名字在 `compiler-dom/runtimeHelpers.ts` 注册，最后在 `runtime-dom/src/index.ts` 真实导出。

### 典型例子

#### `v-model`

编译阶段：

- 根据 input / checkbox / radio / select 选择不同 helper

运行时：

- `runtime-dom/src/directives/vModel.ts`

作用：

- 同步表单控件值和响应式状态

#### `v-on`

编译阶段：

- 把修饰符拆成 `withModifiers`、`withKeys`、事件名后缀

运行时：

- `runtime-dom/src/directives/vOn.ts`

作用：

- 在真正执行用户回调前做事件过滤和包装

#### `v-show`

编译阶段：

- 标记需要运行时指令

运行时：

- `runtime-dom/src/directives/vShow.ts`

作用：

- 不销毁节点，只切换 `display`

## 面试官如果问“为什么 Vue 要分这么多层”

你可以这样答：

因为 Vue 想把“平台无关的编译能力”和“平台相关的实现细节”拆开。

- `compiler-core` 只管通用编译流程
- `compiler-dom` 只补浏览器规则
- `runtime-core` 只管通用渲染机制
- `runtime-dom` 只补浏览器宿主能力
- `compiler-sfc` 只负责单文件组件语法

这样才能：

- 复用到 SSR
- 复用到自定义 renderer
- 复用到不同构建链路

## 5 分钟答题模板

如果面试官问“Vue 模板编译流程讲一下”，你可以直接按这个版本答：

Vue 3 的模板编译我一般分三层讲。第一层是 `compiler-sfc`，它先把 `.vue` 文件拆成 template、script、style，然后 `compileScript()` 处理 `<script setup>` 宏和 `bindingMetadata`，`compileTemplate()` 再把模板交给编译器。第二层是 `compiler-dom + compiler-core`，真正的主流程在 `compiler-core`，就是 parse、transform、generate 三步；其中 `compiler-dom` 不重写编译器，只是在扩展点里补 HTML 解析规则和 DOM 专属指令，比如 `v-model`、`v-on`、`v-show`。第三层是 `runtime-dom`，编译出来的 helper 比如 `vModelText`、`withModifiers`、`vShow` 最终都会在 runtime-dom 里找到真实实现，然后作用到浏览器 DOM 上。

如果继续细讲，parse 阶段是 tokenizer 状态机加 parser 组 AST；transform 阶段最关键，会把模板 AST 改成更接近 render 的 AST，比如元素会变成 `VNodeCall`，`v-if` 会变成条件表达式，`v-for` 会变成 `renderList`；最后 codegen 只负责把这些 `codegenNode` 输出成 render 函数字符串。

## 10 分钟答题结构

如果对方让你展开，你就按这 6 段讲：

1. `.vue` 文件先由 `compiler-sfc` 拆块
2. `compileScript()` 产出 `bindingMetadata`
3. `compileTemplate()` 进入 `compiler-dom -> compiler-core`
4. parse：tokenizer + parser 生成模板 AST
5. transform：表达式改写、元素编译、`v-if`、`v-for`、slot、文本合并
6. codegen + runtime-dom：生成 render 并落到 helper 的真实执行

## 高频追问和答法

### 1. `compiler-dom` 和 `compiler-core` 的区别是什么？

答：

`compiler-core` 是平台无关的编译主流程，`compiler-dom` 是浏览器平台增强层，负责补 HTML 解析规则和 DOM 指令转换。

### 2. 为什么 `v-model` 要在 DOM 层单独处理？

答：

因为不同表单控件的双向绑定语义不一样，比如 text、checkbox、radio、select 的读写逻辑完全不同，这些都属于浏览器平台细节，不适合放在 core 层。

### 3. transform 为什么最关键？

答：

因为 parse 只是把模板变 AST，真正决定“这段模板最后会编译成什么 render 逻辑”的是 transform。

### 4. `bindingMetadata` 为什么重要？

答：

因为模板编译必须知道变量来自哪。否则编译器没法判断某个标识符该生成 `_ctx.xxx`、`$setup.xxx`、`$props.xxx` 还是 `ref.value`。

## 建议你最后再补一句

如果面试官愿意继续追源码，我会从 `compiler-sfc/compileTemplate -> compiler-core/transform -> transformElement/vIf/vFor -> runtime-dom helper` 这条线继续展开，因为这条线最能体现 Vue 编译器和运行时的整体设计。
