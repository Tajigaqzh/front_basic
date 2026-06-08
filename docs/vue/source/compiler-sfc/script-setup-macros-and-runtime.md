# script setup 宏如何落成运行时代码

这篇文档专门解决一个高频困惑：

> `defineProps`、`defineEmits`、`defineModel` 这些看起来像函数调用的东西，最后到底去哪了？

如果你在读 `compiler-sfc` 时卡在 `compileScript.ts`，通常就是因为这里既有 Babel AST，又有宏语义，又有运行时代码生成，几层逻辑混在一起不容易拆开。

这篇只盯一条线：

> `script setup` 宏是怎么被识别、记录、再转成运行时 `props / emits / model` 选项的

主要对照这些源码：

1. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
2. [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts)
3. [script/defineProps.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineProps.ts)
4. [script/defineEmits.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineEmits.ts)
5. [script/defineModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineModel.ts)

---

## 1. 先看一个最小例子

```vue
<script setup lang="ts">
const props = defineProps<{ title: string; count?: number }>()
const emit = defineEmits(['change'])
const model = defineModel('value', { type: String })
</script>
```

你读源码时要先建立一个意识：

这里的 `defineProps / defineEmits / defineModel` 不是真的准备原样留到运行时。

`compileScript()` 看到它们时，真正想做的是：

1. 识别它们是不是编译期宏
2. 把宏的声明信息记到 `ctx`
3. 生成运行时 options 片段
4. 再把这些片段拼成组件可消费的代码

所以关键不在“调用结果是什么”，而在“调用里携带了什么声明信息”。

---

## 2. `compileScript()` 里的中控对象是谁

核心状态都放在 [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts) 的 `ScriptCompileContext` 里。

你可以把它理解成：

> 一次 `compileScript()` 执行期间的总账本

里面最关键的字段有：

- `propsDecl`
- `propsRuntimeDefaults`
- `propsTypeDecl`
- `emitsDecl`
- `modelsDecl`
- `runtimeProps`
- `runtimeEmits`
- `runtimeModelProps`
- `runtimeOptions`
- `helperImports`
- `bindingMetadata`
- `imports`
- `setup.hasDefinePropsCall`
- `setup.hasDefineEmitsCall`
- `setup.hasDefineModelCall`

也就是说，宏处理函数本身通常不直接输出最终代码，它们更多是在“往 `ctx` 里记信息”。

---

## 3. 宏是什么时候被识别的

在 [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts) 里，脚本 AST 会先被遍历一遍，逐条分析语句。

对于 `VariableDeclarator` 这一类声明，内部会去尝试匹配不同宏：

- `processDefineProps(...)`
- `processDefineEmits(...)`
- `processDefineModel(...)`
- 以及 `defineExpose / defineSlots / defineOptions`

它们的共同模式几乎一样：

1. 先判断 `decl.init` 是不是某个特定调用
2. 如果不是，返回 `false`
3. 如果是，把解析结果记录到 `ctx`
4. 返回 `true`

所以这些函数更像“宏识别器 + 信息提取器”。

---

## 4. `defineProps` 是怎么处理的

先看 [defineProps.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineProps.ts)

入口是：

```ts
processDefineProps(decl, source, ctx)
```

它先做两件事：

1. 判断是不是 `withDefaults(...)`
2. 否则判断是不是 `defineProps(...)`

### 4.1 纯运行时写法

比如：

```ts
const props = defineProps({
  title: String
})
```

这里 `processDefineProps()` 会直接从调用参数里提取运行时声明：

```ts
ctx.propsDecl = getRuntimeDeclFromMacroCall(propsCall, source)
```

也就是把对象字面量切片成字符串，存进 `ctx.propsDecl`。

此时可以把它理解成：

```text
defineProps({...})
  -> 识别为 props 宏
  -> 提取第一个参数
  -> 暂存成 runtime props 声明字符串
```

### 4.2 类型参数写法

比如：

