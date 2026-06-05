# Vue Reactivity `arrayInstrumentations.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/arrayInstrumentations.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:1)。

如果：

- `baseHandlers.ts` 解决的是“数组作为对象属性访问时怎么响应式”
- `collectionHandlers.ts` 解决的是“集合方法怎么响应式”

那这个文件解决的是：

- 为什么数组不能只靠普通的 `get/set` trap
- 为什么 `includes/indexOf` 这类方法在代理对象场景下会出问题
- 为什么 `push/pop/splice` 会导致依赖递归，需要专门处理
- 为什么 `map/filter/find/reduce/iterator` 也要做一层包装

一句话先概括：

`arrayInstrumentations.ts` 是数组方法的专项修正层，用来补齐“仅靠 Proxy 普通属性拦截还不够准确”的那些数组语义。

## 1. 它在响应式系统里的位置

整体链路是：

```text
reactive([ ... ])
  -> reactive.ts 选择 baseHandlers
  -> baseHandlers.get() 读取数组方法
  -> 如果方法在 arrayInstrumentations 里
  -> 返回增强版数组方法
  -> 增强方法内部决定如何 track / 包装元素 / 避免误追踪
```

关键连接点在 [`baseHandlers.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/baseHandlers.ts:86)：

```ts
if (targetIsArray && (fn = arrayInstrumentations[key])) {
  return fn
}
```

这说明：

- 数组本身仍然走 `baseHandlers`
- 但某些数组方法会被替换成这里的“增强版实现”

## 2. 为什么数组不能只靠 `get/set`

数组虽然本质上也是对象，但它有几类普通对象没有的问题：

### 2.1 遍历类方法会读取很多元素

例如：

```ts
arr.map(...)
arr.forEach(...)
arr.entries()
for (const x of arr) {}
```

这些方法依赖的不是某个单独索引，而是“整个数组的遍历结果”。

### 2.2 查找类方法会碰到“代理对象和原始对象身份不一致”

例如：

```ts
const raw = {}
const arr = reactive([raw])

arr.includes(raw)          // true
arr.includes(reactive(raw)) // 语义上也应尽量匹配
```

如果只按普通数组原生行为比较，代理壳和原对象可能导致查找失败。

### 2.3 改长度的方法会误读 `length`

例如：

```ts
arr.push(x)
arr.splice(...)
```

这些方法内部会读写 `length`。如果此时正在依赖收集，可能把当前 effect 错误收集到 `length` 上，造成递归触发。

所以数组必须有专项修正层。

## 3. 先看两个基础读取函数

### `reactiveReadArray()`

源码位置：[`arrayInstrumentations.ts:16`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:16)

它做两件事：

1. 对原始数组收集 `ARRAY_ITERATE_KEY` 依赖
2. 如果当前是深响应式数组，就返回“原始数组 + 元素转 reactive”的浅包装结果

可以理解成：

```ts
读取整个数组视图
  -> 建立遍历依赖
  -> 保证后续方法看到的元素仍符合当前代理语义
```

### `shallowReadArray()`

源码位置：[`arrayInstrumentations.ts:25`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:25)

它更简单：

- 收集 `ARRAY_ITERATE_KEY`
- 直接返回原始数组

适合那些只需要遍历依赖、不需要深层包装元素的方法。

## 4. `apply()` 是遍历类方法的核心模板

源码位置：[`arrayInstrumentations.ts:38`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:38)

这是整个文件里最重要的函数之一。

它统一包装很多方法：

- `every`
- `filter`
- `find`
- `findIndex`
- `findLast`
- `findLastIndex`
- `forEach`
- `map`
- `some`

它做的核心事情是：

1. 用 `shallowReadArray(self)` 建立数组遍历依赖
2. 判断当前数组元素是否需要包装
3. 包装传给回调的元素和数组参数
4. 在必要时再包装返回值

你可以把它理解成：

**“把原生数组高阶方法变成响应式语义正确的版本。”**

例如 `filter()`：

- 回调拿到的元素应该是当前代理模式下的值
- 返回的新数组里的元素也要继续符合当前代理模式

所以这里不能简单原样调用原生 `filter`。

## 5. `iterator()` 为什么单独做

源码位置：[`arrayInstrumentations.ts:77`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:77)

它负责包装：

- `Symbol.iterator`
- `entries`
- `values`

逻辑是：

1. 先调用 `shallowReadArray(self)` 建立遍历依赖
2. 获取原始数组迭代器
3. 如果当前数组是深响应式数组，就改写迭代器的 `next()`
4. 每次 `next()` 产出的值都再做一次包装

这意味着：

```ts
for (const item of reactiveArr) {}
```

和：

```ts
reactiveArr.values()
reactiveArr.entries()
```

都不会只是“原始迭代器直接透出”，而是带响应式语义的迭代器。

## 6. `reduce()` 为什么也单独做

源码位置：[`arrayInstrumentations.ts:102`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:102)

`reduce` / `reduceRight` 比普通高阶方法多一个难点：

- 既有数组元素
- 又有累计值 `acc`

如果数组是深响应式数组，第一次没有初始值时，`acc` 本身也可能需要包装。

所以这里会额外处理：

- 首个累计值是否需要转成当前模式下的值
- 回调里的 `item` 是否需要包装
- 回调里的数组参数是否应该传当前代理数组

## 7. `includes/indexOf/lastIndexOf` 为什么要走 `searchProxy()`

源码位置：[`arrayInstrumentations.ts:132`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:132)

这是数组里最典型的“代理身份问题”。

例如：

```ts
const raw = {}
const proxyObj = reactive(raw)
const arr = reactive([raw])
```

如果你查：

```ts
arr.includes(proxyObj)
```

原生比较可能失败，因为：

- 数组里存的是 `raw`
- 你查的是 `proxyObj`

所以 `searchProxy()` 会：

1. 先在原始数组上按原参数查一遍
2. 如果没找到，且参数是代理对象
3. 再把参数 `toRaw()` 后重查一遍

这就是为什么 Vue 能尽量兼容“代理对象和原始对象混用”的查找场景。

同时它还会先：

```ts
track(arr, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
```

因为查找本质上依赖整个数组内容。

## 8. `toWrapped()` 是元素包装策略

源码位置：[`arrayInstrumentations.ts:152`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:152)

这个函数决定：

- 当前数组是只读时，元素应该转成只读
- 当前数组是可变响应式时，元素应该转成 reactive

它本质上是数组版的“根据当前代理模式包装读出值”。

这和：

- `baseHandlers.ts` 里对象属性读取时的包装
- `collectionHandlers.ts` 里集合值读取时的包装

属于同一类问题。

## 9. 哪些方法只是读，哪些方法会改

### 只读 / 遍历类

这些方法主要靠 `apply()`、`iterator()`、`reduce()`、`reactiveReadArray()`：

- `concat`
- `entries`
- `every`
- `filter`
- `find`
- `findIndex`
- `findLast`
- `findLastIndex`
- `forEach`
- `includes`
- `indexOf`
- `join`
- `lastIndexOf`
- `map`
- `reduce`
- `reduceRight`
- `some`
- `toReversed`
- `toSorted`
- `toSpliced`
- `values`
- `Symbol.iterator`

它们的重点是：

- 建立遍历依赖
- 包装元素或返回值

### 会改长度 / 改内容类

这些方法走 `noTracking()`：

- `pop`
- `push`
- `shift`
- `splice`
- `unshift`

它们的重点不是元素包装，而是：

- 暂停依赖收集
- 批量执行更新
- 避免 `length` 误收集导致递归

## 10. `noTracking()` 为什么这么重要

源码位置：[`arrayInstrumentations.ts:250`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/arrayInstrumentations.ts:250)

这是另一个最关键的函数。

```ts
pauseTracking()
startBatch()
const res = (toRaw(self) as any)[method].apply(self, args)
endBatch()
resetTracking()
```

这段代码的意义是：

### 先 `pauseTracking()`

避免 `push/pop/splice` 这些数组方法内部读取 `length` 时，把当前 effect 错误收集到 `length` 依赖上。

### 再 `startBatch()` / `endBatch()`

把这类方法内部可能引发的一连串变更放进同一批处理里，减少重复调度。

### 最后 `resetTracking()`

恢复外层原有的追踪状态。

所以 `noTracking()` 的本质是：

**“临时关闭收集，安全地执行数组结构性修改。”**

## 11. 它和其他文件的关系

### 和 `baseHandlers.ts`

[`baseHandlers.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/baseHandlers.ts:1) 是数组代理的总入口。

它负责：

- 拦截数组属性读取
- 在读取到特定数组方法时，把调用转发给 `arrayInstrumentations`

所以：

- `baseHandlers.ts` 是入口
- `arrayInstrumentations.ts` 是数组方法专项修正层

### 和 `dep.ts`

这个文件直接依赖 [`dep.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/dep.ts:1) 的：

- `track`
- `ARRAY_ITERATE_KEY`

也就是说，它不自己存依赖，只负责告诉依赖系统：

- “这次是数组遍历依赖”

真正的订阅关系仍然在 `dep.ts` 里。

### 和 `effect.ts`

它直接依赖 [`effect.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:1) 的：

- `pauseTracking`
- `resetTracking`
- `startBatch`
- `endBatch`

这说明数组方法的实现，不只是依赖收集问题，还和 effect 调度机制直接耦合。

特别是 `noTracking()`，本质上就是在借用 effect 层的“暂停收集 + 批处理”能力。

### 和 `reactive.ts`

`reactive.ts` 创建数组代理时，本质还是交给 `baseHandlers.ts`。  
而数组之所以表现得和普通对象不完全一样，正是因为 `baseHandlers.get()` 又在方法层转接到了这里。

所以关系是：

```text
reactive.ts
  -> baseHandlers.ts
  -> arrayInstrumentations.ts
```

## 12. 为什么这也说明 Vue 的数组响应式比“普通 Proxy”复杂

很多人以为给数组套个 `Proxy`，拦截一下 `get/set` 就够了，其实不够。

数组至少有三类特殊点：

1. 方法内部会隐式读很多元素和 `length`
2. 查找时会遇到代理对象和原始对象身份不一致
3. 遍历型 API 的依赖粒度不是单个索引，而是整个数组视图

所以 Vue 才需要单独维护 `arrayInstrumentations.ts`。

这也说明：

- `Proxy` 只是底层拦截能力
- 真正把语言语义接成“稳定的响应式语义”，还需要很多专项修正层

## 13. 最后把主线串起来

如果只记最重要主线，记下面这段就够了：

1. 数组代理本身仍然由 `baseHandlers.ts` 托管
2. 当读取到特定数组方法时，`baseHandlers.get()` 会返回 `arrayInstrumentations` 里的增强实现
3. 增强实现会负责：
   - 建立 `ARRAY_ITERATE_KEY` 依赖
   - 包装元素和返回值
   - 修正代理对象查找问题
   - 在 `push/splice` 这类方法里暂停依赖收集并做批处理
4. 最终再由 `dep.ts` 和 `effect.ts` 完成依赖更新

所以：

- `baseHandlers.ts` 解决数组“像对象一样”的那部分
- `arrayInstrumentations.ts` 解决数组“像数组一样”的那部分
- 两者合起来，数组响应式才真正完整
