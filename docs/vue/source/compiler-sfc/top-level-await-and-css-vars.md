# 顶层 await 与 CSS vars 辅助链路

这篇文档讲 `compiler-sfc` 里两条“不是主角，但你读源码时很容易撞上”的辅助链：

1. `script setup` 里的顶层 `await` 是怎么被改写的
2. SFC 里的 `v-bind(...)` CSS 变量是怎么被扫描和串进编译流程的

这两块都不是 `.vue` 编译的主干，但如果不单独拎出来，你读 `compileScript.ts` 和 `compileStyle.ts` 时会觉得很多分支像突然插进来的杂音。

主要对照源码：

1. [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
2. [script/topLevelAwait.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/topLevelAwait.ts)
3. [parse.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/parse.ts)
4. [compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)
5. [compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)
6. [style/cssVars.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/style/cssVars.ts)

---

## 1. 顶层 `await` 为什么要特殊处理

先看一个例子：

```vue
<script setup>
const user = await fetchUser()
</script>
```

从开发者视角，这只是 `script setup` 里的一个顶层异步表达式。

但从编译器视角，它会引出一个问题：

> setup 执行过程中如果遇到异步挂起，当前组件上下文怎么恢复？

所以 `compiler-sfc` 不能只简单保留 `await`，而是要把它包成带上下文恢复的形式。

---

## 2. `compileScript()` 是怎么识别顶层 `await` 的

在 [compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts) 里，会先扫一遍 `ctx.program.body`。

它主要检查两种情况：

1. `ExpressionStatement` 直接是 `AwaitExpression`
2. 变量声明的 `init` 是 `AwaitExpression`

一旦碰到，就会：

```ts
ctx.hasTopLevelAwait = true
```

也就是说，它先不急着改写，而是先标记：

> 这份 `script setup` 里存在顶层 await，后面要走特殊生成路径

---

## 3. 为什么不是发现一个就地改一个

因为 `compileScript()` 的整体流程是分阶段的：

1. 先分析 imports / 宏 / bindings
2. 再看是否需要处理 props 解构
3. 再看是否需要处理顶层 `await`
4. 最后统一生成运行时 options 和脚本内容

也就是说，它不希望在最开始遍历语句时就把源码改得七零八落，而是先判断“需不需要改”，再统一走改写分支。

---

## 4. `processAwait()` 到底生成了什么

真正的改写核心在 [topLevelAwait.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/script/topLevelAwait.ts)

入口：

```ts
processAwait(ctx, node, needSemi, isStatement)
```

它返回的不是 AST，而是一段字符串模板，大致会长成：

```ts
(
  ([__temp,__restore] = _withAsyncContext(() => expr)),
  __temp = await __temp,
  __restore(),
  __temp
)
```

如果是纯语句场景，则不会把结果值再回传给 `__temp`。

你可以把这个形状理解成：

1. 先通过 `withAsyncContext(...)` 包住异步表达式
2. 拿到临时值和恢复函数
3. `await` 真正的异步结果
4. 在继续执行前恢复组件上下文

所以这不是单纯的语法降级，而是：

> 给顶层 `await` 补一层“异步期间的上下文保护壳”

---

## 5. 为什么还要判断 `containsNestedAwait`

源码里有一行：

```ts
const containsNestedAwait = /\bawait\b/.test(argument)
```

如果参数表达式内部本身还包含 `await`，就会把包裹函数写成：

```ts
async () => argument
```

否则就是普通：

```ts
() => argument
```

这一步的本质是为了保证包装函数本身和原表达式的异步语义一致。

也就是说，编译器不是只看最外层那个 `await` 关键字，还会顺手考虑被包裹表达式内部是否还嵌套了异步。

---

## 6. 为什么改完还要重新 parse

和 props 解构那条线一样，顶层 `await` 改写本质上也会改动 `ctx.content`。

所以 `compileScript.ts` 里会在改写后再做：

```ts
ctx.reparse()
```

原因完全一样：

> 源码字符串改了，原来的 Babel AST 就不再可信，后续所有分析都要基于新源码重新 parse

这也是 `compiler-sfc` 很典型的一种工作方式：

- 先分析
- 必要时改源码字符串
- 再重新 parse

---

## 7. 顶层 `await` 还会影响 helper imports

`compileScript.ts` 里如果发现有顶层 `await`，会把：

```ts
withAsyncContext
```

加入 `ctx.helperImports`。

也就是说，顶层 `await` 不是只影响局部表达式改写，它还会影响最终脚本头部需要注入哪些运行时 helper。

所以这条链完整看是：

```text
发现 top-level await
  -> 改写 await 表达式
  -> 重新 parse
  -> 注入 withAsyncContext helper
```

---

## 8. 再看另一条辅助链：CSS vars

现在切到 style 侧。

SFC 里有一种很特别的写法：

```vue
<style scoped>
.card {
  color: v-bind(textColor);
}
</style>
```

这里的 `v-bind(textColor)` 不是普通 CSS 语法，而是 Vue 在 SFC 里扩展出来的一种“把脚本值注入样式”的机制。

所以编译器需要解决两个问题：

1. 样式里到底声明了哪些 CSS 变量依赖
2. 这些依赖如何在模板 / SSR / 样式产物之间保持一致

---

## 9. `parseCssVars()` 先做的是字符串级扫描

看 [style/cssVars.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/style/cssVars.ts)

`parseCssVars(source)` 当前实现比较直接：

1. 如果传入的是 `SFCDescriptor`，就把所有 style 内容拼起来
2. 用正则去匹配：

```ts
v-bind(...)
```

3. 把里面的表达式内容取出来

例如：

```css
color: v-bind(textColor);
background: v-bind(themeBg);
```

会得到：

```ts
['textColor', 'themeBg']
```

这说明这份教学实现里，CSS vars 分析先保留了最关键的“依赖收集”主干。

---

## 10. CSS vars 在 `parse.ts` 阶段有什么意义

虽然当前截取到的 `parse.ts` 前半段主要在拆 block，但它一开始就引入了：

```ts
import { parseCssVars } from './style/cssVars'
```

这意味着 SFC descriptor 这一层就会关心：

> 这个组件整体依赖了哪些 CSS vars

也就是说，CSS vars 不是 compileStyle 结束后才临时出现的信息，而是 SFC 级元信息的一部分。

这样后面的 `compileTemplate()`、SSR 分支、样式处理分支都能共享它。

---

## 11. `compileStyle()` 里 CSS vars 是怎么落地的

看 [compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)

在完成：

- preprocess
- trim
- scoped 改写

之后，代码会调用：

```ts
const cssVars = parseCssVars(code)
```

如果发现存在 CSS vars，就会：

1. 取出 `shortId`
2. 往 `dependencies` 里加一个：

```ts
css-vars:${shortId}
```

3. 再把 `genCssVarsFromList(...)` 的结果附加到产物末尾

你可以把它理解成：

> style 编译结果除了原始 CSS 本身，还会额外携带一份“这个组件需要哪些 CSS 变量绑定”的注记

---

## 12. `genCssVarsFromList()` 生成的是什么

还是看 [style/cssVars.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/style/cssVars.ts)

`genCssVarsFromList(vars, id, isProd, isSSR)` 会把变量列表转成对象字面量字符串。

例如：

```ts
genCssVarsFromList(['textColor'], 'abc123')
```

会生成近似：

```ts
{
  "--abc123-textColor": (textColor)
}
```

如果是 SSR 模式，则 key 前缀会变成 `:--` 这一套 SSR 使用的形状。

所以这里的重点不是“真的在 style 里执行 JS”，而是：

> 把样式里声明过的响应式变量需求，转换成后续编译阶段可消费的结构化描述

---

## 13. CSS vars 为什么还会影响 `compileTemplate()`

看 [compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)

当走 SSR 编译路径时，会把：

```ts
ssrCssVars
```

传给模板编译选项，并通过：

```ts
genCssVarsFromList(ssrCssVars, shortId, isProd, true)
```

生成 SSR 用的 CSS vars 代码片段。

这说明 CSS vars 不是纯 style 侧概念，而是会跨到 template / SSR codegen 里。

所以完整关系是：

```text
style 中的 v-bind(...)
  -> 收集 vars 列表
  -> SFC 级记录
  -> style 编译阶段生成 vars 描述
  -> SSR template 编译阶段也可能消费这份列表
```

---

## 14. 把两条辅助链放到整体流程里

现在把“顶层 await”和“CSS vars”都放回 SFC 总流程：

### 顶层 await 线

```text
compileScript()
  -> 扫描 program.body
  -> 发现 top-level await
  -> 改写源码字符串
  -> reparse()
  -> 注入 withAsyncContext helper
```

### CSS vars 线

```text
parse()/descriptor
  -> 收集样式中的 v-bind(...) 依赖

compileStyle()
  -> 再扫描 style code
  -> 生成 css vars 描述 / dependencies

compileTemplate(ssr)
  -> 用同一份 vars 列表生成 SSR 侧 css vars 代码
```

你会发现它们虽然不在主链正中央，但都体现了 `compiler-sfc` 的一个特点：

> 它经常在不同 block 之间搬运额外的编译上下文

---

## 15. 读这两块源码时最值得抓的点

### 15.1 顶层 `await` 的重点不是语法，而是上下文恢复

不要只把它理解成“把 await 包一层”。

真正关键的是：

- 异步执行期间组件上下文不能丢
- 所以要引入 `withAsyncContext`

### 15.2 CSS vars 的重点不是正则，而是跨 block 信息流

`parseCssVars()` 本身并不复杂，复杂的是：

- style 里声明出来的依赖
- 怎么变成 SFC 级信息
- 又怎么被 style 和 SSR template 两边复用

---

## 16. 下一步建议

如果你已经看懂这篇，接下来最值得继续的是：

1. [compiler-sfc 总览](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/compiler-sfc-overview.md)
2. [props 解构重写与类型转运行时 props](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/props-destructure-and-type-resolution.md)
3. [script setup 宏如何落成运行时代码](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/script-setup-macros-and-runtime.md)
