# 27 内存管理 / 垃圾回收

JavaScript 有自动垃圾回收机制，开发者通常不需要手动释放内存。但“不需要手动释放”不等于“不需要关心内存”。只要对象仍然可达，垃圾回收器就不会回收它，长期运行的页面、复杂单页应用、可视化、大列表、WebSocket、定时器和缓存都可能出现内存问题。

## 核心结论

- JavaScript 会自动分配和回收内存
- 原始值通常直接保存值，对象保存引用
- 当前仍然可访问到的对象不会被回收
- 垃圾回收主要依据“可达性”判断对象是否还需要保留
- 闭包、定时器、事件监听、缓存、全局变量都可能延长对象生命周期
- `WeakMap`、`WeakSet`、`WeakRef` 可以减少某些场景下的强引用问题
- 内存泄漏的本质通常是“不再需要的对象仍然被引用”

## 内存生命周期

一段 JavaScript 代码里的数据通常经历三个阶段：

```text
分配内存
   |
   v
使用内存
   |
   v
不再需要，等待垃圾回收
```

示例：

```js
function createUser() {
  const user = {
    name: 'Tom',
    hobbies: ['read', 'run']
  }

  return user
}

const user = createUser()
```

执行过程中：

1. 创建对象 `{ name, hobbies }`，运行时为它分配堆内存。
2. `user` 变量保存这个对象的引用。
3. 只要还能通过 `user` 访问到对象，它就不会被回收。
4. 如果没有任何路径能访问到这个对象，它就会成为可回收对象。

## 栈内存和堆内存

可以简化理解为：

- 栈内存：保存函数调用、局部变量、执行上下文等，生命周期较短
- 堆内存：保存对象、数组、函数等引用类型数据，生命周期由引用关系决定

```js
let age = 18
let user = {
  name: 'Tom'
}
```

简化模型：

```text
栈内存
age  -> 18
user -> 对象引用地址

堆内存
{ name: 'Tom' }
```

原始值和对象的赋值差异：

```js
let a = 1
let b = a

b = 2

console.log(a) // 1
```

```js
const user1 = { name: 'Tom' }
const user2 = user1

user2.name = 'Jerry'

console.log(user1.name) // Jerry
```

对象赋值复制的是引用，不是对象本身。

## 可达性

现代垃圾回收的核心思路是：从一组根对象出发，能访问到的对象就是可达对象；无法访问到的对象就可以被回收。

常见根对象包括：

- 全局对象，例如浏览器中的 `window`
- 当前调用栈中的局部变量和参数
- 闭包中仍被引用的变量
- DOM 树中仍存在的节点
- 当前仍然活跃的定时器、事件监听、Promise 回调等

示例：

```js
let user = {
  name: 'Tom'
}

user = null
```

当 `user = null` 后，如果没有其他引用指向这个对象，原来的 `{ name: 'Tom' }` 就变成不可达对象，后续可以被垃圾回收。

多个引用时：

```js
let user = { name: 'Tom' }
let admin = user

user = null

console.log(admin.name) // Tom
```

虽然 `user` 不再引用对象，但 `admin` 仍然可以访问它，所以对象不会被回收。

## 垃圾回收策略

不同 JavaScript 引擎实现细节不同，但常见思路包括引用计数、标记清除、分代回收、增量回收和并发回收。

### 引用计数

引用计数会记录一个对象被引用的次数。引用数变成 0 时，对象可以被回收。

```js
let a = {}
let b = a

a = null
b = null
```

优点是思路简单，缺点是处理循环引用有问题。

```js
function createCycle() {
  const a = {}
  const b = {}

  a.b = b
  b.a = a
}

createCycle()
```

`a` 和 `b` 互相引用，但函数执行完后外部已经无法访问它们。如果只看引用计数，它们的引用数都不是 0，可能无法回收。

现代 JavaScript 引擎主要不会只依赖简单引用计数。

### 标记清除

标记清除是现代垃圾回收的基础思路。

```text
从根对象出发
      |
      v
标记所有可达对象
      |
      v
没有被标记的对象就是不可达对象
      |
      v
清除不可达对象
```

