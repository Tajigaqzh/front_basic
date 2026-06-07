# compiler-sfc 总览

这篇文档回答一个很具体的问题：

> 一个 `.vue` 单文件组件，进入 Vue 编译器之后，到底会先被谁处理？`template / script / style` 三块又是怎么重新汇合的？

如果你前面已经看过 `compiler-core`、`compiler-dom`、`compiler-ssr`，那这一层就是把它们真正接到 SFC 场景里的那层胶水。

---

## 1. 先记住 `compiler-sfc` 的职责

`compiler-core` 解决的是“模板 AST 如何变成 render 逻辑”。

`compiler-dom` 解决的是“浏览器平台给模板编译补什么能力”。

`compiler-ssr` 解决的是“SSR 平台如何把模板编译成字符串输出逻辑”。

而 `compiler-sfc` 解决的是另一件事：

> 把一个完整的 `.vue` 文件拆开，再把 `template / script / style` 分别交给合适的编译器处理，最后把这些结果重新组织成组件可消费的产物。

也就是说，`compiler-sfc` 不是在替代 `compiler-core`，而是在它外面多包了一层“单文件组件编排器”。

源码入口主要看这四个文件：

1. [parse.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/parse.ts)
2. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
3. [compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)
4. [compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)

---

## 2. 整体流程先看一遍

假设有这样一个组件：

```vue
<template>
  <div class="card">{{ title }}</div>
</template>

<script setup lang="ts">
const title = 'hello'
</script>

<style scoped>
.card { color: red; }
</style>
```

它的大致处理顺序可以先粗看成这样：

```text
.vue source
  -> parse()
     -> descriptor
        - template block
        - script block / script setup block
        - style blocks
        - custom blocks

descriptor
  -> compileScript()
     -> bindings / bindingMetadata / runtime options / imports

descriptor.template + bindingMetadata
  -> compileTemplate()
     -> compiler-dom.compile(...)
     -> compiler-core.parse -> transform -> generate
     -> render code

descriptor.styles[]
  -> compileStyle()
     -> preprocess / trim / scoped transform / css vars
     -> css code
```

所以 `compiler-sfc` 的核心不是“自己完成所有编译”，而是：

1. 先把 `.vue` 拆成结构化 `descriptor`
2. 再决定各块分别调用谁
3. 再把 script 和 template 之间需要共享的信息串起来

其中最重要的共享信息，就是 `bindingMetadata`。

---

## 3. `parse.ts` 在做什么

先看入口：[parse.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/parse.ts)

`parse()` 的职责非常明确：

> 把整个 `.vue` 文件解析成 `SFCDescriptor`

这个 `descriptor` 可以理解为“单文件组件的结构化目录”：

```ts
{
  filename,
  source,
  template,
  script,
  scriptSetup,
  styles,
  customBlocks,
  cssVars,
  slotted
}
```

### 3.1 它不是自己手写一套 SFC parser

这里一个很关键的点是：

`compiler-sfc` 没有重新实现一套 HTML 解析器，它直接复用了 `compiler-dom` 的 `parse()`：

```ts
const ast = compiler.parse(source, {
  parseMode: 'sfc',
  prefixIdentifiers: true,
  ...
})
```

也就是说：

- tokenization / parser 基础能力，还是来自 `compiler-core`
- HTML 平台解析细节，还是来自 `compiler-dom`
- `compiler-sfc` 只是把 parser 切到 `parseMode: 'sfc'`

这个模式下，顶层的 `<template> / <script> / <style>` 会被当作 SFC block 根节点来处理。

### 3.2 解析完成后，按顶层标签归类

拿到 AST 之后，`parse.ts` 会遍历 `ast.children`，只关心顶层 `ElementNode`。

然后按 `node.tag` 分流：

- `template` -> `descriptor.template`
- `script` -> `descriptor.script` 或 `descriptor.scriptSetup`
- `style` -> push 到 `descriptor.styles`
- 其他标签 -> push 到 `descriptor.customBlocks`

这一步本质上是在做：

```text
Root.children
  -> 识别 block 类型
  -> 生成每个 block 的 content / attrs / loc / lang / src
  -> 填回 descriptor
```

### 3.3 `template` block 为什么会多存一份 AST

在 `template` 分支里有个重要动作：

```ts
templateBlock.ast = createRoot(node.children, source)
```

意思是：

- 整个 `.vue` 文件先被 parse 成一个 SFC 根 AST
- 但是真正交给模板编译器的，不是整棵 SFC AST
- 而是 `<template>` 内部 children 重新包成的 `RootNode`

这一步很关键，因为 `compileTemplate()` 之后要交给 `compiler-dom.compile(...)`，而后者想看到的是“模板根 AST”，不是“SFC 外壳 AST”。

### 3.4 `script setup` 为什么单独存

`parse.ts` 会把：

