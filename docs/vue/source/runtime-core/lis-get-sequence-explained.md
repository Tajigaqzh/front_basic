# `getSequence()` 逐行解释

如果你想先确认这组文档的阅读顺序，先看 [Diff 阅读地图](./diff-reading-map.md)。

这篇只讲一个函数：

`renderer.ts` 里的 `getSequence(arr)` 到底在做什么。`

如果你还没搞清楚它在 diff 链路里的位置，先看：

- [Diff 算法与常见面试题](./diff-algorithm-interview.md)
- [Diff 算法源码走读](./diff-algorithm-source-walkthrough.md)

---

## 1. 先别看代码，先看任务

`getSequence()` 在 Vue keyed diff 里的任务不是：

- 比较两个数组谁更像
- 找公共子串
- 找出哪些节点要删除

它只做一件事：

`在 newIndexToOldIndexMap 里，找出最长递增子序列对应的下标。`

这个结果会被 `patchKeyedChildren()` 用来判断：

- 哪些新位置上的节点可以不移动
- 哪些新位置上的节点必须移动

所以先记一句最重要的话：

`getSequence()` 返回的是“可以不移动的那批新位置下标”。`

---

## 2. 输入数组到底是什么

它的输入不是 vnode 数组，而是：

```ts
newIndexToOldIndexMap
```

例如：

```ts
[4, 2, 1, 3]
```

它表示：

- 新位置 0 对应旧位置 3，所以记 `4`
- 新位置 1 对应旧位置 1，所以记 `2`
- 新位置 2 对应旧位置 0，所以记 `1`
- 新位置 3 对应旧位置 2，所以记 `3`

注意：

- `0` 表示新增节点
- 非 `0` 表示复用了旧节点

也就是说，`getSequence()` 真正处理的是：

`新位置对应的旧位置顺序。`

如果这个顺序本身是递增的，说明这些节点的相对顺序没乱，可以不移动。

---

## 3. 先看源码原文

源码位置：

`vue-source/packages/runtime-core/src/renderer.ts:2759`

```ts
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
```

---

## 4. 先理解两个辅助数组

### `result`

`result` 不是最终的值序列，它存的是：

`当前已知的最长递增子序列候选，其对应元素下标。`

比如：

```ts
result = [2, 3]
```

意思不是“递增子序列是 2,3”，而是：

`递增子序列当前对应 arr[2] 和 arr[3] 这两个位置。`

### `p`

`p` 是前驱数组。

它记录的是：

`某个位置如果接到递增链上，它的前一个位置是谁。`

最后回溯真正路径时，就靠它把整条链重新串出来。

所以：

- `result` 负责维护“每种长度下，结尾最优的是谁”
- `p` 负责最后把完整路径找回来

---

## 5. 为什么一开始是 `const result = [0]`

```ts
const result = [0]
```

这表示：

`先假设当前最长递增子序列的结尾是 arr[0]。`

注意这只是初始化手法，不代表 `arr[0]` 一定会留到最后。

后续如果有更好的候选，`result` 里的值会被替换。

---

## 6. 主循环到底在做什么

主循环：

```ts
for (i = 0; i < len; i++) {
  const arrI = arr[i]
  if (arrI !== 0) {
    ...
  }
}
```

这里有两个关键点。

### 第一，跳过 `0`

```ts
if (arrI !== 0)
```

因为 `0` 表示新增节点。

新增节点不参与“旧节点相对顺序是否稳定”的判断，所以 LIS 直接跳过它。

### 第二，只处理“可复用旧节点”

非 `0` 才表示某个新位置复用了旧节点。

所以主循环实际在问：

`这些被复用的旧节点，在新顺序里哪些已经天然有序？`

---

## 7. 能直接接到末尾，就直接扩展

这段代码：

```ts
j = result[result.length - 1]
if (arr[j] < arrI) {
  p[i] = j
  result.push(i)
  continue
}
```

意思是：

如果当前值 `arrI` 比当前最长链的结尾还大，那它可以直接接到后面。

例如现在：

```ts
arr = [2, 4, 1, 3]
result 对应值 = [2, 4]
```

如果下一个值是 `5`，那就可以直接扩成：

```ts
[2, 4, 5]
```

这里同时会记录：

```ts
p[i] = j
```

表示“当前这个位置的前驱，是刚才那条链的结尾位置”。

---

## 8. 不能直接接末尾，就用二分替换

如果当前值不能直接接在末尾，就不能简单丢掉。

