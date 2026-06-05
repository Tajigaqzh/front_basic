# Vue Reactivity `watch.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/watch.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:1)。

如果前两篇解决的是：

- `effect.ts` 负责副作用运行机制
- `computed.ts` 负责派生值与缓存

那这篇解决的是：

- `watch()` 和 `watchEffect()` 到底怎么落到 `ReactiveEffect`
- 为什么 `watch` 能拿到 `newValue` / `oldValue`
- `deep`、`immediate`、`once`、`cleanup`、`scheduler` 是怎么实现的

一句话先概括：

`watch.ts` 的本质是“用一个 ReactiveEffect 追踪 source，再在外面包一层比较、清理和调度逻辑”。

## 1. `watch` 和 `watchEffect` 的区别

先看用户层常见写法：

```ts
watch(source, (newValue, oldValue, onCleanup) => {
  // 值变化后执行
})
```

```ts
watchEffect((onCleanup) => {
  // 依赖变化后直接重跑
})
```

两者最核心的区别：

- `watch`
  关注“某个 source 的值变没变”
- `watchEffect`
  关注“函数里读到了哪些响应式依赖”

底层上它们最后都走到同一个 `watch()` 实现，只是：

- 有 `cb` 时，走 `watch(source, cb)` 分支
- 没有 `cb` 时，走 `watchEffect` 分支

源码入口：[`watch.ts:94`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:94)

## 2. `watch()` 的整体执行流程

把主线先压成一段：

```text
watch(source, cb, options)
  -> 把 source 统一转成 getter
  -> 用 getter 创建 ReactiveEffect
  -> 依赖变化时执行 job
  -> job 里重新跑 getter
  -> 比较 newValue / oldValue
  -> 决定是否执行 cb
```

如果是 `watchEffect`：

```text
watchEffect(fn)
  -> 把 fn 包成 getter
  -> 用 getter 创建 ReactiveEffect
  -> 依赖变化后直接重新执行 getter
```

所以这个文件最重要的两个概念是：

- `getter`
  统一 source 的读取入口
- `job`
  依赖变化后真正执行的逻辑

## 3. 为什么 `watch` 最后还是靠 `ReactiveEffect`

源码里最关键的一句在这里：

[`watch.ts:156`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:156)

```ts
effect = new ReactiveEffect(getter)
```

这说明：

- `watch` 没有自己重新造一套依赖系统
- 它还是复用了 `effect.ts` 那套依赖收集和触发机制

只是比普通 `effect` 多做了几件事：

- 把 source 统一成 getter
- 保存 oldValue
- 比较新旧值
- 管理 cleanup
- 处理 `immediate` / `once` / `deep`

所以可以把 `watch` 理解成：

“增强版 effect”

## 4. `source` 是怎么统一成 getter 的

源码位置：[`watch.ts:117`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:117)

这是这个文件最重要的预处理步骤。

### 4.1 `source` 是 `ref`

```ts
getter = () => source.value
```

意思很直接：

- watch 一个 ref，本质上就是读它的 `.value`

### 4.2 `source` 是 reactive 对象

```ts
getter = () => reactiveGetter(source)
```

这里不会简单返回对象，而是可能走 `traverse()` 做深度读取。

因为如果只返回对象引用：

- 对象内部属性变化时
- 引用不变
- 就没法建立足够的依赖

### 4.3 `source` 是数组

这对应多源 watch：

```ts
watch([a, b, () => c.value], cb)
```

内部会把每一项都规范化成可读取的值：

- `ref` 取 `.value`
- `reactive` 走 `reactiveGetter`
- 函数就直接执行

最后返回一个值数组。

### 4.4 `source` 是函数

这里要分两种情况：

- 有 `cb`
  说明是 `watch(getter, cb)`
- 没有 `cb`
  说明是 `watchEffect(fn)`

也就是说，函数 source 在 `watch` 里可能表示：

- “一个值来源 getter”
- 或者“一个副作用函数”

## 5. `watchEffect` 为什么不需要显式 source

因为它的 source 就是函数本身。

当 `watchEffect(fn)` 运行时：

- 会执行 `fn`
- 执行期间读到哪些响应式值
- 哪些值就会把当前 watcher 收集进去

所以：

```ts
watchEffect(() => {
  console.log(count.value, name.value)
})
```

等价于：

- 运行时自动把 `count` 和 `name` 作为依赖收集起来

这和 `effect()` 的思路一致，只是 `watchEffect` 多了 cleanup 和 watcher 语义。

## 6. `job` 是真正的触发逻辑

源码位置：[`watch.ts:224`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:224)

可以把 `job` 看成：

“依赖变化以后，到底要做什么”

它分成两个分支：

### 6.1 `watch(source, cb)`

做的事情是：

1. `effect.run()` 重新执行 getter，拿到 `newValue`
2. 判断是否真的需要触发
3. 如果需要，先执行上一次 cleanup
4. 再调用用户回调 `cb(newValue, oldValue, onCleanup)`
5. 最后更新 `oldValue`

### 6.2 `watchEffect(fn)`

就简单很多：

1. 直接 `effect.run()`

因为 `watchEffect` 不关心新旧值比较，它只关心“依赖变了就重跑”。

## 7. `newValue` 和 `oldValue` 是怎么来的

`oldValue` 初始不是直接设成 `undefined`，而是用一个哨兵值：

[`watch.ts:60`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:60)

```ts
const INITIAL_WATCHER_VALUE = {}
```

这样做是为了区分两种情况：

