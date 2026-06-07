# Vue 编译器源码阅读索引

这份索引的目标很简单：

> 把现在已经补好的 `compiler-core / compiler-dom / compiler-ssr` 源码注释和配套文档串成一条可执行的阅读路径

如果你直接从 Vue 编译器源码开读，很容易遇到两个问题：

1. 文件太多，不知道先读哪个
2. 单篇文档看懂了，但不知道和其他文档怎么接上

这份索引就是为了解决这两个问题。

---

## 1. 先读什么

如果你是第一次系统读这一块，建议按这个顺序：

1. 先看总览，知道大图
2. 再看简单案例，建立 AST 变化直觉
3. 再看复杂案例，理解 slot / component / v-for
4. 再看平台层，理解 DOM / SSR 是怎么扩展 core 的
5. 最后回源码细读

最推荐的起步顺序是：

1. [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)
2. [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)
3. [vfor-component-slot-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vfor-component-slot-ast-flow.md)
4. [slot-outlet-and-slots-relation.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/slot-outlet-and-slots-relation.md)
5. [vif-vfor-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vif-vfor-ast-flow.md)
6. [compiler-dom-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)
7. [compiler-sfc-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/compiler-sfc-overview.md)
8. [script-setup-macros-and-runtime.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/script-setup-macros-and-runtime.md)
9. [binding-metadata-and-template-identifiers.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/binding-metadata-and-template-identifiers.md)
10. [props-destructure-and-type-resolution.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/props-destructure-and-type-resolution.md)
11. [top-level-await-and-css-vars.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/top-level-await-and-css-vars.md)
12. [compiler-ssr-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)
13. [dom-vs-ssr-side-by-side.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/dom-vs-ssr-side-by-side.md)
14. [component-slot-dom-vs-ssr.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/component-slot-dom-vs-ssr.md)

---

## 2. 按主题分类

### 2.1 `compiler-core` 总览

- [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)

适合什么时候看：

- 想先知道 `parse -> transform -> codegen` 全链路
- 想知道各个核心文件的职责边界
- 想知道 `compiler-core`、`compiler-dom`、`compiler-ssr` 的关系框架

读完你应该知道：

- 为什么 Vue 编译器要分 `parser / transform / codegen`
- 为什么 AST 分模板层和 codegen 层
- 为什么结构型指令必须先改 AST 结构

### 2.2 基础 AST 案例

- [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)

适合什么时候看：

- 你想先拿一个最小模板例子顺着走一遍

覆盖内容：

- `v-if`
- `@click`
- `{{ interpolation }}`
- `Element -> IfNode -> VNodeCall -> render`

### 2.3 复杂 AST 案例

- [vfor-component-slot-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vfor-component-slot-ast-flow.md)

适合什么时候看：

- 你已经懂基础链路，想开始读 component / slot / `v-for`

覆盖内容：

- `v-for`
- component
- `#default`
- slots 对象
- `renderList(...)`

### 2.4 slot 对应关系

- [slot-outlet-and-slots-relation.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/slot-outlet-and-slots-relation.md)

适合什么时候看：

- 你已经知道父组件定义 slot、子组件消费 slot，但源码里对不上两边

覆盖内容：

- 父组件 `v-slot`
- 子组件 `<slot/>`
- `slots` 对象
- `renderSlot(...)`
- slot props 对接关系

### 2.5 双结构型指令叠加

- [vif-vfor-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vif-vfor-ast-flow.md)

适合什么时候看：

- 想看 `v-if + v-for` 在同一节点上时 AST 是怎么改的

覆盖内容：

- `transformIf` 和 `transformFor` 的顺序
- `IfNode -> ForNode -> Element`
- 为什么这种写法会更绕

---

## 3. 平台层文档

### 3.1 DOM 平台扩展

- [compiler-dom-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)

适合什么时候看：

- 你已经理解 core，开始想知道 DOM 平台到底加了什么

覆盖内容：

