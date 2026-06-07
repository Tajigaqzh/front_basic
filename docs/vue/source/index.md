# Vue Source

这个目录用于整理 Vue 源码分析。

## 文档分包

- [compiler 阅读索引](./compiler-reading-index.md)
- [reactivity](./reactivity/index.md)
- [runtime-core](./runtime-core/index.md)
- [runtime-dom](./runtime-dom/index.md)

## 编译器专题

- [compiler-core 总览](./compiler-core/compiler-core-overview.md)
- [基础模板 AST 变化过程](./compiler-core/template-ast-flow.md)
- [v-for + component + slot AST 变化过程](./compiler-core/vfor-component-slot-ast-flow.md)
- [slot outlet 和组件 slots 的对应关系](./compiler-core/slot-outlet-and-slots-relation.md)
- [v-if + v-for 组合场景 AST 变化](./compiler-core/vif-vfor-ast-flow.md)
- [compiler-dom 如何扩展 compiler-core](./compiler-dom/compiler-dom-on-top-of-compiler-core.md)
- [compiler-dom 源码顺读图](./compiler-dom/compiler-dom-source-walkthrough.md)
- [compiler-ssr 如何复用 compiler-core](./compiler-ssr/compiler-ssr-on-top-of-compiler-core.md)
- [compiler-ssr 源码顺读图](./compiler-ssr/compiler-ssr-source-walkthrough.md)
- [compiler-sfc 总览](./compiler-sfc/compiler-sfc-overview.md)
- [script setup 宏如何落成运行时代码](./compiler-sfc/script-setup-macros-and-runtime.md)
- [bindingMetadata 和模板标识符分析](./compiler-sfc/binding-metadata-and-template-identifiers.md)
- [props 解构重写与类型转运行时 props](./compiler-sfc/props-destructure-and-type-resolution.md)
- [顶层 await 与 CSS vars 辅助链路](./compiler-sfc/top-level-await-and-css-vars.md)
- [DOM 和 SSR 并排对照](./compiler-compare/dom-vs-ssr-side-by-side.md)
- [component + slot 在 DOM 和 SSR 下的并排对照](./compiler-compare/component-slot-dom-vs-ssr.md)

## 导航

- 返回 [Vue 模块](../index.md)
