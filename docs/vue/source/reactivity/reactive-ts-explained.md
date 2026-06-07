# Vue Reactivity `reactive.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/reactive.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:1)。

前面的几篇已经把：

- `effect` 讲清楚了副作用怎么收集和重跑
- `computed` 讲清楚了派生值怎么缓存
- `watch` 讲清楚了用户层侦听 API 怎么落到底层

这篇要解决的是另一个核心问题：

- `reactive()` 到底是怎么把普通对象变成响应式对象的
- 为什么同一个对象多次 `reactive()` 得到的是同一个代理
- 为什么 `Object` / `Array` 和 `Map` / `Set` 要走不同 handler
- `reactive.ts` 和 `baseHandlers.ts`、`dep.ts` 的关系是什么

一句话先概括：

`reactive.ts` 是响应式对象代理的统一入口，它负责“要不要代理、用哪套 handler、是否复用已有代理”。

## 1. `reactive()` 在整个系统里的位置

先看主线：

```text
reactive(target)
  -> createReactiveObject(...)
  -> 判断 target 是否允许被代理
  -> 判断是否已有缓存代理
  -> 根据目标类型选择 handler
  -> new Proxy(target, handlers)
```

代理创建完以后，真正的响应式行为发生在 handler 里：

- `get` 时调用 `track()`
- `set/delete/ownKeys/has` 时调用 `trigger()` 或 `track()`

所以职责分层是：

- `reactive.ts`
  负责创建和复用代理
- `baseHandlers.ts`
  负责普通对象 / 数组的 `Proxy` 行为
- `collectionHandlers.ts`
  负责 `Map` / `Set` 这类集合对象
- `dep.ts`
  负责依赖收集和触发

## 2. `reactive()` 怎么用

源码位置：[`reactive.ts:97`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:97)

最常见的用法：

```ts
const state = reactive({
  count: 0,
  nested: {
    ok: true
  }
})
```

它返回的不是原对象，而是一个 `Proxy` 代理对象。

你后续写：

```ts
state.count++
```

表面看像普通对象读写，但底层已经变成：

- 读 `count` 时进 `get` trap
- 写 `count` 时进 `set` trap

这就是为什么 `reactive` 能在不改写业务代码写法的前提下接入依赖系统。

## 3. `reactive.ts` 最核心的函数：`createReactiveObject()`

源码位置：[`reactive.ts:160`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:160)

这是整个文件最重要的函数。

可以把它理解成“代理工厂”。

它主要做 5 件事：

1. 判断目标是不是对象
2. 判断目标是不是已经是代理
3. 判断目标是不是允许被代理
4. 看缓存里有没有已有代理
5. 根据目标类型创建正确的 `Proxy`

如果只看骨架，可以记成：

```ts
function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) return target
  if (target 已经是代理) return target
  if (target 不允许代理) return target
  if (缓存里已有代理) return 旧代理

  const targetType = targetTypeMap(toRawType(target))
  const proxy = new Proxy(
    target,
    targetType === COLLECTION ? collectionHandlers : baseHandlers
  )
  proxyMap.set(target, proxy)
  return proxy
}
```

这就是 `reactive.ts` 的本质。

## 4. 为什么不是所有值都能 `reactive()`

`createReactiveObject()` 一开始就会做判断：

- 不是对象，直接返回原值
- 被 `markRaw()` 标记过，直接返回
- 不可扩展对象，直接返回
- 不在可代理类型白名单里，直接返回

这意味着：

### 原始值不代理

```ts
reactive(1) // 直接返回 1
```

因为 `Proxy` 只能代理对象。

### 被 `markRaw()` 标记的对象不代理

```ts
const raw = markRaw({})
const wrapped = reactive(raw)
```

这里 `wrapped === raw`。

### 不可扩展对象不代理

如果一个对象已经 `Object.freeze()` 或者不可扩展，Vue 会跳过代理。

## 5. 为什么同一个对象多次 `reactive()` 返回同一个代理

关键在 4 个 `WeakMap`：

- [`reactiveMap`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:24)
- [`shallowReactiveMap`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:26)
- [`readonlyMap`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:31)
- [`shallowReadonlyMap`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:33)

它们的作用是缓存：

```text
原始对象 -> 对应模式下的代理对象
```

例如：

```ts
const obj = {}
const p1 = reactive(obj)
const p2 = reactive(obj)

console.log(p1 === p2) // true
```

这样做有两个价值：

1. 避免重复创建代理，节省开销
2. 保证对象身份稳定，避免依赖图混乱

如果没有这个缓存，同一个原对象每次都返回新代理，会让比较、依赖、Map key 等行为都变得不可靠。

## 6. `TargetType` 为什么要把对象分成两类

源码位置：[`reactive.ts:38`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:38)

这里把可代理对象分成：

- `COMMON`
  `Object`、`Array`
- `COLLECTION`
  `Map`、`Set`、`WeakMap`、`WeakSet`

原因是这两类对象的访问入口完全不同。

### 普通对象 / 数组

主要靠：

