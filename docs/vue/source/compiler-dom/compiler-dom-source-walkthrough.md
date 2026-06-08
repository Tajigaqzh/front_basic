# compiler-dom 源码顺读图

这篇文档不重复讲 `compiler-dom` 的宏观定位，而是回答一个更实用的问题：

> 如果你现在要直接读 `compiler-dom` 源码，应该按什么顺序读，分别抓什么重点？

这篇默认你已经看过：

- [compiler-dom 如何扩展 compiler-core](./compiler-dom-on-top-of-compiler-core.md)

---

## 1. 先记住 `compiler-dom` 在干什么

`compiler-dom` 不是重写整条模板编译链。

它做的是：

1. 给 `compiler-core` 提供 DOM 平台的 `parserOptions`
2. 注入 DOM 平台特有的 `nodeTransforms`
3. 覆盖 DOM 平台特有的 `directiveTransforms`
4. 在少数场景下补平台 runtime helper 和错误体系

所以读源码时，你要一直带着这个视角：

> 这不是另一套编译器，而是在 core 的 transform/codegen 钩子点上做平台特化

---

## 2. 推荐源码顺序

建议按下面顺序读：

1. [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)
2. [compiler-dom/src/parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)
3. [compiler-dom/src/transforms/ignoreSideEffectTags.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/ignoreSideEffectTags.ts)
4. [compiler-dom/src/transforms/transformStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/transformStyle.ts)
5. [compiler-dom/src/transforms/vHtml.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vHtml.ts)
6. [compiler-dom/src/transforms/vText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vText.ts)
7. [compiler-dom/src/transforms/vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)
8. [compiler-dom/src/transforms/vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vOn.ts)
9. [compiler-dom/src/transforms/vShow.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vShow.ts)
10. [compiler-dom/src/transforms/Transition.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/Transition.ts)
11. [compiler-dom/src/transforms/validateHtmlNesting.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/validateHtmlNesting.ts)
12. [compiler-dom/src/transforms/stringifyStatic.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/stringifyStatic.ts)

如果你按这个顺序读，脑子里最容易形成完整图。

---

## 3. 第一站：`index.ts`

先看：

- [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)

只抓三件事：

1. `compile()` 最终仍然调用 `baseCompile(...)`
2. `parse()` 最终仍然调用 `baseParse(...)`
3. DOM 的平台差异主要通过 `parserOptions / nodeTransforms / directiveTransforms` 注进去

这里你要建立的第一印象是：

```ts
compiler-core = 骨架
compiler-dom  = 配置 + transform 覆盖层
```

如果这一步没建立好，后面会一直误以为 DOM 编译器是另一条平行链。

---

## 4. 第二站：`parserOptions.ts`

看：

- [compiler-dom/src/parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)

这一步重点不是记每个 API 名字，而是理解：

> 浏览器模板在 parse 阶段就已经和“纯核心模板”不同了

最值得盯住的是：

- `parseMode: 'html'`
- `isNativeTag`
- `isVoidTag`
- `isPreTag`
- `isIgnoreNewlineTag`
- `decodeEntities`
- `getNamespace`
- `isBuiltInComponent`

其中最容易低估的是 `getNamespace`。

这块决定了：

- HTML / SVG / MathML 子树切换
- `foreignObject` / `annotation-xml` 这类特殊节点如何切回 HTML

也就是说，AST 上的 `ns` 信息并不是 parser 顺手带的，它是 DOM 平台规则算出来的。

---

## 5. 第三站：最基础的 DOM node transforms

先看两份最简单但很关键的文件：

- [ignoreSideEffectTags.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/ignoreSideEffectTags.ts)
- [transformStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/transformStyle.ts)

### 5.1 `ignoreSideEffectTags`

它做的事情非常直接：

```html
<script> / <style>
```

在客户端模板里直接从 AST 里移除。

重点不是“它删了什么”，而是：

> DOM 平台从一开始就认为某些模板标签不应该进入正常渲染树

### 5.2 `transformStyle`

它会把：

```html
style="color:red"
```

先改成等价的：

```html
:style="{ color: 'red' }"
```

这一步的意义很大：

> 后续 `transformElement`、props 构建、codegen 就不用再分“原来是静态 style 还是动态 style”，统一按动态 prop 处理

这是典型的平台预归一化动作。

---

## 6. 第四站：最直观的 DOM 指令特化

看：

- [vHtml.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vHtml.ts)
- [vText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vText.ts)
- [vShow.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vShow.ts)

这三份适合连着读，因为它们都很短，而且一眼就能看出“DOM 平台语义”。

### 6.1 `v-html`

本质是：

```ts
innerHTML: exp
```

同时会清空原 children。

### 6.2 `v-text`

本质是：

