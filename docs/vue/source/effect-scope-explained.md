# Vue Reactivity `effectScope.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/effectScope.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:1)。

如果前面的几篇解决的是：

- `effect.ts` 负责单个副作用怎么执行
- `watch.ts` 负责用户层侦听 API
- `reactive.ts` 负责对象怎么接入响应式

那这个文件解决的是：

- 一批 `effect` / `watch` / `computed` 怎么归到同一个生命周期容器里
- 为什么 Vue 能一次性停止一组副作用
- 为什么组件卸载后，这批副作用可以整体清理

一句话先概括：

`effectScope.ts` 负责的是“副作用的归档和生命周期管理”，不是依赖收集本身。

## 1. 它在整个响应式系统里的位置

先看主线：

```text
effectScope()
  -> 创建一个 EffectScope
  -> scope.run(fn)
  -> activeEffectScope = 当前 scope
  -> fn 内新建的 effect/watch 自动登记到这个 scope
  -> 后续可以 scope.pause() / scope.resume() / scope.stop()
```

所以它管理的不是：

- 某个属性依赖了谁

而是：

- 哪些副作用属于同一批
- 这批副作用何时整体暂停、恢复、销毁

## 2. `activeEffectScope` 是全局作用域上下文

源码位置：[`effectScope.ts:3`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:3)

```ts
export let activeEffectScope: EffectScope | undefined
```

它和 [`effect.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:38) 里的 `activeSub` 很像，都是全局活跃上下文。

但两者职责不同：

- `activeSub`
  表示当前活跃订阅者，用于依赖收集
- `activeEffectScope`
  表示当前活跃作用域，用于把新建 effect 归档到哪个 scope

所以可以粗暴记成：

- `activeSub` 管“谁在读”
- `activeEffectScope` 管“谁在收人”

## 3. `EffectScope` 这个类本质上是什么

源码位置：[`effectScope.ts:4`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:4)

它本质上是一个“副作用容器节点”。

最重要的字段有：

- `effects`
  当前 scope 里收集到的 `ReactiveEffect`
- `cleanups`
  当前 scope stop 时要执行的 cleanup
- `parent`
  父 scope
- `scopes`
  子 scope 列表
- `detached`
  是否脱离父 scope 独立存在

所以它不是简单数组，而更像一棵树上的节点：

```text
EffectScope
  ├─ effects[]
  ├─ cleanups[]
  └─ child scopes[]
```

## 4. 它和 `effect.ts` 是怎么接上的

这一点最关键。

在 [`effect.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effect.ts:116) 的 `ReactiveEffect` 构造函数里有这段逻辑：

```ts
if (activeEffectScope) {
  if (activeEffectScope.active) {
    activeEffectScope.effects.push(this)
  } else {
    this.flags &= ~EffectFlags.ACTIVE
  }
}
```

这意味着：

- 只要当前存在 `activeEffectScope`
- 新创建出来的 `ReactiveEffect`
- 就会自动挂进 `activeEffectScope.effects`

所以关系是：

- `effectScope.ts` 提供“当前应该挂到哪个 scope”
- `effect.ts` 在创建 effect 时主动登记进去

这就是为什么：

```ts
scope.run(() => {
  effect(...)
  watch(...)
})
```

后续能统一 `scope.stop()`。

## 5. `run()` 是最核心的入口

源码位置：[`effectScope.ts:80`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:80)

```ts
run<T>(fn: () => T): T | undefined {
  if (this._active) {
    const currentEffectScope = activeEffectScope
    try {
      activeEffectScope = this
      return fn()
    } finally {
      activeEffectScope = currentEffectScope
    }
  }
}
```

它的作用非常明确：

1. 保存旧的 `activeEffectScope`
2. 把当前 scope 设成活跃 scope
3. 执行用户函数
4. 恢复旧 scope

所以 `run()` 的本质是：

**临时建立一个“当前副作用归属上下文”。**

这和 `effect.run()` 建立“依赖收集上下文”是平行的两套机制。

## 6. `pause()` / `resume()` 是批量控制副作用

源码位置：

- [`effectScope.ts:48`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:48)
- [`effectScope.ts:65`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:65)

这两个方法都会递归处理：

- 子 scope
- 当前 scope 下的 effect

例如 `pause()` 的思路就是：

```ts
for (childScope of this.scopes) childScope.pause()
for (effect of this.effects) effect.pause()
```

所以它不是只控制当前节点，而是控制整棵子树。

这意味着：