- `parserOptions`
- DOM transforms
- DOM directiveTransforms
- runtime helpers
- DOM 错误体系

### 3.2 SSR 平台扩展

- [compiler-ssr-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)

适合什么时候看：

- 你已经理解客户端编译，开始想知道 SSR 为什么必须多一轮 transform

覆盖内容：

- 第一轮 transform 如何复用 core/dom
- 第二轮 `ssrCodegenTransform`
- 为什么 SSR 最终不是 vnode 树，而是 `_push(...)`

### 3.3 SFC 编排层

- [compiler-sfc-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/compiler-sfc-overview.md)
- [script-setup-macros-and-runtime.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/script-setup-macros-and-runtime.md)
- [binding-metadata-and-template-identifiers.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/binding-metadata-and-template-identifiers.md)
- [props-destructure-and-type-resolution.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/props-destructure-and-type-resolution.md)
- [top-level-await-and-css-vars.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-sfc/top-level-await-and-css-vars.md)

适合什么时候看：

- 你已经理解 `compiler-core / compiler-dom`，开始想知道完整 `.vue` 文件是怎么进入编译链的

覆盖内容：

- `.vue` 如何先被拆成 descriptor
- `compileScript()` 如何产出 `bindingMetadata`
- `compileTemplate()` 如何把 template 再交回 `compiler-dom`
- `compileStyle()` 如何处理 `scoped / css vars / preprocess`

继续往下读建议：

- 先看 `script setup` 宏如何被记录并汇总成运行时 `props / emits / model`
- 再看模板标识符分析如何把 `bindingMetadata` 和 import 使用情况接回模板编译
- 再看 props 解构重写、类型转运行时 props、顶层 `await` 改写和 CSS vars 这些辅助链是怎么嵌进 SFC 主流程的

---

## 4. 并排对照文档

### 4.1 DOM vs SSR：基础结构对照

- [dom-vs-ssr-side-by-side.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/dom-vs-ssr-side-by-side.md)

适合什么时候看：

- 你已经分别看过 DOM 和 SSR，但想知道它们到底从哪一步分叉

覆盖内容：

- 同一份模板在 DOM 和 SSR 下的 parse / transform / codegen 对照
- vnode codegen vs `_push` codegen

### 4.2 DOM vs SSR：component + slot 对照

- [component-slot-dom-vs-ssr.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/component-slot-dom-vs-ssr.md)

适合什么时候看：

- 你想看 component / slot 在客户端和 SSR 下最本质的差异

覆盖内容：

- DOM slot function 返回 vnode
- SSR slot function 输出 HTML
- `renderSlot(...)` vs `_ssrRenderSlot(...)`
- `createBlock(...)` vs `_ssrRenderComponent(...)`

---

## 5. 如果你想直接读源码

如果你不想先看完整文档，而是要带着目的读源码，建议用下面这两条路径。

### 5.1 读 `compiler-core`

推荐源码顺序：

1. [compile.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/compile.ts)
2. [ast.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/ast.ts)
3. [parser.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/parser.ts)
4. [tokenizer.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/tokenizer.ts)
5. [transform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transform.ts)
6. [transformExpression.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformExpression.ts)
7. [vIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vIf.ts)
8. [vFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vFor.ts)
9. [vSlot.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vSlot.ts)
10. [transformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformElement.ts)
11. [vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vOn.ts)
12. [vBind.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vBind.ts)
13. [vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/vModel.ts)
14. [transformText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/transformText.ts)
15. [cacheStatic.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/transforms/cacheStatic.ts)
16. [codegen.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/codegen.ts)
17. [runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/runtimeHelpers.ts)
18. [utils.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/utils.ts)
19. [errors.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-core/src/errors.ts)

### 5.2 读平台层

先 DOM：