- `obj.foo`
- `obj.foo = x`
- `delete obj.foo`
- `key in obj`
- `Object.keys(obj)`

所以它们适合用 `baseHandlers.ts` 里的 `get/set/deleteProperty/has/ownKeys` 来处理。

### 集合对象

主要靠方法：

- `map.get(key)`
- `map.set(key, value)`
- `set.add(value)`
- `map.delete(key)`

它们不是简单属性读写，所以必须走专门的 `collectionHandlers.ts`。

这就是为什么不能拿一套 `get/set` handler 硬套所有对象。

## 7. `reactive()`、`readonly()`、`shallowReactive()`、`shallowReadonly()` 的区别

这四个 API 都走 `createReactiveObject()`，差别只在两个维度：

- 是否只读
- 是否浅层

### `reactive()`

- 可写
- 深层

### `readonly()`

- 只读
- 深层

### `shallowReactive()`

- 可写
- 只处理根层

### `shallowReadonly()`

- 只读
- 只处理根层

所以从设计上看，它们不是四套系统，而是同一工厂的四种配置。

## 8. `baseHandlers.ts` 在这里怎么接上

`reactive.ts` 自己不做依赖收集，它只是把合适的 handler 塞给 `Proxy`。

真正接入 `track()` / `trigger()` 的地方在 [`baseHandlers.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/baseHandlers.ts:1)。

最关键的路径是：

### 读取属性

```ts
get(target, key, receiver) {
  const res = Reflect.get(target, key, receiver)
  track(target, TrackOpTypes.GET, key)
  return res
}
```

也就是说：

- 一旦你读 `state.foo`
- handler 就会调用 `track(target, GET, 'foo')`
- 当前活跃 effect 就会被收集到这个属性对应的 `dep`

### 写入属性

```ts
set(target, key, value, receiver) {
  const hadKey = ...
  const result = Reflect.set(...)
  if (!hadKey) {
    trigger(target, ADD, key, value)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, SET, key, value, oldValue)
  }
}
```

也就是说：

- 新增属性，触发 `ADD`
- 修改已有属性且值确实变化，触发 `SET`

### 删除属性

```ts
deleteProperty(target, key) {
  trigger(target, DELETE, key, undefined, oldValue)
}
```

### 枚举和 `in`

- `has()` 处理 `key in obj`
- `ownKeys()` 处理 `for...in`、`Object.keys()`、数组长度等遍历依赖

这也是为什么 Vue 不只是追踪“读属性”，还会追踪“有没有这个属性”和“键集合有没有变”。

## 9. `ReactiveFlags` 是干什么的

源码里很多地方都在读这些内部标记：

- `IS_REACTIVE`
- `IS_READONLY`
- `IS_SHALLOW`
- `RAW`
- `SKIP`

它们的作用是让代理对象能回答这些问题：

- 我是不是 reactive？
- 我是不是 readonly？
- 我是不是 shallow？
- 我的原对象是谁？
- 我是不是应该跳过代理？

比如：

- `isReactive()` 读 `IS_REACTIVE`
- `isReadonly()` 读 `IS_READONLY`
- `toRaw()` 沿着 `RAW` 一路剥回原对象
- `markRaw()` 给对象打 `SKIP`

所以这些标记本质上是整套代理系统的“内部元数据协议”。

## 10. `toRaw()`、`toReactive()`、`toReadonly()` 的作用

这几个辅助函数都在 [`reactive.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:217) 附近。

### `toRaw()`

把代理对象还原成原始对象。

```ts
const raw = {}
const proxy = reactive(raw)

console.log(toRaw(proxy) === raw) // true
```

它是一个逃生口，适合内部逻辑或少量特殊场景，不适合长期拿原对象到处写。

### `toReactive()`

如果值是对象，就转成 reactive；否则原样返回。

这个函数在 `ref.ts` 里很常见，因为深 `ref` 的对象值会自动转成 reactive。

### `toReadonly()`

如果值是对象，就转成 readonly；否则原样返回。

## 11. `isReactive()`、`isReadonly()`、`isProxy()` 的区别

### `isReactive(value)`

判断这个值底层是不是响应式对象。

### `isReadonly(value)`

判断这个值是不是只读代理或只读 computed。

### `isProxy(value)`

判断这个值是不是 Vue 创建出来的代理对象。

可以粗略记成：

- `isReactive`
  看“是不是响应式”
- `isReadonly`
  看“是不是只读”
- `isProxy`
  看“是不是被 Vue 代理过”

## 12. `reactive` 和 `ref` 的关系

这两个 API 解决的问题不同：

### `reactive`

适合对象结构。

它通过 `Proxy` 拦截：

- 属性读取
- 属性写入
- 删除
- 枚举

### `ref`

适合单值或对象值容器。

它通过 `.value` 的 getter / setter 接入依赖系统。

如果 `ref` 里装的是对象，深 `ref` 最后仍然会调用 `toReactive()`，把对象值变成 reactive。

所以关系是：

