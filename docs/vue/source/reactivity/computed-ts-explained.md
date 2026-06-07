# Vue Reactivity `computed.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/computed.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:1)。

如果上一份 [`effect.ts` 详解](./effect-ts-explained.md) 解决的是“副作用怎么跑”，那这一份解决的是：

- `computed()` 是怎么创建的
- 为什么它有缓存
- 为什么依赖变了以后它不会立刻重算
- 它和 `effect`、`ref`、`dep` 的关系是什么

一句话先概括：

`computed` 本质上是“一个带缓存、可被订阅、同时自己也会订阅别人的特殊 ref”。

## 1. `computed` 在响应式系统里的位置

先把主线放出来：

```text
computed(getter)
  -> 创建 ComputedRefImpl
  -> 读取 computed.value 时
  -> 先收集“谁依赖了这个 computed”
  -> 再调用 refreshComputed(this)
  -> 如果脏了就重新执行 getter
  -> 返回缓存值
```

依赖变化时：

```text
getter 内部依赖的数据变化
  -> 对应 dep.trigger()
  -> computed.notify()
  -> 只标记 DIRTY，不立刻重算
  -> 下次有人读 computed.value 时再重算
```

这就是 `computed` 和普通 `effect` 的核心区别：

- `effect`
  依赖一变，通常就要重新执行
- `computed`
  依赖一变，先标脏，等下次读取时再懒执行

## 2. 对外怎么用

源码入口：[`computed.ts:132`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:132)

最常见的只读写法：

```ts
const count = ref(1)

const double = computed(() => count.value * 2)

console.log(double.value) // 2
```

可写写法：

```ts
const count = ref(1)

const plusOne = computed({
  get: () => count.value + 1,
  set: (value) => {
    count.value = value - 1
  }
})
```

这里要记两个点：

- `computed()` 返回的不是普通值，而是一个 ref 风格对象
- 真正触发计算的是读 `computed.value`

## 3. `ComputedRefImpl` 是什么

源码位置：[`computed.ts:33`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:33)

`computed()` 内部真正创建的是 `ComputedRefImpl`。

它最重要的几个字段：

- `_value`
  缓存下来的计算结果
- `dep`
  别人依赖当前 computed 时，用这个 dep 收集订阅者
- `deps` / `depsTail`
  当前 computed 自己依赖了哪些别的 dep
- `flags`
  当前 computed 的状态，初始就是 `DIRTY`
- `globalVersion`
  和全局响应式版本号对比，用于快速跳过无意义刷新
- `fn`
  用户传进来的 getter
- `setter`
  可写 computed 的 setter

所以 `computed` 有两层依赖关系：

1. 它作为“订阅者”，去依赖别人的 dep
2. 它作为“数据源”，让别人依赖自己的 dep

这就是它和普通 `ref` 最不一样的地方。

## 4. 为什么说它“既是订阅者，也是被订阅者”

先看这两个事实：

- `ComputedRefImpl implements Subscriber`
- 它内部还有一个 `dep = new Dep(this)`

这意味着：

### 第一层身份：订阅者

`computed` 的 getter 执行时，会读取 `ref.value`、`reactive[key]` 或别的 `computed.value`。  
这些读取会把当前 `computed` 收集进去。

例如：

```ts
const count = ref(1)
const double = computed(() => count.value * 2)
```

这里 `double` 会订阅 `count` 对应的 `dep`。

### 第二层身份：被订阅者

如果别的 effect 又读取了 `double.value`：

```ts
effect(() => {
  console.log(double.value)
})
```

那这个 effect 会订阅 `double.dep`。

所以结构是这样的：

```text
count.dep  -> 订阅者里有 computed(double)
double.dep -> 订阅者里有 effect(render/watchEffect)
```

这也是为什么 `computed` 能作为中间层，把底层数据变化继续向上传播。

## 5. `get value()` 干了什么

源码位置：[`computed.ts:98`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:98)

这是整个文件最关键的入口。

逻辑只有三步，但很重要：

1. `this.dep.track()`
2. `refreshComputed(this)`
3. 返回 `this._value`

可以直接看成：

```ts
get value() {
  const link = this.dep.track()
  refreshComputed(this)
  if (link) {
    link.version = this.dep.version
  }
  return this._value
}
```

含义分别是：

- 第一步：先收集“谁正在读取我”
- 第二步：再决定我自己要不要重算
- 第三步：返回缓存值

这个顺序很关键，因为 `computed.value` 既是读取点，也是派生值入口。

## 6. 为什么 `computed` 有缓存

缓存就在 `_value` 里。

第一次读取 `computed.value` 时：

