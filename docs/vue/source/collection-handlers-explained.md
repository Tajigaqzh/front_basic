# Vue Reactivity `collectionHandlers.ts` 详解

这篇文档聚焦 [`vue-source/packages/reactivity/src/collectionHandlers.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:1)。

如果 [`baseHandlers.ts`](./reactive-ts-explained.md) 解决的是：

- 普通对象怎么响应式
- 数组怎么响应式

那这个文件解决的是：

- `Map` / `Set` / `WeakMap` / `WeakSet` 为什么不能复用普通对象 handler
- 集合类型怎样接入 `track()` / `trigger()`
- 集合的 `get / set / add / delete / clear / size / forEach / iterator` 为什么都要单独包装

一句话先概括：

`collectionHandlers.ts` 不是靠拦截“属性赋值”来做响应式，而是靠包装集合方法，把方法调用翻译成依赖收集和触发。

## 1. 它在响应式系统里的位置

这条链和普通对象类似，但入口不同：

```text
reactive(new Map())
  -> reactive.ts 判断目标类型是 COLLECTION
  -> new Proxy(target, collectionHandlers)
  -> 用户调用 map.get / map.set / set.add / set.delete
  -> collectionHandlers 里的增强方法
  -> track() / trigger()
  -> effect / computed / watch 更新
```

所以职责关系是：

- `reactive.ts`
  决定集合对象要走 `collectionHandlers`
- `collectionHandlers.ts`
  负责把集合方法变成可追踪版本
- `dep.ts`
  负责真正存储依赖和通知订阅者

## 2. 为什么 `Map/Set` 不能复用 `baseHandlers`

普通对象的核心操作是：

- `obj.foo`
- `obj.foo = x`
- `delete obj.foo`
- `key in obj`

所以普通对象可以靠 `Proxy` 的：

- `get`
- `set`
- `deleteProperty`
- `has`
- `ownKeys`

来解决。

但集合对象的核心操作是：

- `map.get(key)`
- `map.set(key, value)`
- `set.add(value)`
- `map.delete(key)`
- `map.clear()`
- `map.size`
- `map.forEach(...)`
- `for (const item of map)`

也就是说，集合的大部分语义不是“属性赋值”，而是“方法调用 + 迭代行为”。

所以 Vue 不能只靠：

```ts
proxy.foo = 1
```

这种模型做响应式，必须专门包装集合方法。

## 3. 这个文件最核心的设计：`instrumentations`

源码位置：[`collectionHandlers.ts:88`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:88)

这个文件的核心不是一个个独立 trap，而是先生成一套“增强版集合方法”：

```ts
createInstrumentations(readonly, shallow)
```

这套方法会按当前模式生成：

- 可变 / 只读
- 深层 / 浅层

然后 `Proxy.get` 再决定：

- 如果当前 key 有增强实现，就返回增强方法
- 否则回退到原始集合对象上的属性/方法

所以这个文件的核心思路是：

**不直接改原集合原型，而是在代理层按需返回包装过的方法。**

## 4. `createInstrumentationGetter()` 是总入口

源码位置：[`collectionHandlers.ts:269`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:269)

这个函数生成最终给 `Proxy` 用的 `get` trap。

它做两件事：

### 4.1 处理内部标记

和 `baseHandlers.ts` 类似，这里也支持：

- `IS_REACTIVE`
- `IS_READONLY`
- `RAW`

这样 `isReactive()`、`isReadonly()`、`toRaw()` 在集合对象上也能正常工作。

### 4.2 返回增强版方法或原始属性

```ts
return Reflect.get(
  hasOwn(instrumentations, key) && key in target
    ? instrumentations
    : target,
  key,
  receiver,
)
```

意思是：

- 如果 `key` 对应的方法我们重写过，就从 `instrumentations` 里取
- 否则就退回原始集合对象

这是整个文件最关键的桥接点。

## 5. `get()` 和 `has()` 怎么做依赖收集

### `get(key)`

源码位置：[`collectionHandlers.ts:96`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:96)

当你写：

```ts
map.get(key)
```

内部会做：

- 先把 `this` 拿回原始集合
- 处理 `key` 和 `rawKey`
- 调用 `track(rawTarget, GET, key/rawKey)`
- 再返回包装后的值

这里有一个关键点：

集合里的 key 可能有“代理 key”和“原始 key”两种身份，所以它会同时考虑：

- 传入的 key
- `toRaw(key)` 后的 rawKey

这样可以尽量避免因为 key 身份不同导致查不到值或漏收集依赖。

### `has(key)`

源码位置：[`collectionHandlers.ts:118`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:118)

逻辑和 `get` 类似，只是收集的是：

```ts
track(rawTarget, TrackOpTypes.HAS, key)
```

这和普通对象里 `key in obj` 的 `HAS` 依赖是同一类语义。

## 6. `size` 为什么要走 `ITERATE`

源码位置：[`collectionHandlers.ts:113`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:113)

```ts
get size() {
  !readonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
  return target.size
}
```

这里不是追踪某个具体 key，而是追踪“集合整体的内容规模”。

因为：

- `size` 依赖的是“集合里一共有多少项”
- 新增、删除、清空都会影响它

所以这里要收集的是遍历级依赖，而不是单个 key 的 `GET`。

## 7. `forEach` 和迭代器为什么也要追踪

### `forEach`

源码位置：[`collectionHandlers.ts:131`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:131)

当你写：

```ts
map.forEach((value, key) => { ... })
```

Vue 会：

- 先收集 `ITERATE` 依赖
- 再把传给回调的 `value` / `key` 包装成当前模式下的值
- 第三个参数传回当前代理对象 `observed`

这意味着 `forEach` 不只是遍历，它本身也是依赖来源。

### 迭代器

源码位置：[`collectionHandlers.ts:30`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:30)

`createIterableMethod()` 负责包装：

- `keys`
- `values`
- `entries`
- `Symbol.iterator`

它做的事是：

1. 开始迭代时先 `track(..., ITERATE, ...)`
2. 调用原始迭代器
3. 把迭代结果包装成当前模式对应的值

例如 `Map.entries()` 时，返回的 `[key, value]` 两边都可能要做：

- `toReactive`
- `toReadonly`
- 或浅层原样返回

所以集合迭代并不是“直接把原始迭代器吐出去”，而是要包一层响应式语义。

## 8. 写操作怎么触发依赖

可变集合的写操作都在 [`createInstrumentations()`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:149) 后半段。

### `add(value)` for `Set`

逻辑是：

1. 转成原始集合
2. 判断原来有没有这个值
3. 没有才真正 `target.add(...)`
4. 然后 `trigger(target, ADD, valueToAdd, valueToAdd)`

所以：

- 重复 `add` 不会重复触发
- 只有集合内容真的变了才触发更新

### `set(key, value)` for `Map`

逻辑是：

1. 必要时把 value `toRaw`
2. 判断 key 原来是否存在
3. 取出 `oldValue`
4. 真正 `target.set(key, value)`
5. 如果原来没有这个 key，触发 `ADD`
6. 如果原来有且值变了，触发 `SET`

这和普通对象的 `set` trap 语义是一致的，只是入口换成了 `Map.set()`。

### `delete(key)`

逻辑是：

1. 判断原来有没有这个 key
2. 取 `oldValue`
3. 调用真实删除
4. 如果之前确实存在，触发 `DELETE`

### `clear()`

逻辑是：

1. 看集合之前是否非空
2. 调用真实 `clear()`
3. 如果之前有内容，触发 `CLEAR`

所以集合更新也是同一条原则：

- 先真实修改原始集合
- 再按操作类型 `trigger()`

## 9. 为什么只读集合也要有 `add/set/delete/clear`

源码位置：[`collectionHandlers.ts:75`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/collectionHandlers.ts:75)

只读集合并不是“这些方法不存在”，而是这些方法会被替换成只读版本：

```ts
createReadonlyMethod(type)
```

返回结果会尽量保持与原生接口形状一致：

- `delete` 返回 `false`
- `clear` 返回 `undefined`
- `add/set` 返回 `this`

也就是说：

- API 形状还在
- 但不会真的改底层数据

这和只读对象 handler 的设计思路是统一的。

## 10. 深层 / 浅层 / 只读 是怎么体现的

这个文件里有三个转换函数：

- `toReactive`
- `toReadonly`
- `toShallow`

然后统一通过：

```ts
const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive
```

来决定读取结果怎么包装。

这意味着：

- 深可变集合：读出来的嵌套对象继续转 reactive
- 深只读集合：读出来的嵌套对象继续转 readonly
- 浅集合：原样返回，不递归包装

所以这个文件和 `baseHandlers.ts` 一样，也是在做：

- 依赖收集
- 延迟包装
- 模式分发

## 11. 它和其他文件的关系

### 和 `reactive.ts`

[`reactive.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/reactive.ts:160) 负责识别：

