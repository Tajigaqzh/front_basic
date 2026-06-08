# compiler-dom 如何在 compiler-core 之上扩展平台能力

如果说 `compiler-core` 解决的是：

> 任意平台模板，如何编译成 render 函数

那么 `compiler-dom` 解决的就是：

> 浏览器 DOM 平台有哪些额外语义，需要在 `compiler-core` 的基础上补进去

这篇文档专门回答两个问题：

1. `compiler-dom` 和 `compiler-core` 的边界在哪里？
2. `compiler-dom` 到底是通过哪些扩展点接管 DOM 语义的？

---

## 1. 先看一句话结论

`compiler-dom` 并没有重写整个编译流程。

它做的事情很克制，本质上只有三类：

1. 提供 DOM 平台专属的 `parserOptions`
2. 注入 DOM 平台专属的 `nodeTransforms` 和 `directiveTransforms`
3. 注册 DOM 平台专属的 runtime helper 和错误码

也就是说：

```ts
compiler-core = 通用编译骨架
compiler-dom  = 在骨架上插入 DOM 规则
```

---

## 2. 最核心的入口文件

最先要看的文件是：

- [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)

这里基本把整层关系都写出来了。

`compile()` 的核心逻辑可以压缩成：

```ts
return baseCompile(
  src,
  extend({}, parserOptions, options, {
    nodeTransforms: [
      ignoreSideEffectTags,
      ...DOMNodeTransforms,
      ...(options.nodeTransforms || []),
    ],
    directiveTransforms: extend(
      {},
      DOMDirectiveTransforms,
      options.directiveTransforms || {},
    ),
    transformHoist: __BROWSER__ ? null : stringifyStatic,
  }),
)
```

这段代码非常关键，因为它说明了：

- 编译总流程仍然来自 `baseCompile`
- parser 仍然来自 `baseParse`
- transform / codegen 仍然来自 `compiler-core`
- `compiler-dom` 只是“带着 DOM 配置去调用 core”

---

## 3. 总体结构图

可以把它画成这样：

```ts
template
-> compiler-dom.compile()
-> baseCompile()              // compiler-core
   -> baseParse()             // compiler-core
      + parserOptions         // compiler-dom
   -> transform()             // compiler-core
      + DOM transforms        // compiler-dom
   -> generate()              // compiler-core
      + DOM runtime helpers   // compiler-dom
```

所以 `compiler-dom` 不是平行于 `compiler-core` 的另一套编译器，而是：

> 基于 `compiler-core` 的平台适配层

---

## 4. 第一类扩展：DOM parserOptions

关键文件：

- [compiler-dom/src/parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)

这里解决的是：

> 浏览器 HTML 模板在“解析阶段”有哪些平台特有规则

### 4.1 parseMode 切成 HTML

```ts
parseMode: 'html'
```

这意味着：

- 不再只是 core 的基础模式
- parser/tokenizer 会按更接近 HTML 的规则工作

### 4.2 DOM 原生标签识别

```ts
isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag)
```

这会影响：

- 某个标签是普通原生元素
- 还是组件

比如：

- `div` -> 原生元素
- `svg` -> 原生元素
- `MyComp` -> 组件

### 4.3 void tag 规则

```ts
isVoidTag
```

这让 parser 知道：

- `<img>`
- `<br>`
- `<input>`

这类标签没有闭合 children。

### 4.4 pre / textarea 空白规则

```ts
isPreTag
isIgnoreNewlineTag
```

这部分决定：

- `<pre>` 是否保留空白
- `<textarea>` / `<pre>` 首个换行是否忽略

这属于典型 HTML 平台行为，不应该由 `compiler-core` 默认承担。

### 4.5 HTML 实体解码

```ts
decodeEntities: __BROWSER__ ? decodeHtmlBrowser : undefined
```

这里把浏览器环境下的 HTML entity 解码方式补上。

这意味着：

- core 负责“什么时候该解码”
- dom 负责“在浏览器平台怎么解码”

### 4.6 命名空间切换规则

`getNamespace(...)` 是 parserOptions 里非常重要的一块。

它处理：

- HTML -> SVG
- HTML -> MathML
- SVG 某些子节点再回到 HTML
- MathML 某些子节点切回 HTML / SVG

这类规则完全属于 DOM/HTML 解析语义，所以自然放在 `compiler-dom`。

### 4.7 内置组件识别

```ts
isBuiltInComponent(tag)
```

这里额外识别：

- `Transition`
- `TransitionGroup`

并把它们映射成 DOM 平台的专属 runtime helper。

这也是平台扩展的一部分，因为这些内置组件并不属于纯核心模板语义。

---

## 5. 第二类扩展：DOM NodeTransforms

关键文件：

- [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)

这里声明了：