- 普通 `<script>` 放到 `descriptor.script`
- 带 `setup` 的 `<script setup>` 放到 `descriptor.scriptSetup`

这样后面 `compileScript()` 才能做统一合并。

它还会提前做几类约束校验：

- 重复 `template`
- 重复 `script`
- 重复 `script setup`
- `<script setup src>`
- `<script src>` 和 `<script setup>` 同时存在

所以 `parse()` 不是“只拆不校验”，它已经顺手做了一部分 SFC 结构合法性检查。

---

## 4. `compileScript.ts` 在做什么

入口：[compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)

这是 `compiler-sfc` 里最像“中控层”的文件。

它的目标可以概括成一句话：

> 把 `<script>` 和 `<script setup>` 统一整理成最终脚本产物，同时分析出模板编译阶段要用到的绑定信息。

### 4.1 没有 `<script setup>` 时

如果组件只有普通 `<script>`，流程相对简单：

```text
analyzeScriptBindings(ctx)
  -> processNormalScript(ctx)
```

也就是：

- 分析普通脚本里有哪些绑定
- 走普通组件脚本处理路径

### 4.2 有 `<script setup>` 时，事情会复杂很多

这条路径里，`compileScript()` 会做几件核心事情：

1. 统一收集 `import`
2. 识别编译期宏
3. 处理 `defineProps` 解构
4. 处理顶层 `await`
5. 生成运行时 `props / emits / model`
6. 生成模板编译所需的 `bindingMetadata`

### 4.3 为什么要分析宏

源码里会识别这些宏：

- `defineProps`
- `defineEmits`
- `defineModel`
- `defineExpose`
- `defineSlots`
- `defineOptions`
- `withDefaults`

这些名字看起来像运行时代码，其实很多是“编译期语法糖”。

也就是说，`compileScript()` 不是简单保留它们，而是要把它们消化掉，然后转成更底层的组件选项或 setup 语义。

比如：

- `defineProps()` -> 生成运行时 `props`
- `defineEmits()` -> 生成运行时 `emits`
- `defineModel()` -> 额外生成 model props / emits

### 4.4 为什么 `bindingMetadata` 这么重要

`compileScript()` 最重要的副产物之一，就是 `bindingMetadata`。

它解决的是：

> 模板里出现的标识符，到底来自哪里？

比如模板里写：

```vue
<div>{{ title }}</div>
```

模板编译器需要知道 `title` 是：

- `props`
- `setup` 局部变量
- `data`
- `options API` 绑定
- import 进来的值

只有搞清楚这一点，`compiler-dom / compiler-core` 才能决定生成什么访问方式，或者哪些表达式可以直接内联。

所以实际链路不是：

```text
template 单独编译
```

而是：

```text
compileScript()
  -> bindingMetadata

compileTemplate()
  -> 带着 bindingMetadata 编译模板
```

这就是 `script` 和 `template` 之间真正的耦合点。

### 4.5 它也会分析模板用到了哪些 import

`compileScript()` 里还会调用：

- `resolveTemplateUsedIdentifiers(descriptor)`
- `resolveTemplateVModelIdentifiers(descriptor)`
- `isImportUsed(local, descriptor)`

这说明它不仅在看脚本，还会反过来检查模板对脚本标识符的消费情况。

原因很直接：

> 模板不是孤立存在的，它会反向影响脚本编译结果。

这也是为什么说 `compiler-sfc` 是“编排层”，而不是“几个独立子编译器的简单拼接”。

---

## 5. `compileTemplate.ts` 在做什么

入口：[compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)

这个文件的职责可以概括成一句话：

> 把 `<template>` block 包装后交给 `compiler-dom`，并补上 SFC 场景需要的额外选项。

### 5.1 本质上它还是在调 `compiler-dom.compile(...)`

源码里真正关键的一段是：

```ts
let result = compiler.compile(inAST || source, {
  mode: 'module',
  prefixIdentifiers: true,
  hoistStatic: true,
  cacheHandlers: true,
  sourceMap: true,
  scopeId: scoped ? longId : undefined,
  slotted,
  ssrCssVars: ...,
  ...
})
```

这说明：

- 模板编译主链还是 `compiler-dom -> compiler-core`
- `compileTemplate()` 主要负责补齐 SFC 语境下的编译参数

### 5.2 它额外补了哪些 SFC 语义

主要有这几类：

1. 预处理器支持
2. `scoped` 对应的 `scopeId`
3. `slotted` 相关选项
4. SSR CSS vars 注入
5. asset url transform 扩展位
6. source map 合并

所以它不是改写主编译流程，而是在调用前后包了一层准备工作和收尾工作。

### 5.3 为什么有时会重新 parse AST

源码里有个很容易忽略但很重要的分支：

```ts
if (inAST?.transformed) {
  const newAST = defaultCompiler.parse(inAST.source, ...)
  ...
}
```

