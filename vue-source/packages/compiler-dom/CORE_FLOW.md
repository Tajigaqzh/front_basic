# `compiler-dom -> compiler-core` 中文源码阅读地图

## 一句话关系

`compiler-dom` 负责“浏览器平台规则”，`compiler-core` 负责“平台无关的编译主流程”。

可以把它理解成：

```text
compiler-dom
  负责补 DOM 解析规则 + DOM transform + DOM helper 映射
      ↓
compiler-core
  负责 parse -> transform -> codegen 主流程
      ↓
runtime-dom
  负责真正执行 render 代码
```

## 最短阅读路径

1. `packages/compiler-dom/src/index.ts`
   看 `compile()` 如何调用 `baseCompile()`，以及如何注入：
   - `parserOptions`
   - `DOMNodeTransforms`
   - `DOMDirectiveTransforms`
   - `transformHoist`

2. `packages/compiler-core/src/compile.ts`
   看 `baseCompile()` 如何串起三步：
   - `baseParse()`
   - `transform()`
   - `generate()`

3. `packages/compiler-core/src/transform.ts`
   看 AST 是怎么被遍历和改写的，重点关注：
   - `createTransformContext()`
   - `transform()`
   - `traverseNode()`
   - `createRootCodegen()`

4. `packages/compiler-core/src/codegen.ts`
   看 transform 阶段产出的 `root.codegenNode` 最后怎么变成 render 函数字符串。

## 具体怎么接上的

### 1. `compiler-dom` 不自己重写主流程

`compiler-dom/src/index.ts` 里并没有重新实现 parse、transform、codegen。

它做的是：

- 给 `baseCompile()` 传入 DOM 解析选项
- 在 `nodeTransforms` 前后插入 DOM 专属节点转换
- 用 DOM 版本的指令转换覆盖 core 默认实现
- 在非浏览器环境下注入 `stringifyStatic`

所以 `compiler-dom` 更像“平台层配置器”。

### 2. 真正的总入口在 `compiler-core/baseCompile()`

`compiler-core/src/compile.ts` 里的 `baseCompile()` 是主线：

```text
source
  -> baseParse()
  -> transform()
  -> generate()
  -> code
```

这里最重要的点有两个：

- 如果传入的是字符串，就先 parse 成 AST
- 如果传入的是 AST，就直接进入 transform

这也是为什么 `compiler-dom/compile()` 能只专注“加平台规则”。

### 3. `transform()` 负责把 AST 改造成可 codegen 的 AST

`compiler-core/src/transform.ts` 做几件事：

- 创建 `TransformContext`
- 深度优先遍历 AST
- 依次执行 `nodeTransforms`
- 对元素上的每个指令执行 `directiveTransforms`
- 收集 helper、components、directives、hoists、cached
- 最后生成 `root.codegenNode`

这里可以把 `transform` 理解成“编译中间层”。

它不直接输出 JS 字符串，而是先把模板 AST 改造成“更接近最终 render 代码”的 JS AST。

### 4. `createRootCodegen()` 是根节点收口点

在 `transform` 结束前，会调用 `createRootCodegen()`。

它决定：

- 单根节点时，根表达式直接是什么
- 单根元素时，是否转成 block
- 多根节点时，是否包成 `Fragment`
- 空模板时，最终返回 `null`

所以你看 codegen 前，先看 `root.codegenNode` 是什么最关键。

### 5. `generate()` 只负责“把结果写出来”

`compiler-core/src/codegen.ts` 里：

- 读取 `ast.helpers`
- 读取 `ast.components`
- 读取 `ast.directives`
- 读取 `ast.hoists`
- 读取 `ast.codegenNode`

然后生成：

- preamble：`import` / helper 解构 / hoist 常量
- render 函数签名
- `return` 后面的 VNode 表达式

所以 codegen 并不关心某个模板语义“为什么这样编译”，它只关心“transform 最终交给我的 AST 长什么样”。

## 用一个实际问题串起来

问题：`<input v-model="msg" @click.stop="foo" />` 最后怎么变成 render 代码？

阅读路径：

1. `compiler-dom/src/index.ts`
   看到 DOM 层覆盖了 `model` 和 `on`

2. `compiler-dom/src/transforms/vModel.ts`
   看到 `input` 会被分配到 `V_MODEL_TEXT`

3. `compiler-dom/src/transforms/vOn.ts`
   看到 `.stop` 会包成 `withModifiers`

4. `compiler-core/src/transform.ts`
   看到这些 transform 最终把结果写进元素节点的 `codegenNode`

5. `compiler-core/src/codegen.ts`
   看到 helper 被导入，`codegenNode` 被输出成 render 函数代码

## 推荐阅读顺序

如果你是第一次深入读源码，建议按这个顺序：

1. `compiler-dom/src/index.ts`
2. `compiler-dom/src/parserOptions.ts`
3. `compiler-core/src/compile.ts`
4. `compiler-core/src/transform.ts`
5. `compiler-dom/src/transforms/vModel.ts`
6. `compiler-dom/src/transforms/vOn.ts`
7. `compiler-core/src/codegen.ts`
8. `compiler-dom/src/transforms/stringifyStatic.ts`

## 面试里可以怎么回答

`compiler-dom` 不是另一套编译器，它主要负责把浏览器平台差异注入到 `compiler-core` 的统一编译主流程里。真正的主线还是 `baseCompile()`，也就是 parse、transform、generate 三步。DOM 层主要扩展的是 HTML 解析规则、DOM 专属指令转换和静态优化；core 层负责 AST 遍历、helper 收集、根节点 codegenNode 生成，以及最后 render 函数字符串输出。
