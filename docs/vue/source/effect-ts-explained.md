# Vue Reactivity `effect.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/effect.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:1)。

它主要负责三件事：

- 定义 `ReactiveEffect`
- 管理当前活跃副作用 `activeSub`
- 处理依赖收集后的清理、脏检查和批量调度

一句话先概括：

`effect.ts` 负责“副作用怎么被注册、怎么收集依赖、依赖变了以后怎么重新执行”。

## 1. 它在响应式系统里的位置

把 `ref`、`dep`、`effect` 串起来看，调用链是这样的：

```text
effect(fn)
  -> ReactiveEffect.run()
  -> activeSub = 当前 effect
  -> 读取 ref.value / reactive[key]
  -> dep.track()
  -> 建立 dep 和 effect 的订阅关系

数据变化
  -> dep.trigger()
  -> effect.trigger()
  -> effect.run()
```

对应职责：

- `effect.ts`
  管副作用执行与调度
- `ref.ts`
  在 `.value` 的 `get/set` 上接入依赖系统
- `dep.ts`
  管理依赖桶 `Dep` 和连接关系 `Link`

## 2. 先看几个核心角色

### `activeSub`

源码位置：[`effect.ts:38`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:38)

```ts
export let activeSub: Subscriber | undefined
```

它表示“当前正在执行、允许被依赖收集的订阅者”。

谁会用它：

- `Dep.track()`
- `track()`
- `RefImpl.value` 的 getter 间接会用到它

只要某段代码执行时 `activeSub` 指向某个 effect，那么这段代码里读到的响应式数据，就会把这个 effect 收集进去。

### `Subscriber`

源码位置：[`effect.ts:54`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:54)

`Subscriber` 是一个接口，不只普通 `effect` 能实现，`computed` 也能实现。

所以从底层设计上看：

- `ReactiveEffect` 是订阅者
- `ComputedRefImpl` 也是订阅者

这也是为什么 `dep.ts` 不直接把订阅者写死成 `ReactiveEffect`，而是抽象成 `Subscriber`。

### `ReactiveEffect`

源码位置：[`effect.ts:87`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:87)

它是 `effect(fn)` 创建出来的真正实体，核心字段有：

- `fn`
  副作用函数本体
- `deps` / `depsTail`
  当前 effect 依赖了哪些 `dep`
- `flags`
  当前 effect 的状态位
- `scheduler`
  自定义调度器
- `cleanup`
  重新执行前或停止时的清理函数

## 3. `effect()` 怎么用

源码位置：[`effect.ts:473`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:473)

最常见的用法：

```ts
const count = ref(0)

const runner = effect(() => {
  console.log(count.value)
})
```

这里发生的事：

1. `effect()` 创建一个 `ReactiveEffect`
2. 立即调用 `e.run()`
3. `run()` 把 `activeSub` 设成当前 effect
4. 执行函数体，读到 `count.value`
5. `count.value` 内部执行 `dep.track()`
6. `dep.track()` 把当前 `activeSub` 记为订阅者

返回值 `runner` 也可以手动再调用：

```ts
runner()
```

它本质就是：

```ts
e.run.bind(e)
```

## 4. `ReactiveEffect.run()` 干了什么

源码位置：[`effect.ts:162`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:162)

这是整个文件最核心的函数。

执行流程可以概括成：

1. 如果 effect 已经失活，直接执行原函数，不做依赖收集
2. 标记当前 effect 正在运行
3. 执行上一次注册的 cleanup
4. 调用 `prepareDeps()`，把旧依赖先标成“待清理”
5. 保存旧的 `activeSub` 和 `shouldTrack`
6. 把当前 effect 设为 `activeSub`
7. 打开依赖收集开关
8. 执行用户传入的 `fn`
9. 调用 `cleanupDeps()`，把本轮没访问到的旧依赖删掉
10. 恢复上一个 effect 上下文

所以 `run()` 的本质不是“单纯执行函数”，而是：

- 建立依赖收集上下文
- 执行副作用
- 清理无效依赖

## 5. `stop()` 怎么用

源码位置：[`effect.ts:188`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:188)

外部通常这样调用：

```ts
const runner = effect(() => {
  console.log(count.value)
})

stop(runner)
```

或直接：

```ts
runner.effect.stop()
```

它做的事有：

- 把当前 effect 从所有 `dep` 的订阅列表里移除
- 清空自己的依赖链
- 执行 cleanup
- 执行 `onStop`
- 把 `ACTIVE` 标记去掉

停止后，再改依赖的数据，就不会再触发这个 effect。

## 6. `trigger()` 和 `scheduler`

源码位置：[`effect.ts:200`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:200)

当某个依赖变化时，最终会调用到 effect 的 `trigger()`。

逻辑很直接：

- 如果 effect 处于暂停状态，先放进待执行队列
- 如果传了 `scheduler`，优先交给调度器处理
- 否则走 `runIfDirty()`

示例：

