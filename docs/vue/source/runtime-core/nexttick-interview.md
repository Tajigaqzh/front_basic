# nextTick 原理与常见面试题

`nextTick` 是一个几乎人人会用、但很多人解释不清的 API。

常见错误理解有两种：

1. `nextTick` 等于 `setTimeout`
2. `nextTick` 的作用是“延迟一下”

这两种都不准确。

更准确的说法是：

`nextTick` 用来等待“当前这轮调度刷新完成”。`

它关注的不是“延迟多久”，而是：

`等 Vue 把本轮应该更新的内容都更新完，再执行我。`

---

## 1. 为什么会需要 nextTick？

先看一个最常见场景：

```ts
count.value++
console.log(el.textContent)
```

很多人会以为这里马上能读到新 DOM。

但 Vue 的组件更新不是每次状态变化都立刻同步刷 DOM，而是：

1. 状态变化
2. 组件更新任务入队
3. 当前同步代码跑完
4. 微任务阶段统一刷新

所以在状态刚改完的那个同步时刻，DOM 往往还是旧的。

这时就需要：

```ts
await nextTick()
```

来等当前这轮调度刷新结束。

---

## 2. nextTick 的本质到底是什么？

在 `scheduler.ts` 里，`nextTick` 本质上就是：

- 如果当前已经安排了刷新，就复用那次刷新对应的 Promise
- 如果当前没有刷新，也返回一个基于已解决 Promise 的微任务

也就是说，`nextTick` 本质依赖的是：

- Promise 微任务
- 当前调度器这一轮 flush 的 Promise

所以它不是“随便异步一下”，而是：

`和 Vue 当前调度周期绑定在一起的微任务等待器。`

---

## 3. nextTick 和 scheduler 的关系是什么？

这是理解 `nextTick` 的核心。

Vue 组件更新链路一般是：

1. render 中依赖响应式数据
2. 数据变化
3. 组件 effect 被触发
4. `queueJob`
5. 微任务里 `flushJobs`

`nextTick` 就是等待这一步：

`flushJobs`

执行完。

所以：

- scheduler 决定“何时真正刷新”
- `nextTick` 负责“等这轮刷新结束”

---

## 4. 为什么 nextTick 不是 setTimeout？

因为 `setTimeout` 是宏任务，执行时机比微任务更晚。

而 Vue 调度器本身就是用微任务安排刷新的。

如果你用 `setTimeout`：

- 当然也可能拿到更新后的 DOM
- 但它等得更晚
- 并且和 Vue 的刷新周期不是严格绑定关系

而 `nextTick` 的优势是：

- 更早
- 更准确
- 直接和当前调度刷新挂钩

---

## 5. nextTick 等待的到底是什么？

很多人会笼统地说“等 DOM 更新完”。

这句话方向对，但不够精确。

更准确地说：

`nextTick` 等的是“当前这轮被调度器收集到的更新任务执行完”。`

通常这意味着：

- 组件 render 已重新执行
- patch 已经完成
- DOM 已同步到这一轮结果

所以在多数日常场景里，你可以把它近似理解成“等 DOM 更新完”，但底层本质仍然是“等待调度刷新完成”。

---

## 6. 多次 nextTick 会怎样？

如果当前这一轮刷新还没结束，多次调用 `nextTick()` 通常会复用同一个 `currentFlushPromise`。

这意味着：

- 它们不会各自安排新的整轮刷新
- 而是一起等当前这轮任务结束

这也是为什么 `nextTick` 本身开销并不大，它更多是在复用已有调度状态。

---

## 7. 常见面试题

## 1. nextTick 的本质是什么？

本质是等待当前这轮 Vue 调度刷新结束的微任务 Promise。

## 2. 为什么修改响应式数据后不能立刻拿到新 DOM？

因为组件更新通常不会同步立刻执行，而是先入 scheduler 队列，等微任务统一刷新。

## 3. nextTick 和 setTimeout 的区别是什么？

- `nextTick`：等待当前调度刷新，基于微任务
- `setTimeout`：普通宏任务延迟，和 Vue 调度周期没有严格绑定

## 4. nextTick 等待的是 DOM 还是调度器？

更底层地说，等待的是当前这轮调度器刷新；因为刷新里会完成 patch，所以通常表现成“等 DOM 更新完”。

## 5. 多次 nextTick 会不会重复安排很多次刷新？

一般不会。它们通常会复用当前这轮刷新 Promise。