```ts
const props = defineProps<{ title: string; count?: number }>()
```

这时没有运行时对象字面量，但有 TypeScript 类型参数。

源码会先保存类型 AST：

```ts
ctx.propsTypeDecl = typeDecl
```

如果当前还没得到运行时声明，就调用：

```ts
extractRuntimePropsFromType(ctx, typeDecl)
```

也就是说：

- `defineProps<T>()` 在源码里先是类型信息
- 之后再从类型信息反推出运行时 `props` 结构

例如会生成类似：

```ts
{
  "title": { type: String, required: true },
  "count": { type: Number, required: false }
}
```

这就是“类型宏落成运行时 options”的最直接体现。

### 4.3 解构写法为什么更复杂

比如：

```ts
const { title = 'x' } = defineProps<{ title?: string }>()
```

这时 `decl.id` 不再是 `Identifier`，而是 `ObjectPattern`。

源码会进入：

```ts
processPropsDestructure(ctx, decl.id)
```

原因是这种写法不只是声明 `props`，还顺带做了：

- 解构重命名
- 默认值
- 可能的剩余参数

所以后续还要额外把默认值合并回运行时 `props` 声明里。

### 4.4 `withDefaults` 为什么只是包一层

```ts
const props = withDefaults(defineProps<{ title?: string }>(), {
  title: 'x'
})
```

`processWithDefaults()` 的处理思路很直接：

1. 先拿到里面那层 `defineProps(...)`
2. 把它当成普通 `defineProps` 再处理一次
3. 再把默认值对象记到 `ctx.propsRuntimeDefaults`

所以 `withDefaults` 本质上不是另一套 props 宏体系，它更像：

> 给 `defineProps` 再补一份运行时默认值

---

## 5. `defineEmits` 是怎么处理的

看 [defineEmits.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineEmits.ts)

它比 `defineProps` 简单很多。

入口：

```ts
processDefineEmits(decl, source, ctx)
```

只做三件事：

1. 判断 `decl.init` 是不是 `defineEmits(...)`
2. 标记 `ctx.setup.hasDefineEmitsCall = true`
3. 把运行时声明切片到 `ctx.emitsDecl`

例如：

```ts
const emit = defineEmits(['change', 'submit'])
```

会得到类似：

```ts
ctx.emitsDecl = "['change', 'submit']"
```

后面真正汇总时，再由：

```ts
genRuntimeEmits(emitsDecl, modelNames)
```

把普通 emits 和 `defineModel` 生成的 `update:xxx` 事件合并起来。

---

## 6. `defineModel` 是怎么处理的

看 [defineModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineModel.ts)

这个宏本质上是在同时描述两件事：

1. 一个 model prop
2. 与之配套的 `update:xxx` emit

### 6.1 它先提取 `ModelDecl`

`processDefineModel()` 匹配成功后，不是直接生成字符串，而是先塞进：

```ts
ctx.modelsDecl.push(extractModelDecl(decl, source))
```

`ModelDecl` 里会存：

- `name`
- `local`
- `options`

比如：

```ts
const model = defineModel('value', { type: String })
```

大致会提取成：

```ts
{
  name: 'value',
  local: 'model',
  options: '{ type: String }'
}
```

### 6.2 后面再批量生成 model props

真正把 `modelsDecl[]` 变成运行时代码，是在：

```ts
genRuntimeModelProps(modelsDecl)
```

它会为每个 model 生成两类字段：

1. model 自身的 prop
2. 对应的 modifiers prop

例如 `value` 会生成：

```ts
{
  "value": { type: String },
  "valueModifiers": {}
}
```

如果名称是默认的 `modelValue`，修饰符字段就会变成：

```ts
modelModifiers
```

所以 `defineModel` 不是只对应一个 prop，它还隐含了 modifiers 配套结构。

### 6.3 它还会反向影响 emits

`compileScript.ts` 里生成 emits 时会调用：

