# `compiler-core` 源码主流程图

```text
template string
  -> baseParse()
  -> AST
  -> transform()
     -> nodeTransforms
     -> directiveTransforms
     -> hoist / helper collect
  -> generate()
  -> render code string
```

## 关键调用链

1. `baseCompile()` in `src/compile.ts`
2. `baseParse()` in `src/parser.ts`
3. `transform()` in `src/transform.ts`
4. `traverseNode()` 遍历 AST 并执行各类 transform
5. `generate()` in `src/codegen.ts`

## 关键节点

- `getBaseTransformPreset()`
  组织默认 transform 顺序，决定 `v-if`、`v-for`、表达式前缀化、元素生成的先后。
- `transformElement()`
  把普通元素/组件节点转成 `VNodeCall`。
- `transformText()`
  合并相邻文本和插值，避免生成碎片化 children。
- `generate()`
  输出 render 函数、helper import、hoist 常量和源码映射。

## 面试时怎么讲

- `compiler-core` 是平台无关编译层，只关心模板 AST 和 render codegen。
- 主流程一定是 `parse -> transform -> codegen`，Vue 编译优化基本都发生在 transform 阶段。
- `transform` 的本质是“改 AST + 收集运行时 helper + 提前做静态优化信息标记”。

## 面试问法

- Vue 编译器主流程是什么？
- `compiler-core` 和 `compiler-dom` 的边界是什么？
- 为什么 Vue 要先 AST 再生成 render，而不是直接模板替换？

## 源码定位

- 入口：`src/compile.ts`
- 解析：`src/parser.ts`
- 转换：`src/transform.ts`
- 代码生成：`src/codegen.ts`

## 答题模板

`compiler-core` 可以概括成三段。第一段是 `baseParse()`，把模板变成 AST。第二段是 `transform()`，在这里处理 `v-if`、`v-for`、表达式前缀化、静态提升和 helper 收集。第三段是 `generate()`，把 AST 输出成 render 函数字符串。所以 Vue 的编译优化核心不在 parse，而在 transform。平台差异不会放在这里，而是交给上层编译器扩展。 