- `Map`
- `Set`
- `WeakMap`
- `WeakSet`

这些类型都属于 `TargetType.COLLECTION`，所以会交给这里的：

- `mutableCollectionHandlers`
- `readonlyCollectionHandlers`
- `shallowCollectionHandlers`
- `shallowReadonlyCollectionHandlers`

### 和 `dep.ts`

这个文件和 [`dep.ts`](/Users/nwyzx/Desktop/project/source/front_basic/vue-source/packages/reactivity/src/dep.ts:1) 的关系最直接。

它调用的核心入口有：

- `track`
- `trigger`
- `ITERATE_KEY`
- `MAP_KEY_ITERATE_KEY`

所以集合本身不存依赖，只是把方法语义翻译给 `dep.ts`。

### 和 `baseHandlers.ts`

两者是兄弟文件：

- `baseHandlers.ts`
  处理对象 / 数组
- `collectionHandlers.ts`
  处理集合对象

它们共享同一套：

- `track` / `trigger`
- `ReactiveFlags`
- 深/浅/只读模式分发

但操作入口完全不同：

- 一个围绕属性读写
- 一个围绕方法调用和迭代

## 12. 为什么这也能说明 Vue 3 离不开 `Proxy`

集合响应式是一个很好的例子。

如果只靠 Vue 2 那种 `Object.defineProperty` 思路，你很难优雅覆盖这些操作：