```ts
genRuntimeEmits(
  ctx.emitsDecl,
  ctx.modelsDecl.map(model => model.name),
)
```

也就是把每个 model 名字变成：

```ts
'update:modelName'
```

因此 `defineModel` 最后会同时影响：

- `runtimeModelProps`
- `runtimeEmits`

---

## 7. 这些宏最后是怎么汇总的

在 [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts) 里，宏信息收集完之后，会统一落成这几步：

```ts
ctx.runtimeModelProps = genRuntimeModelProps(ctx.modelsDecl)
ctx.runtimeProps = mergeRuntimeProps(
  genRuntimeProps(ctx),
  ctx.runtimeModelProps,
)
ctx.runtimeEmits = genRuntimeEmits(
  ctx.emitsDecl,
  ctx.modelsDecl.map(model => model.name),
)
```

然后再组装：

```ts
ctx.runtimeOptions = [
  ctx.runtimeProps ? `props: ${ctx.runtimeProps}` : '',
  ctx.runtimeEmits ? `emits: ${ctx.runtimeEmits}` : '',
  ctx.optionsDecl ? `...${ctx.optionsDecl}` : '',
].filter(Boolean)
```

你可以把这一步理解成：

```text
defineProps / defineEmits / defineModel
  -> 各自提取声明信息
  -> 统一生成 runtime props / emits / model props
  -> 拼成组件 options 代码片段
```

---

## 8. 一个完整例子串起来看

假设源码是：

```ts
const { title = 'hello' } = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'fallback' }
)
const emit = defineEmits(['change'])
const model = defineModel('value', { type: String })
```

大致可以按这个顺序理解：

### 第一步：识别 `defineProps`

- 发现外层是 `withDefaults`
- 取出里面的 `defineProps`
- 记录 `propsTypeDecl`
- 从类型里推运行时 `props`
- 记录默认值对象到 `propsRuntimeDefaults`
- 因为左边是解构，还会记录解构默认值

### 第二步：识别 `defineEmits`

- 记录 `emitsDecl = ['change']`

### 第三步：识别 `defineModel`

- 记录 `modelsDecl = [{ name: 'value', options: '{ type: String }' }]`

### 第四步：统一生成运行时选项

会得到近似这样的结构：

```ts
props: mergeDefaults(
  mergeDefaults(
    { "title": { type: String, required: false } },
    { "title": 'hello' }
  ),
  { title: 'fallback' }
)

emits: mergeModels(
  ['change'],
  ['update:value']
)
```

这里不一定和正式版 Vue 的输出字符串逐字符一致，但理解层面上，已经能看出宏是怎样一步步变成组件运行时选项的。

---

## 9. 读这一层源码时最重要的理解

### 9.1 宏处理函数主要是在“记账”

不要把 `processDefineProps()` 这类函数想成“直接生成最终 JS”。

它们多数时候只是：

- 判断是不是这个宏
- 提取声明信息
- 把信息记到 `ctx`

真正的组装工作，后面才统一做。

### 9.2 `defineModel` 是最容易漏看的双向宏

它同时影响：

- props
- emits
- template 中 `v-model` 相关消费语义

如果你只盯着一个方向看，很容易觉得代码怎么绕来绕去。

### 9.3 `withDefaults` 和解构默认值是两套默认值来源

一套来自：

- `withDefaults(defineProps(), defaults)`

另一套来自：

- `const { foo = 1 } = defineProps()`

所以 `genRuntimeProps()` 里才需要把多路默认值再合并回来。

---

## 10. 下一步该接着读什么

如果这篇你已经看顺了，下一步建议接：

1. [bindingMetadata 和模板标识符分析](./binding-metadata-and-template-identifiers.md)
2. [compiler-sfc 总览](./compiler-sfc-overview.md)

然后再回源码细读：

1. [script/definePropsDestructure.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/definePropsDestructure.ts)
2. [script/resolveType.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/resolveType.ts)
3. [script/topLevelAwait.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/topLevelAwait.ts)
