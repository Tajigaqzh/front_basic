# `@vue-source/compiler-core`

模板编译主干。它负责把模板字符串变成 AST，再经过 transform 和 codegen 产出 render 函数代码。

## 模块职责

- `parser.ts`
  负责模板词法/语法解析，生成 AST。
- `transform.ts`
  负责遍历 AST，执行结构指令和表达式转换。
- `codegen.ts`
  负责把转换后的 AST 输出为 render 函数字符串。
- `runtimeHelpers.ts`
  维护编译期和运行时之间的 helper 映射关系。

## 关键面试点

- 编译器主链路：`parse -> transform -> codegen`
- 为什么 Vue 要把模板先编译成 AST，而不是直接正则替换
- `v-if` / `v-for` 这类结构性指令为什么要在 transform 阶段处理
- `patchFlag`、静态提升、block tree 优化分别解决什么问题
- `prefixIdentifiers` 模式为什么要借助 Babel 解析表达式

## 建议阅读顺序

1. `src/compile.ts`
2. `src/parser.ts`
3. `src/transform.ts`
4. `src/transforms/transformElement.ts`
5. `src/codegen.ts`
