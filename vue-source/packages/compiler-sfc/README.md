# `@vue-source/compiler-sfc`

单文件组件编译入口。它负责把 `.vue` 文件拆分为多个 block，再把 `<template>` 交给 `compiler-dom`。

## 当前实现范围

- 支持解析 `<template>`、`<script>`、`<script setup>`、`<style>` 和自定义块
- 支持把 `<template>` 交给 `compiler-dom` 编译
- `compileScript` 已支持最小的 `defineProps` / `defineEmits` / `defineModel` 宏扫描
- `compileScript` 已能生成最小 runtime `props` / `emits` / `model` declaration
- 提供最小可用的 `compileStyle` 能力，方便后续继续扩展

## 关键面试点

- SFC 编译为什么要先做 block descriptor，再进入模板/脚本/样式子编译
- `script setup` 编译期宏和运行时 API 的边界
- `defineModel` 为什么最终会同时影响 `props` 和 `emits`
- scoped style、CSS modules、asset url transform 一般在哪一层处理
- `compiler-sfc` 为什么通常不直接参与运行时，而是服务于打包工具插件

## 下一步可扩展

- 把当前宏扫描继续扩展成真正的 runtime props/emits/model 代码生成
- 加上 scoped style 重写和 CSS vars 注入
