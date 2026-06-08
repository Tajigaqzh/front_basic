# bindingMetadata 和模板标识符分析

这篇文档专门解释 `compiler-sfc` 里最关键、也最容易被低估的一条链：

> `compileScript()` 为什么要分析绑定？模板为什么又会反过来影响 script 编译？

如果你只把 `compiler-sfc` 看成“把 `.vue` 拆成三块”，那读到这里通常会突然觉得代码变复杂了。原因是从这一层开始，`script` 和 `template` 已经不是彼此独立的。

核心源码对照：

1. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
2. [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts)
3. [script/analyzeScriptBindings.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/analyzeScriptBindings.ts)
4. [script/importUsageCheck.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/importUsageCheck.ts)

---

## 1. 先记住一句话

模板里写的每个名字，编译器都要知道它“属于谁”。

比如：

```vue
<script setup>
import { ref } from 'vue'
import ChildCard from './ChildCard.vue'

const count = ref(0)
const title = 'hello'
</script>

<template>
  <ChildCard :value="count" @change="title = 'x'" />
</template>
```

模板里出现了：

- `ChildCard`
- `count`
- `title`

这三个名字对模板编译器来说，含义并不一样：

- `ChildCard` 是组件引用
- `count` 可能是 setup 绑定，可能还是 ref
- `title` 是可直接访问的 setup 变量

如果编译器分不清这些名字的来源，后面生成的模板访问逻辑就会不准确。

所以 `bindingMetadata` 的任务就是：

> 给模板里的名字标注来源和绑定类型

---

## 2. `bindingMetadata` 存在哪里

在 [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts) 里，`ScriptCompileContext` 有一个关键字段：

```ts
bindingMetadata: BindingMetadata = {}
```

它本质上是一个：

```ts
Record<string, BindingTypes>
```

也就是：

- key: 标识符名
- value: 这个名字的绑定类型

例如可能出现：

- `PROPS`
- `SETUP_CONST`
- `SETUP_LET`
- `SETUP_MAYBE_REF`
- `DATA`
- `OPTIONS`

你可以把它想成模板编译阶段使用的“变量户口本”。

---

## 3. 这些绑定信息是怎么分析出来的

核心入口看 [analyzeScriptBindings.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/analyzeScriptBindings.ts)

### 3.1 `compileScript()` 会先扫脚本 AST

无论是普通 script 还是 script setup，都会先进入绑定分析逻辑。

遍历的重点语句类型主要有：

- `ImportDeclaration`
- `VariableDeclaration`
- `FunctionDeclaration`
- `ClassDeclaration`

也就是说，第一层绑定分析并不关心模板，只关心：

> 这个脚本里声明了哪些顶层名字

### 3.2 import 会被记成绑定

例如：

```ts
import ChildCard from './ChildCard.vue'
import { ref } from 'vue'
```

`analyzeImport()` 会把它们登记到：

- `ctx.imports`
- `ctx.bindingMetadata`

其中 `ctx.imports` 保存更完整的信息：

- `imported`
- `local`
- `source`
- `isType`
- `isFromSetup`
- `isUsedInTemplate`

而 `bindingMetadata` 主要记录“绑定类型”。

例如运行时 import 往往先标成：

```ts
BindingTypes.SETUP_MAYBE_REF
```

类型导入则更接近普通常量语义。

### 3.3 变量声明也会被登记

例如：

```ts
const title = 'hello'
let count = 0
```

`analyzeDeclarator()` 会根据声明种类记成：

- `const` -> `SETUP_CONST`
- `let` -> `SETUP_LET`

这一步虽然很朴素，但它直接决定模板里访问这些变量时，编译器如何看待它们的可变性和语义类别。

### 3.4 普通 Options API 组件也会分析

这个文件不只服务 `script setup`。

在 `analyzeNormalScriptBindings()` 里，如果发现：

```ts
export default {
  props: ...,
  inject: ...,
  computed: ...,
  methods: ...,
  data() { return ... },
  setup() { return ... }
}
```

它也会从对象结构里把名字提出来，再分别登记成：

- `PROPS`
- `OPTIONS`
- `DATA`
- `SETUP_MAYBE_REF`

所以 `bindingMetadata` 并不是 `script setup` 专属概念，而是模板编译与脚本语义之间的通用桥梁。

---

## 4. `ctx.markBinding()` 才是真正落账的地方

你读这层源码时，最值得盯住的一个小函数是 [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts) 里的：

```ts
markBinding(name: string, type: BindingTypes) {
  this.bindingMetadata[name] = type
}
```

大量分析逻辑最后都会收敛到这里。

也就是说，不管来源是：

- import
- const / let
- function
- class
- options API
- props 宏

最后都要落成：

```text
名字 -> 绑定类别
```

所以你读源码时，如果分支太多，可以不断问自己：

> 这个分支最后有没有把某个名字记进 `bindingMetadata`？记成了什么类型？

这样就不容易迷路。

---

## 5. 只分析脚本还不够，为什么还要看模板

真正让 `compiler-sfc` 复杂起来的，是它不只分析“脚本定义了什么”，还分析“模板实际用了什么”。

这部分主要在 [importUsageCheck.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/importUsageCheck.ts)

核心问题是：

> 脚本里 import 了很多东西，但模板到底用了哪些？

例如：

```vue
<script setup>
import ChildCard from './ChildCard.vue'
import UnusedComp from './UnusedComp.vue'
const title = 'hello'
</script>

<template>
  <ChildCard :label="title" />
</template>
```

这里模板只真正消费了：

- `ChildCard`
- `title`

所以编译器需要知道：

- 哪些 import 需要为模板保留
- 哪些组件名是通过标签名推断出来的
- 哪些 `v-model` 变量被模板使用过

---

## 6. 模板标识符分析是怎么做的

