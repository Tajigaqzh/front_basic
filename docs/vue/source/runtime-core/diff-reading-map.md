# Diff 阅读地图

这一组文档对应 Vue 运行时里的 diff 主线，核心源码都在：

`vue-source/packages/runtime-core/src/renderer.ts`

如果你现在看 diff 经常卡在两个地方：

- 知道概念，但对不上源码
- 能看懂局部函数，但不知道先看哪篇

那就按这张阅读地图走。

---

## 1. 先看什么

如果你是第一次系统看这块，推荐顺序是：

1. [Diff 算法与常见面试题](./diff-algorithm-interview.md)
2. [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)
3. [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)
4. [元素更新源码走读](./element-update-source-walkthrough.md)
5. [`move()` 源码走读](./move-source-walkthrough.md)
6. [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)
7. [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)

这三篇的分工不同：

- `diff-algorithm-interview.md`
  解决“diff 在做什么、为什么这么做、典型场景怎么理解”
- `diff-algorithm-source-walkthrough.md`
  解决“`patchChildren` 到 `patchKeyedChildren` 的代码到底怎么走”
- `lis-get-sequence-explained.md`
  解决“为什么 LIS 能减少移动、`getSequence()` 每段代码在干什么”
- `element-update-source-walkthrough.md`
  解决“普通元素从 `processElement()` 到 `patchElement()` 怎么完成挂载和更新”
- `move-source-walkthrough.md`
  解决“节点已经复用后，宿主位置怎么真正移动”
- `fragment-block-source-walkthrough.md`
  解决“Fragment、stable fragment、dynamicChildren、patchBlockChildren 这条快路径怎么工作”
- `patch-props-source-walkthrough.md`
  解决“元素复用后，props 怎么做完整 diff 和宿主更新”

---

## 2. 每篇适合什么时候看

### 你只想快速建立整体认知

看：

- [Diff 算法与常见面试题](./diff-algorithm-interview.md)

这篇适合先把下面这些问题搞清楚：

- diff 比较的是谁和谁
- 为什么只做同层比较
- `key` 到底解决什么问题
- 子节点新增、删除、打乱时分别怎么处理
- 为什么最后要用 LIS

### 你准备对着源码顺着读

看：

- [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)

这篇按源码顺序拆开了：

- `patchChildren()`
- `patchUnkeyedChildren()`
- `patchKeyedChildren()`
- 未知区间处理
- `newIndexToOldIndexMap`
- 倒序挂载和移动

### 你卡在 `getSequence()` 这一个函数

看：

- [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)

这篇不再讲整个 diff，只讲：

- 输入数组是什么
- `result` 和 `p` 是什么
- 为什么要二分
- 为什么最后要回溯
- 返回值为什么是“下标集合”

---

## 3. 如果你只想搞懂一个具体问题

### 想看 children 分支总决策

先看：

- [Diff 算法与常见面试题](./diff-algorithm-interview.md)

重点章节：

- `4. 元素节点 diff 的主线是什么？`
- `4.0 文本、数组、空 children 之间是怎么切换的？`

### 想看 keyed diff 的 5 个阶段

先看：

- [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)

重点章节：

- `6. patchKeyedChildren() 才是核心`
- `7. 未知区间的 3 个子阶段`

### 想看“最大程度复用”到底是什么意思

先看：

- [Diff 算法与常见面试题](./diff-algorithm-interview.md)

重点章节：

- `4.3 完全打乱子节点是怎么 diff 的？`
- `7. 中间乱序区间为什么要用最长递增子序列？`

### 想看 LIS 为什么能减少 move

先看：

- [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)

重点章节：

- `1. 先别看代码，先看任务`
- `9. 用一个最小例子走一遍`
- `11. 放回 Vue diff 里看，它到底帮了什么忙`

---

## 4. 和 runtime-core 其他文档怎么衔接

如果你准备继续往上游和下游看，建议这样接：

上游：

- [renderer.ts 核心步骤](./renderer-ts-explained.md)
  先确认 `patch()`、`processElement()`、`patchElement()` 的位置

下游：

- [组件更新链路常见面试题](./component-update-interview.md)
  看 diff 结果是怎么进入组件更新链路的

配套总目录：

- [Runtime Core](./index.md)

如果你准备继续把 renderer 更新链补全，可以接着看：

- [元素更新源码走读](./element-update-source-walkthrough.md)
- [`move()` 源码走读](./move-source-walkthrough.md)
- [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)
- [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)

---

## 5. 最短阅读路径

如果你时间不多，只想用最短路径把这块打通，按这个顺序读：

1. [Diff 算法与常见面试题](./diff-algorithm-interview.md)
2. [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)
3. 回头看 `renderer.ts` 里的 `patchChildren()` 到 `patchKeyedChildren()`
4. 如果卡在 LIS，再补 [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)
5. 如果想把元素更新和节点移动也串起来，再读 [元素更新源码走读](./element-update-source-walkthrough.md) 和 [`move()` 源码走读](./move-source-walkthrough.md)
6. 如果想把 Fragment / block 优化和 props 更新也补齐，再读 [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md) 和 [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)

这样不会一上来就被 `getSequence()` 细节拖住。