```ts
export const DOMNodeTransforms = [
  transformStyle,
  ...(__DEV__ ? [transformTransition, validateHtmlNesting] : []),
]
```

再加上最前面的：

```ts
ignoreSideEffectTags
```

### 5.1 `ignoreSideEffectTags`

文件：

- [ignoreSideEffectTags.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/ignoreSideEffectTags.ts)

作用：

```ts
<script> / <style>
-> 直接从 AST 中移除
```

原因很简单：

- 组件模板不应该把带副作用标签直接编进渲染树

这完全是客户端 DOM 平台策略，不属于 core。

### 5.2 `transformStyle`

文件：

- [transformStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/transformStyle.ts)

作用：

```vue
style="color:red"
```

会先转成等价的：

```vue
:style="{ color: 'red' }"
```

也就是说：

- core 认识 `v-bind:style`
- dom 负责把静态内联 style 字符串预处理成对象表达式

### 5.3 `transformTransition`

这个 transform 主要服务于 DOM 内置的 `Transition` 组件语义校验和处理。

它不是模板核心语义，而是浏览器平台动画组件的语义补充。

### 5.4 `validateHtmlNesting`

这个 transform 只在开发环境生效。

作用是：

- 检查 HTML 标签嵌套是否合法

例如：

- 某些标签不能嵌某些子标签

这也明显属于 DOM/HTML 规范层，而不是 core 编译主逻辑。

---

## 6. 第三类扩展：DOM DirectiveTransforms

关键文件：

- [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)

这里定义了：

```ts
export const DOMDirectiveTransforms = {
  cloak: noopDirectiveTransform,
  html: transformVHtml,
  text: transformVText,
  model: transformModel,
  on: transformOn,
  show: transformShow,
}
```

它有两种情况：

1. core 里没有，需要 DOM 新增
2. core 里有通用版本，但 DOM 要覆盖成平台特化版本

下面分别看。

### 6.1 `v-html`

文件：

- [vHtml.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vHtml.ts)

作用：

```vue
<div v-html="raw" />
```

会被编译成：

```ts
innerHTML: raw
```

并且：

- 如果节点有 children，会报错并清空 children

因为 DOM 语义里：

```ts
innerHTML 会覆盖元素内容
```

### 6.2 `v-text`

文件：

- [vText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vText.ts)

作用：

```vue
<div v-text="msg" />
```

编译成：

```ts
textContent: toDisplayString(msg)
```

并且：

- 有 children 时同样会报错并清空 children

因为 `textContent` 也会覆盖原子节点内容。

### 6.3 `v-show`

文件：

- [vShow.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vShow.ts)

作用很特别：

它不直接生成 props，而是：

```ts
needRuntime: V_SHOW
```

也就是说：

> `v-show` 不是单纯的编译期属性改写，而是要依赖 DOM 运行时指令

这正是典型的平台扩展点。

### 6.4 覆盖 core 的 `v-model`

文件：

- [compiler-dom/src/transforms/vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)

为什么要覆盖？

因为 core 只知道：

```ts
v-model = modelValue + onUpdate:xxx
```

但 DOM 要进一步区分：

- `input[type=text]`
- `checkbox`
- `radio`
- `select`
- 动态类型 input

这些不同元素要用不同运行时 helper：

- `vModelText`
- `vModelCheckbox`
- `vModelRadio`
- `vModelSelect`
- `vModelDynamic`

所以这部分必须放在 DOM 层做。

### 6.5 覆盖 core 的 `v-on`

文件：

- [compiler-dom/src/transforms/vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vOn.ts)

为什么 core 不够？

因为 core 只负责：

```ts
@click="foo"
-> onClick: foo
```

但 DOM 还要处理：

- `.stop`
- `.prevent`
- `.self`
- `.capture`
- `.once`
- `.passive`
- `.enter`
- `.esc`

这些都是浏览器事件系统语义，不应该塞进 core。

所以 DOM 层会把它们进一步包装成：

- `withModifiers`
- `withKeys`

---

## 7. 第四类扩展：DOM runtime helpers

关键文件：

- [compiler-dom/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/runtimeHelpers.ts)

这里通过 `registerRuntimeHelpers(...)` 注册了一批 DOM 专属 helper：

- `vModelRadio`
- `vModelCheckbox`
- `vModelText`
- `vModelSelect`
- `vModelDynamic`
- `withModifiers`
- `withKeys`
- `vShow`
- `Transition`
- `TransitionGroup`

这意味着：

- `compiler-core` 本身不知道这些 helper 名字
- 但它知道自己可以接受新的 helper symbol
- `compiler-dom` 再把 symbol 映射到真实运行时名称

所以 platform layer 真正扩展 runtime helper 的方式是：

```ts
定义 symbol
+ 注册到 helperNameMap
```

---

