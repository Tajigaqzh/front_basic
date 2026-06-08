# props 解构重写与类型转运行时 props

这篇文档专门拆 `compiler-sfc` 里两段很容易让人读着发散的逻辑：

1. `defineProps()` 解构为什么要重写源码
2. TypeScript `defineProps<T>()` 为什么最后还能生成运行时 `props`

如果你在读 `compileScript.ts` 时发现：

- 一会儿在记 `propsDestructuredBindings`
- 一会儿又在 `reparse()`
- 一会儿又从类型里反推运行时 `props`

那么这篇就是把这两条线拆开讲清楚。

主要对照源码：

1. [script/defineProps.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineProps.ts)
2. [script/definePropsDestructure.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/definePropsDestructure.ts)
3. [script/resolveType.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/resolveType.ts)
4. [script/context.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/context.ts)

---

## 1. 先看一个最容易卡住的例子

```vue
<script setup lang="ts">
const {
  title = 'hello',
  count: total = 0,
  ...rest
} = defineProps<{
  title?: string
  count?: number
  active: boolean
}>()

console.log(title, total, rest.active)
</script>
```

这段代码对开发者来说很自然，但对编译器来说同时包含了几层语义：

1. `defineProps<T>()` 是宏
2. 左边不是普通变量，而是对象解构
3. 解构里有默认值
4. `count` 被重命名成了 `total`
5. 还有剩余参数 `rest`

所以编译器不能只把它当成“声明了几个普通变量”，而必须额外记录：

- 每个本地变量来自哪个 props key
- 哪些 key 有默认值
- 哪些变量其实只是 props 的别名
- 后续脚本里访问这些局部变量时，要不要改写成真正的 props 访问表达式

---

## 2. `processDefineProps()` 先做的是“识别宏”

入口还是 [defineProps.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineProps.ts)。

`processDefineProps()` 首先解决的是：

> 这条声明是不是 `defineProps` 宏

如果是，它会先做三件事：

1. 记录 `ctx.setup.hasDefinePropsCall = true`
2. 提取运行时声明，或者保存类型声明
3. 如果左值是 `ObjectPattern`，进入 `processPropsDestructure()`

所以“解构逻辑”其实不是最外层入口，而是 `defineProps` 已经被识别之后的一个分支。

---

## 3. `processPropsDestructure()` 先记账，不立刻改代码

看 [definePropsDestructure.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/definePropsDestructure.ts)

`processPropsDestructure(ctx, declId)` 的第一步只是：

```ts
ctx.propsDestructureDecl = declId
```

也就是先把整段解构 AST 记下来。

然后它遍历每个解构项，把信息记录到：

- `ctx.propsDestructuredBindings`
- `ctx.bindingMetadata`
- `ctx.propsDestructureRestId`

### 3.1 普通同名解构

例如：

```ts
const { title } = defineProps(...)
```

会记录：

```text
title <- props.title
```

并把 `title` 标记成 `BindingTypes.PROPS`。

### 3.2 重命名解构

例如：

```ts
const { count: total } = defineProps(...)
```

会记录：

```text
total <- props.count
```

这时 `total` 不再是直接的 props key，而是 props 的本地别名，所以会标成：

```ts
BindingTypes.PROPS_ALIASED
```

并且还会往：

```ts
ctx.bindingMetadata.__propsAliases
```

里记一份：

```text
total -> count
```

这个额外映射很关键，因为模板或后续分析如果只看到 `total` 这个本地名，是不知道它原始对应哪个 props key 的。

### 3.3 带默认值的解构

例如：

```ts
const { title = 'hello' } = defineProps(...)
```

会把默认值表达式也记进：

```ts
ctx.propsDestructuredBindings[key].default
```

注意这里仍然只是“记账”，还没有立刻去生成新的代码。

### 3.4 剩余参数

例如：

```ts
const { title, ...rest } = defineProps(...)
```

`rest` 会被记进：

```ts
ctx.propsDestructureRestId
```