- `map.get(key)`
- `map.set(key, value)`
- `set.add(value)`
- `map.size`
- `for (const [k, v] of map)`

因为这些不是“给已有属性加 getter/setter”就能完整解决的。

而 Vue 3 可以通过：

- `Proxy` 先拦截到集合对象访问
- 再把方法替换成增强版实现

从而让集合类型也进入统一响应式模型。

所以 `collectionHandlers.ts` 正好说明了：

**Vue 3 不是为了换新而换 `Proxy`，而是为了支持现代对象模型和集合语义，必须走这条路。**

## 13. 最后把主线串起来

如果只记最重要主线，记下面这段就够了：

1. `reactive(new Map())` 时，`reactive.ts` 会选择 `collectionHandlers`
2. 代理对象读取 `get/set/add/delete/...` 时，会返回增强版方法
3. 增强版方法内部负责：
   - 调用 `track()`
   - 或在写操作后调用 `trigger()`
   - 同时把键和值包装成当前模式对应的 reactive/readonly/shallow 结果
4. `dep.ts` 再把这些操作翻译成 effect/computed/watch 的更新

所以：

- `baseHandlers.ts` 让普通对象响应式
- `collectionHandlers.ts` 让集合对象响应式
- 两者一起才构成 Vue 3 完整的对象级响应式系统