```ts
effect(
  () => {
    console.log(count.value)
  },
  {
    scheduler() {
      console.log('先调度，之后再决定何时执行')
    }
  }
)
```

这时依赖变化后不会立刻执行副作用函数，而是先执行 `scheduler`。

## 7. 依赖是怎么收集进去的

要把这一段看清，需要把 [`ref.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/ref.ts:111) 和 [`dep.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/dep.ts:82) 一起看。

例如：

```ts
const count = ref(0)

effect(() => {
  console.log(count.value)
})
```

执行到 `count.value` 时：

1. `RefImpl.get value()` 被调用
2. 内部执行 `this.dep.track()`
3. `dep.track()` 发现现在有 `activeSub`
4. 创建一个 `Link(activeSub, dep)`
5. 把这个 `Link` 挂到两条链上

两条链分别是：

- effect 这一侧的 `deps` 链
- dep 这一侧的 `subs` 链

所以 effect 和 dep 是双向可达的：

- 从 effect 能知道“我依赖了谁”
- 从 dep 能知道“谁依赖了我”

## 8. `effect.ts` 和 `ref` 的关系

`ref` 负责“在读取和写入时调用依赖系统”，`effect.ts` 负责“依赖系统里副作用如何运行”。

可以这样记：

- `ref` 是响应式值容器
- `dep` 是这个值容器对应的依赖桶
- `effect` 是订阅这个桶的副作用

具体到 `RefImpl`：

```ts
get value() {
  this.dep.track()
  return this._value
}

set value(newValue) {
  if (hasChanged(newValue, oldValue)) {
    this._value = newValue
    this.dep.trigger()
  }
}
```

所以关系非常直接：

- 读 `ref.value`
  会把当前 `effect` 收集进 `ref.dep`
- 写 `ref.value`
  会通知 `ref.dep` 里的所有订阅者重新运行

## 9. `effect.ts` 和 `dep` 的关系

`effect.ts` 自己不创建具体的依赖桶，它依赖 `dep.ts` 提供的结构。

两边的分工是：

- `effect.ts`
  管“副作用对象”和“副作用生命周期”
- `dep.ts`
  管“依赖桶”和“订阅关系”

关键连接点有两个：

### `prepareDeps()`

源码位置：[`effect.ts:307`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:307)

在 effect 重新执行前，把旧依赖的 `link.version` 先标成 `-1`。

意思是：

“这些是上次依赖过的，但这次还不确定会不会继续依赖。”

### `cleanupDeps()`

源码位置：[`effect.ts:319`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:319)

重新执行后，凡是这轮没有重新访问到的依赖，都会被删掉。

这解决了分支切换问题，例如：

```ts
effect(() => {
  if (flag.value) {
    console.log(a.value)
  } else {
    console.log(b.value)
  }
})
```

当 `flag` 从 `true` 变成 `false` 时：

- 这轮不再访问 `a.value`
- 会开始访问 `b.value`
- `cleanupDeps()` 会把 `a` 对应的依赖移除

否则 effect 会一直同时订阅 `a` 和 `b`，产生错误更新。

## 10. `batch()`、`startBatch()`、`endBatch()` 是干什么的

源码位置：

- [`effect.ts:245`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:245)
- [`effect.ts:260`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:260)
- [`effect.ts:268`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:268)

这组函数负责批量调度，避免一次连续修改里 effect 被重复执行多次。

思路是：

- 先把需要通知的订阅者放进队列
- 等当前批次结束，再统一触发

这就是为什么 `Dep.notify()` 里会包一层：

```ts
startBatch()
try {
  // notify subs
} finally {
  endBatch()
}
```

## 11. `isDirty()` 和 `refreshComputed()` 为什么在这里

源码位置：

- [`effect.ts:347`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:347)
- [`effect.ts:370`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:370)

因为 `computed` 和普通 effect 用的是同一套订阅模型。

区别只是：

- 普通 effect 关注“要不要重新执行副作用函数”
- computed 关注“要不要重新计算缓存值”

所以这个文件里除了 `ReactiveEffect`，还顺便承担了：

- computed 的脏检查
- computed 的刷新逻辑

你可以把 `computed` 看成：

“一个带缓存的特殊订阅者”

## 12. 最后用一句话串起来

如果只记主线，记下面这段就够了：

1. `effect(fn)` 创建 `ReactiveEffect`
2. `run()` 执行时把它挂到 `activeSub`
3. 读取 `ref.value` / `reactive[key]` 时触发 `dep.track()`
4. `dep.track()` 把当前 effect 收集为订阅者
5. 数据变化时调用 `dep.trigger()`
6. `dep.trigger()` 最终触发 `effect.trigger()`
7. effect 重新 `run()`，完成更新

所以：

- `ref` 负责暴露响应式读写点
- `dep` 负责存储订阅关系
- `effect.ts` 负责副作用运行机制

它们三个合起来，才构成完整的 Vue 响应式闭环。