并标成：

```ts
BindingTypes.SETUP_REACTIVE_CONST
```

这里的语义是：

> 这个变量不是普通局部常量，而是一个和 props 访问关系更紧的响应式剩余对象

---

## 4. 为什么后面还要 `transformDestructuredProps()`

只记录绑定还不够，因为脚本后面可能会这样写：

```ts
console.log(title)
submit(total)
```

这些名字表面上像普通局部变量，但它们本质上来自 props 解构。

所以编译器需要决定：

> 后续对这些名字的引用，要不要重写成真实的 props 访问表达式？

这就是 [definePropsDestructure.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/definePropsDestructure.ts) 里 `transformDestructuredProps(ctx)` 的职责。

---

## 5. `transformDestructuredProps()` 在做什么

可以先把它理解成：

> 扫描整个 `script setup` AST，把那些“指向 props 解构绑定”的引用重写成 props 访问表达式

### 5.1 它先建立一套作用域系统

源码里会维护：

- `rootScope`
- `scopeStack`
- `currentScope`
- `excludedIds`
- `parentStack`

原因是编译器不能一看到 `title` 就盲目替换。

例如：

```ts
const { title } = defineProps(...)

function demo(title: string) {
  console.log(title)
}
```

函数参数里的 `title` 已经遮蔽了外层 props 解构绑定，这里就绝不能继续改写。

所以它必须先维护一套近似 JS 作用域的可见性模型，区分：

- 哪些名字来自 props 解构
- 哪些名字只是内部新声明的局部变量

### 5.2 `excludedIds` 是为了避免误替换

源码里会把一些标识符放进 `excludedIds`，例如：

- 真正的局部声明
- `defineProps(...)` 那个解构声明本身里的 id

因为这些位置的标识符不是“引用”，而是“声明位”。

如果把声明位也重写，代码就会被改坏。

### 5.3 真正的改写发生在 `rewriteId()`

当 walker 遍历到一个 `Identifier`，并且满足：

- 它是被引用的标识符
- 不在 `excludedIds` 里
- 当前作用域里它对应的是 props 解构绑定

就会调用：

```ts
rewriteId(node, parent)
```

这里会用：

```ts
genPropsAccessExp(propsLocalToPublicMap[id.name])
```

生成真正的 props 访问表达式。

也就是说，本地变量名 `title` 最终会被改写成“读取 props.title 的表达式”。

### 5.4 为什么还要特殊处理 shorthand

例如：

```ts
const obj = { title }
```

如果直接把 `title` 替换掉，可能会破坏对象字面量 shorthand 结构。

所以源码会区分这种情况，把它改成更接近：

```ts
const obj = { title: props.title }
```

这就是 `rewriteId()` 里那段 `parent.shorthand` 分支的目的。

### 5.5 为什么改完还要重新 parse

`transformDestructuredProps()` 修改的是 `ctx.content` 这段源码字符串。

源码字符串变了，原先的 Babel AST 就已经不准确了。

所以 `compileScript.ts` 里会接着调用：

```ts
ctx.reparse()
```

这一步非常关键。

也就是说，这条链是：

```text
先识别解构绑定
  -> 再按作用域规则重写源码
  -> 再重新 parse 成新的 AST
```

所以你看到 `reparse()` 不要觉得绕，它是这类源码级改写之后的必需步骤。

---

## 6. TypeScript 类型为什么能转成运行时 props

现在切到第二条线，看 [resolveType.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/resolveType.ts)

核心问题是：

> `defineProps<T>()` 没有传运行时对象，编译器怎么还能生成 `props` 选项？

答案是：

1. 先从 TypeScript AST 里把 props 成员解析出来
2. 再根据每个成员的类型，推断运行时构造器类型

---

## 7. `resolveTypeElements()` 先把类型成员摊平

入口：

```ts
resolveTypeElements(ctx, node)
```

它当前主要处理这几种输入：

- `TSTypeLiteral`
- `TSInterfaceDeclaration`
- `TSTypeAnnotation`