它可以处理循环引用。只要一组对象整体无法从根对象访问到，即使内部互相引用，也可以被回收。

### 分代回收

很多 JavaScript 引擎会把对象分为新生代和老生代。

- 新生代：刚创建不久的对象，生命周期通常较短
- 老生代：存活多次 GC 后仍然存在的对象，生命周期通常较长

这样做的原因是：大部分对象都是“朝生夕死”的临时对象。频繁检查新生代可以更快回收短命对象，减少整体成本。

```js
function renderList(list) {
  return list.map((item) => ({
    id: item.id,
    text: item.name
  }))
}
```

上面 `map` 中创建的大量临时对象，如果渲染结束后不再被引用，通常会很快被回收。

### 增量回收和并发回收

垃圾回收会占用运行时间。如果一次性扫描和清理大量对象，页面可能卡顿。现代引擎会把 GC 工作拆成多段，或者在后台线程做一部分工作，以降低主线程停顿。

开发者不需要控制具体 GC 过程，但要理解：创建大量对象、长期保留大对象、频繁分配和释放内存，都可能增加 GC 压力。

## 闭包与内存

闭包会让函数记住创建时的词法环境。只要闭包函数还存在，它引用的变量就不会被回收。

```js
function createCounter() {
  let count = 0

  return function increment() {
    count += 1
    return count
  }
}

const counter = createCounter()

counter() // 1
counter() // 2
```

这里 `createCounter` 已经执行完，但 `count` 仍然被返回的 `increment` 引用，所以不会被回收。

闭包本身不是内存泄漏。只有当闭包长期持有已经不需要的大对象时，才可能造成问题。

```js
function bindLargeData() {
  const largeList = new Array(100000).fill({ name: 'Tom' })

  return function handleClick() {
    console.log(largeList.length)
  }
}

const handler = bindLargeData()
```

只要 `handler` 还存在，`largeList` 就不会被回收。

## 强引用和弱引用

普通变量、对象属性、数组元素、`Map` 的键和值都是强引用。只要强引用还存在，对象就不会被回收。

```js
const map = new Map()
let user = { id: 1 }

map.set(user, 'data')
user = null
```

虽然 `user` 变量已经置空，但 `Map` 仍然强引用着原对象，所以对象不会被回收。

### WeakMap

`WeakMap` 的键必须是对象，并且不会阻止键对象被垃圾回收。

```js
const cache = new WeakMap()
let element = document.querySelector('#app')

cache.set(element, {
  mountedAt: Date.now()
})

element = null
```

如果 DOM 节点从页面移除，并且没有其他强引用，`WeakMap` 不会阻止它被回收。

适合场景：

- 给对象保存私有数据
- 给 DOM 节点保存元信息
- 缓存和对象生命周期绑定的数据

### WeakSet

`WeakSet` 只能保存对象，常用于标记对象是否处理过。

```js
const visited = new WeakSet()

function walk(node) {
  if (visited.has(node)) return

  visited.add(node)

  for (const child of node.children ?? []) {
    walk(child)
  }
}
```

### WeakRef 和 FinalizationRegistry

`WeakRef` 可以创建一个不会阻止对象回收的弱引用。

```js
let user = { name: 'Tom' }
const ref = new WeakRef(user)

user = null

const value = ref.deref()

if (value) {
  console.log(value.name)
}
```

`ref.deref()` 可能返回对象，也可能返回 `undefined`，因为对象可能已经被回收。

`FinalizationRegistry` 可以在对象被回收后执行清理回调。

```js
const registry = new FinalizationRegistry((id) => {
  console.log('object collected', id)
})

let user = { id: 1 }

registry.register(user, user.id)

user = null
```

注意：不要依赖 `FinalizationRegistry` 做关键业务逻辑。垃圾回收什么时候发生是不确定的，回调执行时机也不稳定。

## 常见内存泄漏场景

内存泄漏的本质是：对象已经不再需要，但仍然被某个引用链持有。

### 全局变量

```js
function createData() {
  data = new Array(100000).fill('item')
}

createData()
```