```ts
textContent: toDisplayString(exp)
```

同时也会清空原 children。

### 6.3 `v-show`

本质不是生成普通 prop，而是：

```ts
needRuntime: V_SHOW
```

也就是说，显示隐藏不是编译期直接能变成静态 HTML 属性的事，必须交给运行时指令处理。

这三份一起读，最容易看出：

> DOM 指令 transform 的职责，不只是把语法换个名字，而是把模板语义映射成具体 DOM 行为入口

---

## 7. 第五站：最值得细读的两份文件

到了这里，建议你重点细读：

- [vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)
- [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vOn.ts)

这两份几乎代表了“为什么 DOM 平台必须覆盖 core 默认实现”。

### 7.1 `vModel.ts`

要抓的主线只有一条：

> 原生元素的 `v-model`，最终怎么分流到不同 runtime helper

重点看这些分支：

- `input[type="text"]` -> `V_MODEL_TEXT`
- `input[type="checkbox"]` -> `V_MODEL_CHECKBOX`
- `input[type="radio"]` -> `V_MODEL_RADIO`
- `select` -> `V_MODEL_SELECT`
- `:type="foo"` 或动态 key -> `V_MODEL_DYNAMIC`
- `file` -> 直接报错

这里你要意识到：

> core 只知道“有个 v-model 语义”，但 DOM 平台才知道不同原生表单元素到底该怎么接运行时实现

### 7.2 `vOn.ts`

这份文件重点看修饰符是怎么被拆成三类的：

1. `withModifiers`
2. `withKeys`
3. 事件名后缀选项

也就是：

- `stop / prevent / self / ctrl` 这一类 -> 运行时包 handler
- `enter / esc / left / right` 这一类 -> 键盘守卫
- `once / capture / passive` -> 编码进事件 prop key

这一步非常关键，因为它说明：

> DOM 事件修饰符不是单一路径处理的，而是会分散到不同层级落地

---

## 8. 第六站：结构校验与开发期约束

看：

- [Transition.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/Transition.ts)
- [validateHtmlNesting.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/validateHtmlNesting.ts)

### 8.1 `Transition.ts`

这份重点看两件事：

1. 为什么校验放在退出阶段
2. 为什么 `Transition + v-show` 要自动补 `persisted`

核心理解是：

> `Transition` 这种内置组件虽然出现在模板层，但它背后其实有非常具体的 DOM 运行时约束

### 8.2 `validateHtmlNesting.ts`

这份虽然简单，但很有价值。

它说明：

> 有些“看起来只是浏览器会自动纠正”的嵌套问题，其实会影响 SSR hydration 或未来行为一致性

所以编译器会在开发环境提前发 warning。

---

## 9. 最后一站：`stringifyStatic.ts`

看：

- [stringifyStatic.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/stringifyStatic.ts)

这是 `compiler-dom` 里最容易读散的一份文件。

建议你只抓一条主线：

> 哪些静态树可以进一步压成 `createStaticVNode("<div>...</div>")`

最值得盯住的是三块：

1. `StringifyThresholds`
2. `analyzeNode()`
3. `stringifyElement()`

### 9.1 `analyzeNode()`

它不负责生成字符串，而是负责：

> 判断这棵树能不能安全字符串化

典型 bailout 场景：

- 表格相关标签
- `v-once`
- 动态属性名
- 不可编译期求值的 `v-bind`
- `option` 的动态 `value`

### 9.2 `stringifyElement()`

这时才是真正把节点序列化成 HTML 字符串。

重点看：

- class/style 如何规范化
- 布尔属性如何省略或保留
- `v-html / v-text` 如何覆盖 children
- `scopeId` 如何保留下来

你会发现，这份优化本质上是：

> 在确认安全的前提下，把一整段静态 vnode 创建逻辑，换成更便宜的 innerHTML 路径

---

## 10. 读完 `compiler-dom` 之后，你应该建立什么图

读完整层后，脑子里最好形成这样一张图：

```text
parserOptions
  -> HTML / SVG / MathML 解析规则

nodeTransforms
  -> 预归一化 style
  -> 过滤副作用标签
  -> 校验 Transition / HTML nesting
  -> 静态字符串化优化

directiveTransforms
  -> v-html / v-text / v-show
  -> v-model DOM 特化
  -> v-on DOM 特化
```

如果你能把这些点和 `compiler-core` 里的 `transformElement / buildProps / codegen` 接上，`compiler-dom` 这一层就算真正读通了。

---

## 11. 下一步建议

接下来最顺的阅读路径是：

1. [compiler-ssr 如何复用 compiler-core](../compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)
2. [DOM 和 SSR 并排对照](../compiler-compare/dom-vs-ssr-side-by-side.md)

然后再回源码读：

1. [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)
2. [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