这说明：

- 如果外面传进来的 AST 已经做过 transform
- 那它未必还是“适合模板编译入口消费的原始模板 AST”

所以这里会重新 parse 一次，恢复成“干净模板 AST”，避免重复 transform 后结构已经偏离预期。

这一步体现的是编译器里常见的一条原则：

> parse 阶段 AST 和 transform 之后 AST，虽然都是 AST，但它们的使用语境不一定相同。

### 5.4 它和 `compileScript()` 是怎么接上的

虽然这个文件本身不直接实现所有脚本分析逻辑，但实际调用方通常会把：

- `bindingMetadata`
- `scopeId`
- `slotted`
- `ssr` 相关选项

一起传进来。

因此你读 `compileTemplate.ts` 时要始终记住：

> 它不是单独工作的，它依赖 `parse()` 和 `compileScript()` 之前已经准备好的上下文。

---

## 6. `compileStyle.ts` 在做什么

入口：[compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)

这个文件的职责很直接：

> 把单个 `<style>` block 变成最终样式代码，并补上 scoped / preprocess / css vars 这类 SFC 专属处理。

### 6.1 它处理的是“单个 style block”

注意这里的函数签名不是接收整个 `descriptor`，而是接收一个 style block 对应的选项。

所以整体关系通常是：

```text
descriptor.styles[]
  -> 每个 style 单独调用 compileStyle()
```

### 6.2 当前这份实现重点保留了主流程形状

这份教学仓库里的 `compileStyle.ts` 比官方完整版轻一些，但主干流程是保留的：

1. 如果有预处理器，先 preprocess
2. 做 trim
3. 如果 `scoped`，做 scoped 样式改写
4. 扫描 CSS vars
5. 返回 code / map / errors / dependencies

你可以把它理解成：

> 这里先保留了 SFC style pipeline 的骨架，方便从整体上看懂 `.vue` 编译链路。

### 6.3 `scoped` 在这里落地

样式的 `scoped` 并不是模板编译器自己单独完成的。

真正完整的 scoped 语义，要两边一起配合：

- `compileTemplate()` 给模板节点打上作用域相关标记
- `compileStyle()` 把选择器改写成带作用域约束的形式

所以只看其中一边，你看到的都只是 scoped 的半套机制。

---

## 7. 四个入口是怎么串起来的

把四个文件合起来看，完整理解应该是这样：

### 7.1 第一步：拆文件

`parse(source)`：

- 复用 `compiler-dom.parse(..., { parseMode: 'sfc' })`
- 拿到 SFC 根 AST
- 归类出 `template / script / scriptSetup / styles / customBlocks`
- 形成 `descriptor`

### 7.2 第二步：先整理 script

`compileScript(descriptor)`：

- 统一普通 script 和 script setup
- 处理编译期宏
- 生成运行时 `props / emits / model`
- 生成 `bindingMetadata`

### 7.3 第三步：再编 template

`compileTemplate(...)`：

- 读取 `<template>` block
- 带着 SFC 选项和脚本分析结果
- 调 `compiler-dom.compile(...)`
- 进入 `compiler-core` 主编译链

### 7.4 第四步：分别编 style

`compileStyle(...)`：

- 每个 `<style>` 独立处理
- 处理 `scoped`
- 处理预处理器
- 处理 CSS vars

---

## 8. 你读源码时最容易忽略的两个点

### 8.1 `compiler-sfc` 不是独立编译器内核

很多人第一次读会误以为：

> `.vue` 编译最核心的东西都在 `compiler-sfc`

其实不是。

`compiler-sfc` 更像 orchestration layer，也就是“编排层”：

- 模板主编译逻辑在 `compiler-dom / compiler-core`
- SFC 文件拆分和跨 block 协调在 `compiler-sfc`

### 8.2 script 和 template 是双向影响的

不是只有 template 依赖 script。

反过来，script 编译也会看模板是否使用了某些 import、某些标识符、某些 `v-model` 变量。

所以真正的 SFC 编译链路是“互相喂信息”的，而不是三个 block 各编各的。

---

## 9. 推荐阅读顺序

如果你已经读过前面的编译器文档，接下来建议这样接：

1. 先读 [compiler-dom 如何扩展 compiler-core](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)
2. 再读当前这篇 [compiler-sfc 总览](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/compiler-sfc-overview.md)
3. 然后按顺序读源码：
4. [parse.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/parse.ts)
5. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
6. [compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)
7. [compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)

如果你读到这里，下一步最值得继续深挖的是：

- `script/defineProps.ts`
- `script/defineEmits.ts`
- `script/defineModel.ts`
- `script/context.ts`
- `style/cssVars.ts`

这些文件会把 `compiler-sfc` 的“编排层”继续拆开，进入更细的宏处理和样式处理细节。