没有使用 `let`、`const` 或 `var` 声明变量时，非严格模式下可能变成全局变量，导致长期无法回收。

建议：

```js
'use strict'

function createData() {
  const data = new Array(100000).fill('item')
  return data
}
```

### 定时器未清理

```js
function start() {
  const data = new Array(100000).fill('item')

  setInterval(() => {
    console.log(data.length)
  }, 1000)
}
```

只要定时器不清除，回调引用的 `data` 就不会被回收。

修复：

```js
function start() {
  const data = new Array(100000).fill('item')

  const timer = setInterval(() => {
    console.log(data.length)
  }, 1000)

  return () => {
    clearInterval(timer)
  }
}

const stop = start()
stop()
```

### 事件监听未移除

```js
function mount() {
  const panel = document.querySelector('#panel')

  function handleResize() {
    console.log(panel.offsetWidth)
  }

  window.addEventListener('resize', handleResize)
}
```

如果页面或组件已经销毁，但事件监听仍然存在，监听函数可能继续引用旧 DOM 或旧状态。

修复：

```js
function mount() {
  const panel = document.querySelector('#panel')

  function handleResize() {
    console.log(panel.offsetWidth)
  }

  window.addEventListener('resize', handleResize)

  return () => {
    window.removeEventListener('resize', handleResize)
  }
}
```

### DOM 引用残留

```js
const cache = []

function removeNode() {
  const node = document.querySelector('#item')

  cache.push(node)
  node.remove()
}
```

即使 DOM 节点已经从页面移除，只要 `cache` 还保存着它，节点和它关联的数据就不会被回收。

如果只是保存节点相关元信息，可以考虑 `WeakMap`。

### Map 缓存无限增长

```js
const cache = new Map()

function getUser(id) {
  if (cache.has(id)) {
    return cache.get(id)
  }

  const user = fetchUser(id)
  cache.set(id, user)

  return user
}
```

如果缓存没有淘汰策略，`Map` 会一直增长。

常见处理方式：

- 限制缓存数量
- 设置过期时间
- 使用 LRU 策略
- 在路由切换或用户退出时清空缓存
- 对对象 key 且生命周期绑定的缓存使用 `WeakMap`

### 闭包持有大对象

```js
function createHandler() {
  const largeData = new Array(100000).fill('data')

  return () => {
    console.log(largeData.length)
  }
}

const handler = createHandler()
```

如果 `handler` 长期存在，`largeData` 也会长期存在。

如果只需要一部分数据，不要让闭包持有整个大对象。

```js
function createHandler(list) {
  const length = list.length

  return () => {
    console.log(length)
  }
}
```

### 未完成的异步任务

```js
function load() {
  const data = new Array(100000).fill('data')

  fetch('/api/list').then(() => {
    console.log(data.length)
  })
}
```

在请求完成前，Promise 回调引用的 `data` 不会被释放。通常这不是问题，但如果页面频繁创建请求并且无法取消，可能造成内存压力。

可以使用 `AbortController` 取消请求。

```js
const controller = new AbortController()

fetch('/api/list', {
  signal: controller.signal
})

controller.abort()
```

### WebSocket 和订阅未销毁

```js
function mountPage() {
  socket.on('message', handleMessage)
}
```

如果页面卸载时没有取消订阅，旧页面的回调仍然可能被触发，也会保留旧页面状态。

修复：

```js
function mountPage() {
  socket.on('message', handleMessage)

  return () => {
    socket.off('message', handleMessage)
  }
}
```

## 浏览器内存排查

Chrome DevTools 常用工具：

- Performance：观察页面运行时是否有长任务和频繁 GC
- Memory：查看堆快照、对象保留路径和内存增长
- Performance monitor：观察 JS heap size、DOM nodes、listeners 等指标

常见排查步骤：

1. 打开页面，记录初始内存。
2. 重复执行可疑操作，例如打开弹窗、切换路由、加载列表。
3. 手动触发 GC 或等待自动 GC。
4. 观察 JS heap 是否持续增长且不回落。
5. 拍摄 Heap Snapshot。
6. 查看 Detached DOM tree、Array、Object、Closure 等可疑对象。
7. 查看 Retainers，找到是谁还引用着它。
8. 回到代码中清理对应引用、定时器、事件监听或缓存。