`resolveTemplateAnalysisResult()` 会读取 `sfc.template.ast`，然后递归遍历模板节点。

它重点收集两类结果：

1. `usedIds`
2. `vModelIds`

你可以先把它理解成：

```text
模板到底引用了哪些名字
模板里的 v-model 又绑定了哪些变量
```

### 6.1 组件标签也会转成标识符

例如模板里有：

```vue
<ChildCard />
```

如果它不是原生标签，也不是内建组件，就会把它转成：

- `childCard`
- `ChildCard`

这样做的原因是模板里的标签写法，最终要和脚本里的本地变量名匹配起来。

所以模板分析并不只盯表达式，也会盯“组件标签名本身”。

### 6.2 指令也可能引入名字

例如自定义指令：

```vue
<div v-focus />
```

会被记录成类似：

```ts
vFocus
```

因为运行时需要从上下文里拿到这个自定义指令实现。

### 6.3 表达式里的标识符会被抽出来

例如：

```vue
<div :title="title" @click="submit(count)" />
```

模板分析会把表达式 AST 里的标识符走一遍，提取出：

- `title`
- `submit`
- `count`

这一步底层靠的是：

```ts
walkIdentifiers(...)
```

也就是说，它不是做字符串搜索，而是基于表达式 AST 提取名字。

### 6.4 `v-for` 和动态参数也要单独处理

例如：

```vue
<div v-for="item in list" :[keyName]="value" />
```

这里模板分析会额外记录：

- `list`
- `keyName`
- `value`

因为它们未必都在普通 `prop.exp` 的直线路径里。

### 6.5 `v-model` 为什么单独记一份

例如：

```vue
<input v-model="count" />
```

源码会单独把 `count` 记进 `vModelIds`。

这是因为 `v-model` 不只是普通变量使用，它在 SFC 编译里还和：

- `defineModel`
- model props
- `update:xxx` emits

这些机制存在更强的语义联动。

所以单独记账，后面更好做针对性处理。

---

## 7. `compileScript()` 如何把两边信息接起来

在 [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts) 里，会有这样几步：

```ts
const usedIdentifiers = resolveTemplateUsedIdentifiers(descriptor)
const vModelIdentifiers = resolveTemplateVModelIdentifiers(descriptor)
```

然后再逐个 import 判断：

```ts
ctx.imports[local].isUsedInTemplate = isImportUsed(local, descriptor)
```

最后组装成：

```ts
ctx.templateUsage = {
  usedImports: ...,
  usedIdentifiers: [...usedIdentifiers],
  vModelIdentifiers: [...vModelIdentifiers],
}
```

这说明 `compileScript()` 的最终结果里，不只是脚本内容本身，还额外带着一份：

> 模板如何消费这个脚本的摘要信息

所以真正的链路是：

```text
script AST
  -> bindingMetadata

template AST
  -> usedIdentifiers / usedImports / vModelIdentifiers

两边结果
  -> 汇总进 ScriptCompileResult
```

---

## 8. 一个例子把 `bindingMetadata` 和模板分析一起看

还是看这个例子：

```vue
<script setup>
import ChildCard from './ChildCard.vue'
import { ref } from 'vue'

const count = ref(0)
const title = 'hello'
function submit(value) {}
</script>

<template>
  <ChildCard :value="count" @change="submit(count)" />
  <input v-model="count" />
  <div>{{ title }}</div>
</template>
```

### 第一步：脚本绑定分析

大致会登记出：

```text
ChildCard -> SETUP_MAYBE_REF
ref -> SETUP_MAYBE_REF
count -> SETUP_CONST
title -> SETUP_CONST
submit -> SETUP_CONST
```

### 第二步：模板使用分析

模板里会收集到：

```text
usedIdentifiers:
- ChildCard
- count
- submit
- title

vModelIdentifiers:
- count
```

### 第三步：import 使用情况回填

例如：

- `ChildCard.isUsedInTemplate = true`
- `ref.isUsedInTemplate = false`

这一步的意义是：

- `ChildCard` 是模板真正消费的组件引用
- `ref` 只是脚本内部实现细节，模板并不需要它

---

## 9. 为什么这条链对模板编译很关键

当后面 `compileTemplate()` 把模板交给 `compiler-dom / compiler-core` 时，模板编译器并不是在“盲编译”。

它实际依赖脚本阶段提前准备好的这些上下文：

- 哪些名字是 props
- 哪些名字来自 setup
- 哪些名字可能是 ref
- 哪些组件 / 指令 / import 真的被模板使用

也就是说，模板编译的正确性，不只取决于模板自身 AST，还取决于脚本分析质量。

这也是为什么：

> `compiler-sfc` 不能只是把三个 block 分开编，而必须在中间做一层绑定和消费关系分析

---

## 10. 读源码时最值得抓住的主线

如果你读这一层容易散，建议一直抓住下面这条线：

1. `analyzeScriptBindings()` 先把脚本定义过的名字记下来
2. `resolveTemplateUsedIdentifiers()` 再把模板实际用到的名字记下来
3. `isImportUsed()` 把“定义”和“使用”对上
4. `bindingMetadata + templateUsage` 一起成为模板编译输入背景

只要你一直从“名字是怎么被登记、怎么被消费”这个视角看，`compiler-sfc` 这块会比直接从大段代码切入清楚很多。

---

## 11. 下一步建议

如果你已经看懂这篇，下一步建议回到这三处源码细读：

1. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
2. [script/analyzeScriptBindings.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/analyzeScriptBindings.ts)
3. [script/importUsageCheck.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/importUsageCheck.ts)

然后再接：

1. [compiler-sfc 总览](./compiler-sfc-overview.md)
2. [script setup 宏如何落成运行时代码](./script-setup-macros-and-runtime.md)