- 会执行 getter
- 把结果写进 `_value`

后面重复读取时：

- 只要没有变脏
- 就直接返回 `_value`

这就是为什么：

```ts
const double = computed(() => {
  console.log('run')
  return count.value * 2
})

console.log(double.value)
console.log(double.value)
```

正常情况下只会打印一次 `run`。

## 7. 为什么依赖变了以后它不立刻重算

关键在 `notify()`。

源码位置：[`computed.ts:86`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:86)

```ts
notify(): true | void {
  this.flags |= EffectFlags.DIRTY
  if (!(this.flags & EffectFlags.NOTIFIED) && activeSub !== this) {
    batch(this, true)
    return true
  }
}
```

它做的事不是“立刻执行 getter”，而是：

- 先把自己标记成 `DIRTY`
- 再把自己放进批处理队列

也就是说，依赖变化时 `computed` 只是进入“缓存已失效”的状态，并不马上重算。

真正重算发生在下一次读取 `computed.value` 时，由 `refreshComputed()` 触发。

这就是典型的懒求值。

## 8. `refreshComputed()` 为什么不在 `computed.ts` 里

`refreshComputed()` 实现在 [`effect.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:370)。

原因很直接：

- `computed` 和 `effect` 共用同一套订阅模型
- 脏检查、依赖准备、依赖清理都和 `ReactiveEffect` 那套逻辑密切相关

所以 Vue 把它放在 `effect.ts` 里统一处理。

`refreshComputed()` 做的核心事情是：

1. 如果当前没脏，直接返回
2. 如果全局版本没变，也直接返回
3. 把当前 computed 设为 `activeSub`
4. 执行 getter，重新收集依赖
5. 如果值确实变了，更新 `_value` 和 `dep.version`
6. 清理本轮未使用的旧依赖

所以你可以把它看成：

“computed 专用版的 effect.run()”

## 9. `computed` 和 `ref` 的关系

两者都长得像 ref，都通过 `.value` 暴露数据，但本质不同。

### `ref`

- 通常保存原始值或对象值
- 读 `.value` 时收集依赖
- 写 `.value` 时直接触发依赖

### `computed`

- 不直接存业务源数据，而是存“派生结果”
- 读 `.value` 时可能触发 getter 求值
- 写 `.value` 时如果有 setter，会转发给用户逻辑

可以把它们理解成：

- `ref` 是源数据节点
- `computed` 是派生数据节点

例如：

```ts
const count = ref(1)
const double = computed(() => count.value * 2)
```

这里：

- `count` 是源
- `double` 是基于 `count` 推导出来的派生结果

## 10. `computed` 和 `effect` 的关系

它们都属于订阅者，但目标不同。

### `effect`

目标是执行副作用：

- 渲染
- 打印日志
- 触发 watch 回调

### `computed`

目标是产出可缓存的派生值。

所以两者关系不是对立的，而是常常串在一起：

```ts
const count = ref(1)
const double = computed(() => count.value * 2)

effect(() => {
  console.log(double.value)
})
```

这段关系链是：

```text
count -> computed(double) -> effect
```

底层上：

- `double` 订阅 `count.dep`
- `effect` 订阅 `double.dep`

## 11. 可写 `computed` 是怎么工作的

源码位置：[`computed.ts:112`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/computed.ts:112)

```ts
set value(newValue) {
  if (this.setter) {
    this.setter(newValue)
  }
}
```

所以可写 computed 并不是“自己真的保存一份可写状态”，而是：

- 读取时走 getter
- 赋值时把动作转发给 setter

例如：

```ts
const count = ref(1)

const plusOne = computed({
  get: () => count.value + 1,
  set: (value) => {
    count.value = value - 1
  }
})

plusOne.value = 10
```

这里真正变化的还是 `count.value`，不是 `plusOne` 自己单独维护了一份源值。

## 12. 最后把主线串起来

如果只记最重要的运行过程，记下面这段就够了：

1. `computed(getter)` 创建 `ComputedRefImpl`
2. 第一次读 `computed.value` 时，调用 `refreshComputed()`
3. getter 执行时，`computed` 会作为 `activeSub` 去收集它依赖的数据
4. 计算结果写入 `_value`，形成缓存
5. 底层依赖变化时，`computed.notify()` 只把自己标记为 `DIRTY`
6. 下次再读 `computed.value` 时，才真正重新计算
7. 如果有别的 `effect` 读取了它，这个 `effect` 会订阅 `computed.dep`

所以：

- `ref` 提供源数据
- `computed` 基于源数据产生派生值
- `effect` 消费这些值并执行副作用
- `dep` 负责把它们串成完整的依赖传播链
