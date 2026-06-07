# `compiler-dom` 源码主流程图

```text
DOM template
  -> parserOptions 扩展 HTML 规则
  -> baseCompile()
     + DOMNodeTransforms
     + DOMDirectiveTransforms
  -> DOM render code
```

## 关键调用链

1. `compile()` in `src/index.ts`
2. `parserOptions` in `src/parserOptions.ts`
3. `ignoreSideEffectTags()`
4. `transformStyle()`
5. `transformVHtml()` / `transformVText()` / `transformModel()` / `transformOn()` / `transformShow()`
6. `stringifyStatic()`

## 关键节点

- `compile()` 不是重写整套编译器，而是在 `compiler-core` 上注入 DOM 平台规则。
- `DOMNodeTransforms`
  处理平台特有节点逻辑，比如 style、Transition、HTML 嵌套校验。
- `DOMDirectiveTransforms`
  覆盖核心层默认指令行为，让 `v-model` / `v-on` 生成真正面向浏览器的运行时代码。
- `stringifyStatic()`
  把静态树尽量字符串化，给 DOM 插入走更快路径。

## 面试时怎么讲

- `compiler-dom` 的价值不在“再写一遍编译器”，而在“平台扩展点”。
- Vue 把平台差异放在 compiler-dom / runtime-dom，核心层才能复用到 SSR、自定义 renderer。

## 面试问法

- `compiler-dom` 相比 `compiler-core` 多做了什么？
- `v-model` 为什么要在 DOM 编译层单独处理？
- 为什么 `<script>` / `<style>` 这种标签要额外忽略副作用？

## 源码定位

- 入口：`src/index.ts`
- 平台解析选项：`src/parserOptions.ts`
- DOM 指令转换：`src/transforms/vModel.ts`、`src/transforms/vOn.ts`
- 静态字符串化：`src/transforms/stringifyStatic.ts`

## 答题模板

`compiler-dom` 本质上不是另一套编译器，而是在 `compiler-core` 的基础上注入 DOM 平台规则。它会补 HTML 解析选项、覆盖 `v-model` / `v-on` / `v-show` 这类平台相关指令转换，并在非浏览器构建里做静态字符串化优化。所以它解决的是“同一套模板语法，在浏览器平台应该怎么编译”这个问题。 