## 8. 第五类扩展：DOM 错误体系

关键文件：

- [compiler-dom/src/errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/errors.ts)

DOM 层没有重新造一套错误系统，而是：

- 复用 core 的 `createCompilerError`
- 从 core 的 `ErrorCodes.__EXTEND_POINT__` 开始继续编号

这很关键，因为它说明：

> DOM 扩展不是另起炉灶，而是在 core 统一机制里挂自己的平台错误

典型 DOM 错误包括：

- `v-html is missing expression`
- `v-html will override element children`
- `v-text is missing expression`
- `v-model can only be used on input/textarea/select`
- `v-show is missing expression`
- `Tags with side effect are ignored`

这些错误都明显带平台属性，不适合放到 core。

---

## 9. `compiler-dom` 没做什么

这也很重要。

`compiler-dom` 没有重写：

- tokenizer
- parser 主体
- transform 遍历框架
- codegen 主逻辑
- AST 结构体系

也就是说：

```ts
tokenizer / parser / transform framework / codegen framework
都还是 compiler-core 的
```

DOM 只是：

- 换 parser options
- 多插几个 transforms
- 覆盖几个 directives
- 注册几个 helper

这正说明 `compiler-core` 的抽象层次是成功的。

---

## 10. 最值得记住的边界

你可以用一个非常实用的判断规则：

### 属于 compiler-core 的问题

如果问题是：

- 模板 AST 怎么组织
- `v-if` / `v-for` 怎么改结构
- 表达式怎么改写
- `VNodeCall` 怎么生成
- render 代码怎么输出

那应该去看 `compiler-core`

### 属于 compiler-dom 的问题

如果问题是：

- 这个标签是不是原生 DOM 标签
- 这个标签是不是 void tag
- `svg/math` 命名空间怎么切
- `style="a:b"` 怎么预处理
- `v-html` / `v-text` / `v-show` 怎么编译
- DOM 事件修饰符怎么处理
- DOM 上 `v-model` 怎么按元素类型区分

那应该去看 `compiler-dom`

一句话概括：

> `compiler-core` 处理“模板通用语义”，`compiler-dom` 处理“浏览器平台语义”。

---

## 11. 一张简化关系图

可以把它压成下面这张结构图：

```ts
compiler-dom
  ├─ parserOptions.ts
  │   └─ HTML/SVG/MathML 解析规则
  ├─ transforms/
  │   ├─ transformStyle
  │   ├─ vHtml
  │   ├─ vText
  │   ├─ vShow
  │   ├─ vModel (DOM override)
  │   ├─ vOn    (DOM override)
  │   └─ ignoreSideEffectTags / validateHtmlNesting / Transition
  ├─ runtimeHelpers.ts
  │   └─ 注册 DOM 专属 helper
  ├─ errors.ts
  │   └─ 扩展 DOM 专属错误
  └─ index.ts
      └─ 把这些能力注入 baseCompile/baseParse

compiler-core
  ├─ tokenizer
  ├─ parser
  ├─ ast
  ├─ transform framework
  ├─ generic transforms
  └─ codegen
```

---

## 12. 推荐阅读顺序

如果你要顺着源码往下看，建议按这个顺序：

1. [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)
2. [compiler-dom/src/parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)
3. [compiler-dom/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/runtimeHelpers.ts)
4. [compiler-dom/src/errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/errors.ts)
5. [compiler-dom/src/transforms/transformStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/transformStyle.ts)
6. [compiler-dom/src/transforms/vHtml.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vHtml.ts)
7. [compiler-dom/src/transforms/vText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vText.ts)
8. [compiler-dom/src/transforms/vShow.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vShow.ts)
9. [compiler-dom/src/transforms/vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)
10. [compiler-dom/src/transforms/vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vOn.ts)

如果你想先看底层总览，再回来看这篇，建议先读：

- [compiler-core-overview.md](../compiler-core/compiler-core-overview.md)

---

## 13. 和前几篇文档怎么配合

这篇最好和前面的几篇一起用：

- 看核心总流程：
  - [compiler-core-overview.md](../compiler-core/compiler-core-overview.md)

- 看基础 AST 变化：
  - [template-ast-flow.md](../compiler-core/template-ast-flow.md)

- 看复杂 AST 变化：
  - [vfor-component-slot-ast-flow.md](../compiler-core/vfor-component-slot-ast-flow.md)

- 看 slot 提供方 / 消费方关系：
  - [slot-outlet-and-slots-relation.md](../compiler-core/slot-outlet-and-slots-relation.md)

这篇则补上：

> 为什么这些核心流程到了 DOM 平台还需要再套一层

---

如果你要，我下一篇可以继续写：

1. `v-if + v-for` 组合场景 AST 变化
2. `compiler-ssr` 如何复用 `compiler-core`