Detached DOM tree 常见于 DOM 已经从页面移除，但仍然被 JavaScript 引用。

## Node.js 内存排查

Node.js 服务长期运行，更需要关注内存增长。

常见观察方式：

```js
setInterval(() => {
  const memory = process.memoryUsage()

  console.log({
    rss: memory.rss,
    heapTotal: memory.heapTotal,
    heapUsed: memory.heapUsed,
    external: memory.external
  })
}, 5000)
```

常见字段：

- `rss`：进程占用的常驻内存
- `heapTotal`：V8 堆总大小
- `heapUsed`：V8 堆已使用大小
- `external`：V8 管理之外的内存，例如 Buffer

常见问题来源：

- 全局缓存无限增长
- 请求级数据被全局对象引用
- 定时任务重复创建
- 事件监听越来越多
- Buffer 或文件流没有及时释放
- 日志、队列、连接池没有上限

## 性能实践

### 避免不必要的大对象保留

```js
function handle(list) {
  const ids = list.map((item) => item.id)

  return () => {
    console.log(ids.length)
  }
}
```

如果后续只需要 id，不要让闭包持有完整对象列表。

### 大列表分页或虚拟滚动

一次性渲染大量 DOM 节点会占用大量内存，也会增加布局和绘制成本。

建议：

- 后端分页
- 前端分页
- 虚拟列表
- 懒加载
- 离屏内容及时销毁

### 合理使用对象池

在高频创建对象的场景中，对象池可以减少分配压力，但会增加复杂度。

```js
const pool = []

function getPoint(x, y) {
  const point = pool.pop() ?? {}

  point.x = x
  point.y = y

  return point
}

function releasePoint(point) {
  point.x = 0
  point.y = 0
  pool.push(point)
}
```

对象池适合动画、游戏、图形计算等高频场景。普通业务代码不要为了“优化”过早引入对象池。

### 及时清理副作用

在组件化框架中，组件卸载时要清理副作用。

React 示例：

```jsx
useEffect(() => {
  const timer = setInterval(loadData, 1000)

  window.addEventListener('resize', handleResize)

  return () => {
    clearInterval(timer)
    window.removeEventListener('resize', handleResize)
  }
}, [])
```

Vue 示例：

```js
let timer = null

onMounted(() => {
  timer = setInterval(loadData, 1000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('resize', handleResize)
})
```

## 常见误区

- 有垃圾回收就不会内存泄漏
- `delete obj.key` 等于立刻释放内存
- `obj = null` 一定会马上触发 GC
- 闭包一定会导致内存泄漏
- `WeakMap` 能解决所有缓存问题
- 内存上涨就是泄漏，忽略了 GC 延迟和缓存策略
- 只看一次堆快照就判断泄漏，缺少重复操作对比

## 推荐检查清单

- 是否有全局变量保存大对象
- 定时器、事件监听、订阅是否在页面卸载时清理
- `Map`、数组、缓存是否有上限和淘汰策略
- DOM 节点移除后是否仍被 JavaScript 引用
- 闭包是否持有不再需要的大对象
- 异步请求、WebSocket、Worker 是否有取消和销毁逻辑
- 大列表是否做分页、懒加载或虚拟滚动
- Node.js 服务是否监控 `heapUsed` 和缓存大小

## 小结

- JavaScript 通过自动垃圾回收管理内存
- 垃圾回收核心依据是对象是否仍然可达
- 闭包、事件监听、定时器、缓存都会延长对象生命周期
- `WeakMap` 和 `WeakSet` 适合保存与对象生命周期绑定的数据
- 内存泄漏通常来自不再需要的对象仍被引用
- 浏览器可以用 DevTools Memory 排查堆对象和保留路径
- Node.js 可以用 `process.memoryUsage()` 观察进程内存趋势

## 导航

- 返回 [JavaScript 模块](../index.md)