- 真正的旧值就是 `undefined`
- 这是第一次运行，还没有旧值

后面 `job()` 里会这样处理：

- 如果 `oldValue === INITIAL_WATCHER_VALUE`
  则把传给回调的旧值视为 `undefined`

所以 `watch` 能正确区分“首次触发”和“值确实从某个值变到另一个值”。

## 8. `deep` 为什么需要 `traverse()`

源码位置：[`watch.ts:290`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:290)

`deep watch` 的本质不是“比较深层对象差异”，而是：

“把嵌套属性都主动读一遍，从而建立深层依赖”

例如：

```ts
watch(state, cb, { deep: true })
```

如果不做 `traverse(state)`：

- 只读取 `state` 这个对象本身
- 并不会访问 `state.a.b.c`
- 这些深层字段就不会被依赖收集

`traverse()` 做的事就是递归读取：

- ref 的 `.value`
- 数组每一项
- Set / Map 里的值
- 普通对象的字符串键和 symbol 键

并且用 `seen` 防循环引用。

所以要准确理解：

- `deep` 不是深比较
- `deep` 是深度触达读取

## 9. `cleanup` 是怎么实现的

相关代码：

- [`watch.ts:66`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:66)
- [`watch.ts:78`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:78)

这里核心用了一个：

```ts
const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]>
```

意思是：

- 每个 watcher effect
- 都可以挂一组 cleanup 函数

用户在回调里调用：

```ts
onCleanup(() => {
  // 清理副作用
})
```

最终会走到：

```ts
onWatcherCleanup(fn, false, effect)
```

然后把 cleanup 绑定到当前 watcher 对应的 `ReactiveEffect` 上。

cleanup 触发时机有两个：

- 下次重新执行前
- watcher stop 时

这也是为什么 `watch` 特别适合处理：

- 请求取消
- 定时器清理
- 事件解绑

## 10. `activeWatcher` 是干什么的

源码位置：[`watch.ts:67`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:67)

```ts
let activeWatcher: ReactiveEffect | undefined = undefined
```

它和 `effect.ts` 里的 `activeSub` 很像，但用途更窄。

区别是：

- `activeSub`
  服务于依赖收集系统，表示当前活跃订阅者
- `activeWatcher`
  服务于 watcher cleanup 体系，表示当前活跃 watcher

为什么要单独来一个：

因为 `onWatcherCleanup()` 只关心：

- “当前 cleanup 应该挂到哪个 watcher 上”

而不是通用的依赖收集语义。

## 11. `immediate`、`once`、`scheduler` 怎么工作

### `immediate`

如果是：

```ts
watch(source, cb, { immediate: true })
```

初始化时不会只记录旧值，而是直接执行一次 `job(true)`。

也就是：

- 立刻跑 getter
- 立刻调用回调

### `once`

如果是：

```ts
watch(source, cb, { once: true })
```

源码会先包装 `cb`：

- 第一次触发后执行原始回调
- 然后立刻 `watchHandle()`
- 也就是 stop 当前 watch

### `scheduler`

默认情况下，依赖变化后会直接执行 `job`。

但如果传了自定义调度器：

```ts
watch(source, cb, {
  scheduler(job) {
    queueMicrotask(job)
  }
})
```

那变化发生时，不会马上跑 `job`，而是交给调度器决定何时执行。

底层对应：

[`watch.ts:263`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:263)

```ts
effect.scheduler = scheduler
  ? () => scheduler(job, false)
  : (job as EffectScheduler)
```

## 12. `pause()`、`resume()`、`stop()` 是怎么来的

返回值 `watchHandle` 不是普通函数，它还额外挂了：

- `pause`
- `resume`
- `stop`

源码位置：[`watch.ts:286`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:286)

本质上都转发到内部的 `ReactiveEffect`：

- `pause` -> `effect.pause()`
- `resume` -> `effect.resume()`
- `stop` -> `effect.stop()`

所以 watch 的生命周期控制，底层其实还是 effect 的生命周期控制。

## 13. `watch` 和 `effect`、`computed`、`ref` 的关系

把这几个对象串起来，最清楚的关系是：

### 和 `ref`

watch 一个 ref：

```ts
watch(count, cb)
```

本质上就是让 getter 读取 `count.value`，然后由 `ref.dep` 负责追踪和触发。

### 和 `computed`

watch 一个 computed：

```ts
watch(double, cb)
```

本质上就是读取 `double.value`。

此时：

- watcher 会订阅 `double.dep`
- `double` 自己又会订阅它底层依赖的数据源

链路是：

```text
source ref/reactive -> computed -> watcher
```

### 和 `effect`

watch 内部并没有脱离 effect 系统。

它只是：

- 用 `ReactiveEffect` 追踪 getter
- 再在外面包一层 watcher 语义

所以：

- `effect` 更底层
- `watch` 更偏用户 API

## 14. 最后用一句话串起来

如果只记最重要主线，记下面这段就够了：

1. `watch()` 先把 source 统一转换成 getter
2. 用这个 getter 创建一个 `ReactiveEffect`
3. getter 运行时建立依赖收集
4. 依赖变化时，由 effect 的 scheduler 触发 `job`
5. `job` 里重新执行 getter，得到新值
6. `watch` 比较新旧值，再决定是否调用回调
7. cleanup 在下次运行前或 stop 时执行

所以：

- `effect` 解决“怎么追踪和重跑”
- `computed` 解决“怎么缓存派生值”
- `watch` 解决“怎么把这些底层能力包装成稳定的侦听 API”