- `reactive` 直接代理对象
- `ref` 是值容器，必要时内部再把对象值交给 `reactive`

## 13. 最后把主线串起来

如果只记最重要主线，记下面这段就够了：

1. `reactive(target)` 调用 `createReactiveObject()`
2. 工厂先判断目标值能不能代理
3. 再判断缓存里是否已有代理
4. 根据目标类型选择 `baseHandlers` 或 `collectionHandlers`
5. 创建 `Proxy`
6. 后续用户读写代理对象时，真正进入 handler
7. handler 在 `get` 里做 `track()`，在 `set/delete/...` 里做 `trigger()`

所以：

- `reactive.ts` 负责“创建代理”
- `baseHandlers.ts` 负责“代理怎么响应读写”
- `dep.ts` 负责“依赖怎么收集和触发”

它们三层配合，才让普通对象变成 Vue 的响应式对象。

## 14. 为什么 Vue 2 能靠 `defineProperty`，Vue 3 却转向 `Proxy`

这个问题最容易和“我是不是可以不用 `reactive()`”混在一起，但它们不是一回事。

先说结论：

- Vue 2 的响应式核心主要建立在 `Object.defineProperty()` 上
- Vue 3 的响应式核心主要建立在 `Proxy` 上
- 所以在不支持 `Proxy` 的浏览器里，不能因为“我业务代码里不用 `reactive()`”就认为 Vue 3 还能完整兼容

### Vue 2 的 `defineProperty` 方案为什么能工作

Vue 2 的基本思路是：

- 在对象已有属性上定义 getter / setter
- 读属性时收集依赖
- 写属性时触发依赖

这个方案对“普通对象已有字段”的场景是成立的，例如：

```ts
Object.defineProperty(obj, 'count', {
  get() {
    track()
    return value
  },
  set(v) {
    value = v
    trigger()
  }
})
```

它的优点是：

- 不依赖 `Proxy`
- 老浏览器也能工作

但它有天然边界：

- 很难无侵入地监听属性新增/删除
- 数组索引和 `length` 处理麻烦
- `Map`、`Set` 这类集合对象几乎没法用同一套方式优雅支持
- 必须预先劫持已有属性，初始化成本也更高

### Vue 3 为什么转向 `Proxy`

Vue 3 想要的是“统一拦截整个对象层面的操作”，而不只是给单个已有属性打补丁。

`Proxy` 能直接拦截：

- `get`
- `set`
- `deleteProperty`
- `has`
- `ownKeys`

这意味着 Vue 3 能更自然地支持：

- 新增属性
- 删除属性
- `in` 判断
- `for...in` / `Object.keys`
- 数组索引和长度变化
- `Map` / `Set` 这类集合对象的专门处理

所以 Vue 3 换来的是：

- 更完整的对象级拦截能力
- 更统一的响应式模型
- 对现代 JavaScript 数据结构更好的支持

代价就是：

- 浏览器环境必须支持 `Proxy`

## 15. 为什么“不用 `reactive()`”也不能绕开 `Proxy`

这件事要分两层看。

### 第一层：`ref` 自己不等于整个 Vue 运行时

确实，`ref` 的核心是 `.value` 的 getter / setter，它本身不像 `reactive()` 那样直接 `new Proxy(...)`。

但这不代表：

- 你只用 `ref`
- 整个 Vue 3 应用就不需要 `Proxy`

因为 Vue 3 运行时里还有很多能力默认建立在 `Proxy` 思路上：

- `reactive`
- `readonly`
- `shallowReactive`
- `shallowReadonly`
- 组件实例代理
- `setup` 上下文里的很多对象访问

也就是说，兼容性不是看你“某一行代码有没有调 `reactive()`”，而是看整套运行时是否依赖 `Proxy`。

### 第二层：深 `ref` 的对象值也可能继续走 `reactive`

例如：

```ts
const state = ref({ count: 1 })
```

虽然表面上你写的是 `ref()`，但在当前这份源码里，深 `ref` 会通过 `toReactive()` 把对象值继续转成 reactive。

也就是说：

```text
ref({ ... })
  -> RefImpl
  -> toReactive(value)
  -> reactive(value)
  -> Proxy
```

所以“我不用 `reactive()`，我只用 `ref({})`”这个前提本身也不成立，因为对象值最后还是会进入 `reactive()` 这条链。

## 16. 更准确的兼容性结论

如果只看某个孤立值：

```ts
const count = ref(1)
```

这种“基本类型 ref”本身未必一定要依赖 `Proxy`。

但 Vue 3 的兼容性不能这么判断。真正要看的是：

- 整个响应式系统
- 整个组件运行时
- 整个框架对现代能力的依赖

所以结论应该写成：

- 不是“只要不用 `reactive()` 就兼容旧浏览器”
- 而是“Vue 3 的现代响应式和运行时整体建立在 `Proxy` 能力之上”

如果目标环境不支持 `Proxy`，真正稳妥的选择通常不是“少用几个 API”，而是：

- 使用 Vue 2
- 或者放弃依赖 Vue 3 这套现代响应式模型
