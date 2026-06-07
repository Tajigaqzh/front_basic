# `.vue -> compiler-sfc -> compiler-dom/core -> runtime-dom` 中文链路图

## 一句话

一份 `.vue` 文件真正跑起来，核心会经过三段：

```text
compiler-sfc
  把 .vue 拆成 template / script / style
    ↓
compiler-dom + compiler-core
  把 template 编译成 render 函数字符串
    ↓
runtime-dom
  执行 render 产物，把 helper 落到真实 DOM 行为
```

## 1. `.vue` 文件先被 `compiler-sfc/parse.ts` 拆块

入口：

- `packages/compiler-sfc/src/parse.ts`

核心结果：

- `descriptor.template`
- `descriptor.script`
- `descriptor.scriptSetup`
- `descriptor.styles`
- `descriptor.customBlocks`

它先不关心渲染逻辑，只负责把一个 SFC 文件按顶层块拆成结构化 descriptor。

## 2. `<template>` 交给 `compileTemplate()`

入口：

- `packages/compiler-sfc/src/compileTemplate.ts`

它做的事情：

- 处理模板预处理器
- 注入 scopedId / slotted / SSR CSS vars
- 处理 asset url transform 扩展位
- 最终调用 `compiler.compile(...)`

这里的 `compiler` 默认就是 `compiler-dom`，所以会继续进入：

```text
compiler-sfc/compileTemplate
  -> compiler-dom/compile
  -> compiler-core/baseCompile
  -> parse -> transform -> generate
```

## 3. `<script>` / `<script setup>` 交给 `compileScript()`

入口：

- `packages/compiler-sfc/src/compileScript.ts`

它做的事情：

- 识别 `defineProps` / `defineEmits` / `defineModel` / `defineSlots` 等宏
- 处理 props 解构
- 处理顶层 `await`
- 生成运行时 `props / emits / model` 选项
- 生成 `bindingMetadata`

`bindingMetadata` 会传给模板编译阶段，让 `transformExpression.ts` 知道模板里的变量到底来自：

- `_ctx`
- `$setup`
- `$props`
- `ref.value`

所以 `compileScript()` 和 `compileTemplate()` 不是孤立的，它们通过 `bindingMetadata` 串起来。

## 4. `compiler-dom/runtimeHelpers.ts` 负责“编译 helper 名 -> 运行时导出名”

例如：

- `V_MODEL_TEXT -> vModelText`
- `V_ON_WITH_MODIFIERS -> withModifiers`
- `V_ON_WITH_KEYS -> withKeys`
- `V_SHOW -> vShow`
- `TRANSITION -> Transition`

编译阶段只关心 symbol，codegen 阶段再把 symbol 变成导入名。

## 5. `runtime-dom/src/index.ts` 是这些 helper 的真实落点

这里导出了：

- `vModelText`
- `vModelCheckbox`
- `vModelRadio`
- `vModelSelect`
- `vModelDynamic`
- `withModifiers`
- `withKeys`
- `vShow`
- `Transition`
- `TransitionGroup`

可以直接把它和 `compiler-dom/runtimeHelpers.ts` 一一对应起来看。

## 6. 编译产物里的几个典型 helper，运行时分别去哪

### `v-model`

编译阶段：

- `compiler-dom/src/transforms/vModel.ts`

运行时：

- `runtime-dom/src/directives/vModel.ts`

### `withModifiers` / `withKeys`

编译阶段：

- `compiler-dom/src/transforms/vOn.ts`

运行时：

- `runtime-dom/src/directives/vOn.ts`

### `vShow`

编译阶段：

- `compiler-dom/src/transforms/vShow.ts`

运行时：

- `runtime-dom/src/directives/vShow.ts`

### `Transition` / `TransitionGroup`

编译阶段：

- `parserOptions.ts`
- `transforms/Transition.ts`

运行时：

- `runtime-dom/src/components/Transition.ts`
- `runtime-dom/src/components/TransitionGroup.ts`

## 7. `tokenizer.ts` 在整条链里的位置

它的职责非常底层：

- 逐字符扫描模板字符串
- 按状态机切分出文本、标签、属性、插值、注释等 token
- 通过回调把 token 交给 `parser.ts`

所以完整链路可以补成：

```text
template source
  -> tokenizer.ts
  -> parser.ts
  -> AST
  -> transform
  -> codegen
  -> render code
  -> runtime-dom helpers
  -> real DOM behavior
```