1. [compiler-dom/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/index.ts)
2. [compiler-dom/src/parserOptions.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/parserOptions.ts)
3. [compiler-dom/src/transforms/transformStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/transformStyle.ts)
4. [compiler-dom/src/transforms/vHtml.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vHtml.ts)
5. [compiler-dom/src/transforms/vText.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vText.ts)
6. [compiler-dom/src/transforms/vModel.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vModel.ts)
7. [compiler-dom/src/transforms/vOn.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vOn.ts)
8. [compiler-dom/src/transforms/vShow.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-dom/src/transforms/vShow.ts)

再 SSR：

1. [compiler-ssr/src/index.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/index.ts)
2. [compiler-ssr/src/ssrCodegenTransform.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/ssrCodegenTransform.ts)
3. [compiler-ssr/src/transforms/ssrTransformElement.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformElement.ts)
4. [compiler-ssr/src/transforms/ssrVIf.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVIf.ts)
5. [compiler-ssr/src/transforms/ssrVFor.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrVFor.ts)
6. [compiler-ssr/src/transforms/ssrTransformComponent.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformComponent.ts)
7. [compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/transforms/ssrTransformSlotOutlet.ts)
8. [compiler-ssr/src/runtimeHelpers.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-ssr/src/runtimeHelpers.ts)

最后接 SFC：

1. [compiler-sfc/src/parse.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/parse.ts)
2. [compiler-sfc/src/compileScript.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileScript.ts)
3. [compiler-sfc/src/compileTemplate.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileTemplate.ts)
4. [compiler-sfc/src/compileStyle.ts](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/compiler-sfc/src/compileStyle.ts)

---

## 6. 不同阅读目标怎么选

### 6.1 你只想快速理解 Vue 模板编译流程

直接读：

1. [compiler-core-overview.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/compiler-core-overview.md)
2. [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)

### 6.2 你想看 AST 是怎么变化的

读：

1. [template-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/template-ast-flow.md)
2. [vfor-component-slot-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vfor-component-slot-ast-flow.md)
3. [vif-vfor-ast-flow.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/vif-vfor-ast-flow.md)

### 6.3 你想搞清楚 slot

读：

1. [slot-outlet-and-slots-relation.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-core/slot-outlet-and-slots-relation.md)
2. [component-slot-dom-vs-ssr.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/component-slot-dom-vs-ssr.md)

### 6.4 你想搞清楚 DOM 和 SSR 差异

读：

1. [compiler-dom-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-dom/compiler-dom-on-top-of-compiler-core.md)
2. [compiler-ssr-on-top-of-compiler-core.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)
3. [dom-vs-ssr-side-by-side.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/dom-vs-ssr-side-by-side.md)
4. [component-slot-dom-vs-ssr.md](/Users/nwyzx/Desktop/project/source/front_basic/docs/vue/source/compiler-compare/component-slot-dom-vs-ssr.md)

---

## 7. 现在这套资料的定位

当前这批内容已经同时具备 3 层：

### 7.1 源码层

你已经在这些关键源码文件里有了中文内联注释：

- `compiler-core` 主链路
- 关键 transforms
- `tokenizer`
- `ast / utils / runtimeHelpers / errors`

### 7.2 案例层

你已经有多篇具体模板案例文档，可以直接看 AST 怎么变。

### 7.3 平台层

你已经有 `compiler-dom`、`compiler-ssr` 和 DOM/SSR 对照文档。

这意味着：

> 现在不只是“文件上有注释”，而是已经形成了一套可连续阅读的源码学习资料

---

## 8. 后续如果还要补，最值得做什么

如果后面还继续扩，我建议优先做这两类：

1. 把这份索引挂到现有 Vue 源码总目录入口页
2. 继续补更细的专题文档

最值得继续写的专题有：

- `Transition / KeepAlive / Teleport` 在编译阶段怎么处理
- `compiler-sfc` 如何把 `<template>` 编译接到 `compiler-core`
- 从 SFC 到 runtime 的完整链路总览

---

如果你要，我下一步可以直接做第 1 条：把这份索引挂进现有 `docs/vue/source/index.md` 或相关入口页，让整套资料从目录也能点进去。
