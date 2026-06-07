# Renderer 更新链阅读地图

这一页只做一件事：

`把 renderer.ts 里“普通更新链”相关的文档串成一条可读路径。`

如果你现在的问题不是“diff 是什么”，而是：

- `patch()` 往下到底怎么落到元素更新
- `Fragment`、`block`、`move`、`patchProps` 分别卡在哪一层
- 这些文档已经写出来了，但不知道先后顺序

那就按这张地图走。

---

## 1. 先看什么

如果你想从总览一路走到局部细节，推荐顺序是：

1. [renderer.ts 核心步骤](./renderer-ts-explained.md)
2. [元素更新源码走读](./element-update-source-walkthrough.md)
3. [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)
4. [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)
5. [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)
6. [`move()` 源码走读](./move-source-walkthrough.md)
7. [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)

这条顺序的核心思路是：

- 先知道总入口和分流
- 再看普通元素怎么挂载/更新
- 再看 children diff 怎么做
- 再补 Fragment / block 快路径
- 再补 props 更新
- 最后补移动和 LIS

---

## 2. 每篇分别解决什么问题

### `renderer-ts-explained.md`

解决：

- `renderer.ts` 这份文件整体在做什么
- `patch()`、`processElement()`、`processComponent()` 的总体位置

适合：

`还没建立 renderer 全局感时先看。`

### `element-update-source-walkthrough.md`

解决：

- `processElement()` 怎么决定 mount 还是 patch
- `mountElement()` 首次挂载的顺序是什么
- `patchElement()` 更新时 children 和 props 怎么分流

适合：

`想把普通元素更新链打通时看。`

### `diff-algorithm-source-walkthrough.md`

解决：

- `patchChildren()` 的总分流
- `patchUnkeyedChildren()` 和 `patchKeyedChildren()` 的主线
- 未知区间、LIS、倒序挂载/移动

适合：

`已经进入 children diff 细节时看。`

### `fragment-block-source-walkthrough.md`

解决：

- 为什么 Fragment 要靠 start / end 锚点
- `PatchFlags.STABLE_FRAGMENT` 命中后为什么走 `patchBlockChildren()`
- `dynamicChildren` 在 block tree 里到底是什么

适合：

`看懂普通元素后，开始卡 Fragment / block 优化时看。`

### `patch-props-source-walkthrough.md`

解决：

- `patchProps()` 为什么先删旧 key、再补新值
- `value` 为什么要单独处理
- `patchProps()` 和 `patchFlag` 快路径是什么关系

适合：

`想补齐 props 更新这一层时看。`

### `move-source-walkthrough.md`

解决：

- 为什么“复用”和“移动”是两层事情
- `move()` 怎么处理普通元素、组件、Fragment、Teleport、Suspense
- `anchor` 为什么是移动的关键输入

适合：

`已经理解 keyed diff，但还没理解宿主移动如何落地时看。`

### `lis-get-sequence-explained.md`

解决：

- `getSequence()` 为什么返回的是下标集合
- 为什么二分替换不会把答案弄错
- 为什么最后还要回溯

适合：

`只在 LIS 这一个函数上卡住时看。`

---

## 3. 按问题找文档

### 想知道 `patch()` 进了普通元素后发生什么

先看：

- [元素更新源码走读](./element-update-source-walkthrough.md)

重点章节：

- `1. 这几段代码在链路里的位置`
- `2. processElement() 只做一次总判断`
- `4. patchElement() 更新时先做什么`

### 想知道 children diff 从哪一层进入

先看：

- [元素更新源码走读](./element-update-source-walkthrough.md)
- [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)

前者解决入口位置，后者解决 children 内部细节。

### 想知道 block tree 为什么能跳过整轮 children diff

先看：

- [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)

重点章节：

- `5. 更新时为什么先看 STABLE_FRAGMENT`
- `7. patchBlockChildren() 其实在做什么`

### 想知道 props 更新什么时候走快路径、什么时候走完整 diff

先看：

- [元素更新源码走读](./element-update-source-walkthrough.md)
- [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)

### 想知道 DOM 位置移动最后怎么真正执行

先看：

- [`move()` 源码走读](./move-source-walkthrough.md)

重点章节：

- `1. move() 在哪条链路里出现`
- `6. 普通元素的移动是怎么落地的`
- `7. 为什么 anchor 这么重要`

### 想知道 LIS 为什么决定“不移动谁”

先看：

- [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)

---

## 4. 一条完整的 renderer 更新链

你可以把普通元素更新链压成这样：

```text
patch()
  -> processElement()
    -> mountElement() / patchElement()
         -> patchChildren()
              -> patchUnkeyedChildren() / patchKeyedChildren()
                   -> getSequence()
                   -> move()
         -> patchProps()
```

而 Fragment / block 这条支线是：

```text
patch()
  -> processFragment()
       -> patchChildren()
       -> patchBlockChildren()
```

这两条线合起来，基本就是 renderer 更新链最核心的部分。

---

## 5. 最短阅读路径

如果你时间不多，但想把 renderer 更新链打通，按这个顺序就够：

1. [renderer.ts 核心步骤](./renderer-ts-explained.md)
2. [元素更新源码走读](./element-update-source-walkthrough.md)
3. [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)
4. [`move()` 源码走读](./move-source-walkthrough.md)
5. 如果还卡 Fragment / block，再补 [Fragment / Block 更新源码走读](./fragment-block-source-walkthrough.md)
6. 如果还卡 props，再补 [`patchProps()` 源码走读](./patch-props-source-walkthrough.md)
7. 如果只卡 LIS，再补 [`getSequence()` 逐行解释](./lis-get-sequence-explained.md)

---

## 6. 和其他导航页怎么配合

如果你更偏 diff 主题本身，先看：

- [Diff 阅读地图](./diff-reading-map.md)

如果你想回到 runtime-core 总目录，去看组件、调度器、VNode 等其他模块，回到：

- [Runtime Core](./index.md)