因为它虽然没法让当前链更长，但可能能让某个长度的链拥有“更小的结尾值”，从而给后面留出更大扩展空间。

这就是下面这段二分查找的目的：

```ts
u = 0
v = result.length - 1
while (u < v) {
  c = (u + v) >> 1
  if (arr[result[c]] < arrI) {
    u = c + 1
  } else {
    v = c
  }
}
```

它要找的是：

`result 中第一个对应值大于等于 arrI 的位置。`

找到后，如果 `arrI` 更优，就替换掉：

```ts
if (arrI < arr[result[u]]) {
  if (u > 0) {
    p[i] = result[u - 1]
  }
  result[u] = i
}
```

这里的意思是：

- 当前长度不变
- 但把这个长度对应的“结尾位置”换成一个更小的值

为什么这叫“更优”？

因为结尾越小，越容易接上后面更大的数。

---

## 9. 用一个最小例子走一遍

假设：

```ts
arr = [2, 4, 1, 3]
```

### 第 1 步：看 2

- `result = [0]`
- 当前链对应值是 `[2]`

### 第 2 步：看 4

`4` 比当前结尾 `2` 大，所以直接接上：

- `p[1] = 0`
- `result = [0, 1]`

当前链对应值是：

```ts
[2, 4]
```

### 第 3 步：看 1

`1` 不能接到 `4` 后面。

于是二分找到应该替换的位置是开头，得到：

- `result = [2, 1]`

这里别误解。

它不是说最终答案变成了 `[1, 4]` 这种奇怪东西，而是说：

- 长度为 1 的递增链
- 现在用位置 2 对应的值 `1` 作为结尾更优

因为 `1` 比 `2` 更小，后面更容易接别的值。

### 第 4 步：看 3

`3` 不能接到 `4` 后面，但可以接到 `1` 后面。

所以最终会形成一条更优的链。

最后回溯后，真正得到的下标序列是：

```ts
[2, 3]
```

对应值是：

```ts
[1, 3]
```

这就是一个最长递增子序列。

---

## 10. 为什么最后还要回溯

前面维护 `result` 的过程，并不保证 `result` 本身始终就是最终完整路径。

它更多是在维护：

`每个长度下，当前最优结尾是谁。`

所以最后要靠 `p` 回溯：

```ts
u = result.length
v = result[u - 1]
while (u-- > 0) {
  result[u] = v
  v = p[v]
}
```

这段的意思是：

1. 从当前最长链的最后一个位置开始
2. 沿着前驱数组一路往前找
3. 把整条真实路径反向填回 `result`

回溯完成后，`result` 才变成真正的“LIS 下标集合”。

---

## 11. 放回 Vue diff 里看，它到底帮了什么忙

再回到 `patchKeyedChildren()`：

```ts
const increasingNewIndexSequence = moved
  ? getSequence(newIndexToOldIndexMap)
  : EMPTY_ARR
```

这里的返回值会被用在：

```ts
if (j < 0 || i !== increasingNewIndexSequence[j]) {
  move(nextChild, container, anchor, MoveType.REORDER)
} else {
  j--
}
```

意思很明确：

- 当前新位置下标在 LIS 里：不移动
- 不在 LIS 里：移动

所以 `getSequence()` 的价值不是“更快找到不同点”，而是：

`在已经知道哪些节点能复用之后，再把需要移动的节点数降下来。`

---

## 12. 读这段代码时最容易误解的 5 件事

### 1. 它返回的不是值，而是下标

最终返回的是：

`arr` 里哪些位置构成 LIS。`

不是直接返回 LIS 的值集合。

### 2. 它忽略 `0`

`0` 是新增节点，不参与复用节点的相对顺序判断。

### 3. `result` 中途不是最终答案

中途的 `result` 更像“候选尾部表”，最后回溯后才是完整答案。

### 4. 替换不是变差，而是在变优

用更小的值替换同长度链的结尾，是为了给后续扩展留空间。

### 5. 它优化的是移动，不是 patch

节点要不要 `patch`，前面扫描旧节点时已经决定了。

`getSequence()` 只决定：

`这些已经复用成功的节点里，谁还需要 move。`

---

## 13. 最后压缩成一句话

如果你要把 `getSequence()` 讲给别人听，可以直接说：

`它在 newIndexToOldIndexMap 上求最长递增子序列的下标，找出那些在新顺序里已经天然有序的复用节点，让它们不移动，只移动剩下那些必须调整位置的节点。`
