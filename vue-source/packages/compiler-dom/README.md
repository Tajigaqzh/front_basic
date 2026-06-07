# `@vue-source/compiler-dom`

浏览器平台编译器。它建立在 `compiler-core` 之上，补充 DOM 平台特有的解析规则和指令转换。

## 模块职责

- 提供 HTML 解析选项，如 void tag、namespace、实体解码
- 覆盖平台相关指令转换，如 `v-model`、`v-on`、`v-show`
- 在非浏览器构建里做静态字符串化优化

## 关键面试点

- `compiler-core` 和 `compiler-dom` 的职责边界
- 为什么 `v-model` 在不同平台需要不同 transform
- 为什么 `<script>` / `<style>` 这类标签需要 DOM 侧额外处理
- `parserOptions` 和 `directiveTransforms` 是怎么扩展平台能力的

## 建议阅读顺序

1. `src/index.ts`
2. `src/parserOptions.ts`
3. `src/transforms/vModel.ts`
4. `src/transforms/vOn.ts`
5. `src/transforms/stringifyStatic.ts`