最终返回：

```ts
{
  props: Record<string, TSPropertySignature | TSMethodSignature>,
  calls?: TSMethodSignature[]
}
```

你可以把它理解成：

> 把 TS 类型声明先转成一个“按 key 索引的属性表”

例如：

```ts
type Props = {
  title: string
  count?: number
}
```

会大致转成：

```text
props:
  title -> TSPropertySignature
  count -> TSPropertySignature
```

这样后面生成运行时 `props` 时，就不用再反复在类型树里找成员了。

---

## 8. `inferRuntimeType()` 决定运行时应该落什么类型

`inferRuntimeType(ctx, node)` 的职责是：

> 把一个 TS 类型节点，映射成运行时 `props.type` 可用的类型构造器集合

例如：

- `string` -> `String`
- `number` -> `Number`
- `boolean` -> `Boolean`
- `Array<T>` / `T[]` -> `Array`
- `() => void` -> `Function`
- 对象字面量类型 -> `Object`

### 8.1 联合类型会合并去重

例如：

```ts
string | number
```

会递归得到：

```ts
['String', 'Number']
```

然后去重。

这样最后生成运行时 props 时，就可能落成：

```ts
type: [String, Number]
```

### 8.2 推不出来时就退到更保守的类型

例如某些 `TSTypeReference` 无法精确解析时，当前这份教学实现通常会退成：

- `Object`
- 或 `null`

这说明它的目标不是“完整还原 TypeScript 全部语义”，而是给出足够用于运行时 `props` 的近似分类。

---

## 9. 运行时 `props` 最终是怎么组出来的

回到 [defineProps.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/defineProps.ts)

`extractRuntimePropsFromType()` 会：

1. 调 `resolveTypeElements()`
2. 遍历每个 props 条目
3. 用 `inferRuntimeType()` 推断 `type`
4. 根据 `optional` 决定 `required`
5. 拼出运行时 `props` 对象字符串

例如：

```ts
defineProps<{
  title: string
  count?: number
}>()
```

大致会生成：

```ts
{
  "title": { type: String, required: true },
  "count": { type: Number, required: false }
}
```

所以这条链的本质是：

```text
TS 类型 AST
  -> 类型成员表
  -> 每个成员的运行时类型推断
  -> 运行时 props 声明字符串
```

---

## 10. 把两条线放在一起看

现在把“类型推断”和“解构重写”放到一个例子里：

```ts
const { count: total = 0 } = defineProps<{
  count?: number
}>()

console.log(total)
```

编译器大致会做：

### 第一步：识别 `defineProps<T>()`

- 记录这是 props 宏
- 保存类型参数 AST

### 第二步：从类型生成运行时 `props`

- `count?: number`
- 推断成 `{ "count": { type: Number, required: false } }`

### 第三步：记录解构绑定

- 本地 `total` 对应公开 key `count`
- 默认值是 `0`
- `total` 标记成 `PROPS_ALIASED`

### 第四步：重写后续引用

`console.log(total)` 会被改写成读取真正 props `count` 的表达式。

### 第五步：重新 parse

- 让后续分析基于改写后的脚本继续走

这就是为什么这块源码看起来会在“类型层”“绑定层”“字符串改写层”来回切换。

---

## 11. 读这一块源码时最值得抓的主线

如果你容易被细节淹没，建议一直抓住这两句话：

1. 解构这条线是在回答“本地变量和真实 props key 的对应关系是什么”
2. 类型这条线是在回答“没有运行时对象时，props 选项怎么补出来”

把这两条分开看，再回去读代码，难度会明显低很多。

---

## 12. 下一步建议

接下来最适合继续读的是：

1. [script setup 宏如何落成运行时代码](./script-setup-macros-and-runtime.md)
2. [bindingMetadata 和模板标识符分析](./binding-metadata-and-template-identifiers.md)
3. [顶层 await 与 CSS vars 辅助链路](./top-level-await-and-css-vars.md)
