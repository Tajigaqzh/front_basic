# `compiler-dom` 中文阅读顺序

```text
模板字符串
  -> parse() / parserOptions
  -> baseCompile() 进入 compiler-core 主流程
  -> 注入 DOMNodeTransforms / DOMDirectiveTransforms
  -> 生成面向 runtime-dom 的 render 代码
```

## 先抓住一句话

`compiler-dom` 不是重写了一套编译器，而是在 `compiler-core` 上注入浏览器平台规则。

它主要负责三件事：

- 按 HTML 规则解析模板，而不是只按平台无关语法解析。
- 把 DOM 专属指令编译成浏览器运行时需要的 props / helper。
- 在合适场景下做 DOM 平台优化，例如静态字符串化。

## 推荐阅读顺序

1. `src/index.ts`
   这里是入口。先看 `compile()` 怎么把 `parserOptions`、`DOMNodeTransforms`、`DOMDirectiveTransforms` 注入到 `baseCompile()`。

2. `src/parserOptions.ts`
   这里决定模板按什么 HTML 规则解析，包括：
   - 哪些是原生标签
   - 哪些是 void tag
   - `<svg>` / `<math>` 的命名空间切换
   - `Transition` / `TransitionGroup` 识别

3. `src/runtimeHelpers.ts`
   这里是“编译期 symbol”和“运行时 helper 名称”的映射表。
   例如 `V_MODEL_TEXT` 最后会对应到运行时里的 `vModelText`。

4. `src/transforms/ignoreSideEffectTags.ts`
   这里先把 `<script>` 和 `<style>` 这类副作用标签从组件模板里移除。

5. `src/transforms/transformStyle.ts`
   这里会把静态 `style="..."` 提前改造成等价的 `:style="{...}"`。

6. 指令转换
   重点看这几个文件：
   - `src/transforms/vHtml.ts`
   - `src/transforms/vText.ts`
   - `src/transforms/vShow.ts`
   - `src/transforms/vModel.ts`
   - `src/transforms/vOn.ts`

   阅读重点：
   - `v-html` 为什么转成 `innerHTML`
   - `v-text` 为什么转成 `textContent`
   - `v-show` 为什么必须依赖运行时指令
   - `v-model` 为什么要按 `input[type=radio] / checkbox / select / textarea` 分流
   - `v-on` 怎么把修饰符拆成 `withModifiers`、`withKeys` 和事件名后缀

7. 开发期校验
   相关文件：
   - `src/transforms/Transition.ts`
   - `src/transforms/validateHtmlNesting.ts`
   - `src/htmlNesting.ts`
   - `src/errors.ts`

   这里主要看：
   - `<Transition>` 为什么只能包一个有效子节点
   - 非法 HTML 嵌套为什么只告警不阻断编译
   - DOM 编译错误码是怎么从 `compiler-core` 扩展出来的

8. `src/transforms/stringifyStatic.ts`
   这是偏优化的代码，建议最后看。它会把连续静态树压成 `createStaticVNode("...")`，让 runtime-dom 走更快的 DOM 创建路径。

## 从调用链理解一遍

1. 模板进入 `compile()`
2. `compile()` 调用 `baseCompile()`
3. `baseCompile()` 内部先 parse
4. parse 时使用 `parserOptions`
5. transform 阶段执行 DOM 节点转换和 DOM 指令转换
6. codegen 阶段根据 `runtimeHelpers.ts` 里注册的 helper 生成导入和调用
7. 最终得到面向 `runtime-dom` 的 render 代码

## 面试时可以怎么讲

可以直接用下面这段话：

`compiler-dom` 的作用不是重做编译器，而是把浏览器平台差异接到 `compiler-core` 的扩展点里。它一方面补了 HTML 解析规则，比如原生标签识别、命名空间切换、实体解码；另一方面覆盖了 DOM 专属指令转换，比如 `v-model`、`v-on`、`v-show`。最后它还会做一些浏览器平台优化，例如静态树字符串化。所以它解决的核心问题是：同样一份 Vue 模板，在浏览器平台应该被编译成什么样的 render 逻辑。

## 可以带着问题去读

- `compiler-dom` 相比 `compiler-core` 多补了哪些平台能力？
- 为什么 `v-model` 必须在 DOM 层细分到不同表单控件？
- 为什么 `v-on` 的修饰符有的改事件名，有的包运行时 helper？
- 为什么 `<script>` / `<style>` 要在编译期直接忽略？
- 为什么 `stringifyStatic()` 只在 Node 侧编译启用？