- 父 scope 暂停
- 子 scope 也跟着暂停
- 里面所有 effect 也一起暂停

## 7. `stop()` 是这个文件里最重要的方法

源码位置：[`effectScope.ts:123`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:123)

它做的事情可以拆成 4 步：

1. 把当前 scope 标记成失活
2. 逐个 stop 当前 scope 下的 effect
3. 执行当前 scope 下注册的 cleanup
4. 递归 stop 所有子 scope

主干逻辑就是：

```ts
for (...) this.effects[i].stop()
for (...) this.cleanups[i]()
for (...) this.scopes[i].stop(true)
```

所以：

- `effect.stop()` 是停一个副作用
- `scope.stop()` 是停一整批副作用

这就是它最大的价值。

## 8. 为什么有 `parent` / `scopes` / `index`

这些字段是为了维护 scope 树结构。

### `parent`

指向父 scope。

### `scopes`

保存子 scope 列表。

### `index`

记录当前 scope 在父 `scopes` 数组里的位置。

它的作用主要体现在 [`stop()`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:145) 里这段 O(1) 删除：

```ts
const last = this.parent.scopes!.pop()
if (last && last !== this) {
  this.parent.scopes![this.index!] = last
  last.index = this.index!
}
```

意思是：

- 当前子 scope 被 stop 后
- 要从父 scope 的子列表里移除
- 用尾元素交换，避免线性删除

这是一个典型的性能优化。

## 9. `detached` 是什么

构造函数在 [`effectScope.ts:31`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:31)

```ts
constructor(public detached = false) {
  if (!detached && activeEffectScope) {
    ...
  }
}
```

意思是：

- 默认情况下，新建 scope 会挂到当前活跃父 scope 下面
- 如果 `detached = true`
  就不会挂到父链，成为独立 scope

例如：

```ts
const scope = effectScope(true)
```

这表示“我要手动完全控制这个 scope，不让它自动受父 scope 生命周期影响”。

## 10. `on()` / `off()` 是内部上下文切换工具

源码位置：

- [`effectScope.ts:97`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:97)
- [`effectScope.ts:108`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:108)

它们和 `run()` 一样都在切换 `activeEffectScope`，但粒度更底层。

### `on()`

- 增加 `_on` 计数
- 把自己挂到当前活跃链顶

### `off()`

- 减少 `_on`
- 当计数归零时恢复上一个 scope

这里还处理了一个异步交错场景：

- 当前 scope 可能已经不在活跃链顶
- 这时不能简单还原
- 需要从链中间摘掉

所以 `on/off` 更像是“内部版 push/pop 上下文管理”。

## 11. `onScopeDispose()` 和 watcher cleanup 有什么区别

源码位置：[`effectScope.ts:191`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/effectScope.ts:191)

```ts
export function onScopeDispose(fn: () => void): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  }
}
```

它的语义是：

**当当前 scope 被 stop 时，执行这个 cleanup。**

它和 [`watch.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/watch.ts:78) 里的 watcher cleanup 不同：

- watcher cleanup
  在 watcher 下一次重新执行前，或 watcher stop 时触发
- scope cleanup
  在整个 effect scope stop 时触发

所以层级不一样：

- watcher cleanup 是 effect 级
- scope cleanup 是 scope 级

## 12. 它和其他代码的关系

可以把关系压成下面这张图：

```text
effectScope.ts
  -> 提供 activeEffectScope
  -> 管理 EffectScope 树

effect.ts
  -> ReactiveEffect 创建时登记到 activeEffectScope.effects

watch.ts
  -> watch 内部本质也是 ReactiveEffect，因此也会被 scope 收集

computed.ts
  -> computed 属于订阅体系的一部分，但 scope 主要归档 effect 实体

onScopeDispose()
  -> 给当前 scope 注册 stop 时 cleanup
```

最关键的一句关系是：

**`effectScope` 不负责依赖收集，它负责副作用的生命周期归档。**

## 13. 最后把主线串起来

如果只记最重要主线，记下面这段就够了：

1. `effectScope()` 创建一个作用域容器
2. `scope.run(fn)` 执行时，把自己设为 `activeEffectScope`
3. `fn` 里新创建的 `effect/watch` 会自动登记到当前 scope
4. `scope.pause()` / `resume()` 可以批量控制这组副作用
5. `scope.stop()` 会统一停止这组副作用，并递归清理子 scope 和 cleanup

所以：

- `effect.ts` 解决“单个副作用怎么运行”
- `effectScope.ts` 解决“一批副作用怎么统一托管”
