# 数据结构与常见手写

这里整理 JavaScript 面试和复习中高频出现的一组手写题与基础数据结构内容。

手写题不要只背代码，重点看清楚三件事：

- 输入输出是什么
- 边界情况是什么
- 需要保留哪些 JavaScript 语义，比如 `this`、原型链、异步顺序、循环引用

## 1. 防抖 debounce

防抖用于把频繁触发的操作合并成最后一次执行。常见场景是搜索输入、窗口缩放、表单校验。

```js
function debounce(fn, delay = 300, immediate = false) {
  let timer = null
  let result

  function debounced(...args) {
    const context = this
    const shouldCallNow = immediate && !timer

    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = null

      if (!immediate) {
        result = fn.apply(context, args)
      }
    }, delay)

    if (shouldCallNow) {
      result = fn.apply(context, args)
    }

    return result
  }

  debounced.cancel = function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}
```

使用示例：

```js
const handleInput = debounce(function (value) {
  console.log('search:', value)
}, 500)

handleInput('a')
handleInput('ab')
handleInput('abc')
```

核心点：

- 每次触发都清除旧定时器
- 只有停止触发超过指定时间后才执行
- 用 `apply` 保留原函数的 `this` 和参数

## 2. 节流 throttle

节流用于限制函数在一段时间内最多执行一次。常见场景是滚动、拖拽、按钮防重复点击。

```js
function throttle(fn, delay = 300, options = {}) {
  const leading = options.leading !== false
  const trailing = options.trailing !== false
  let lastTime = 0
  let timer = null
  let lastArgs
  let lastThis

  function invoke(time) {
    lastTime = time
    timer = null
    fn.apply(lastThis, lastArgs)
    lastArgs = null
    lastThis = null
  }

  function throttled(...args) {
    const now = Date.now()

    if (!lastTime && !leading) {
      lastTime = now
    }

    const remaining = delay - (now - lastTime)
    lastArgs = args
    lastThis = this

    if (remaining <= 0 || remaining > delay) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      invoke(now)
      return
    }

    if (!timer && trailing) {
      timer = setTimeout(() => {
        invoke(Date.now())
      }, remaining)
    }
  }

  throttled.cancel = function cancel() {
    if (timer) {
      clearTimeout(timer)
    }

    lastTime = 0
    timer = null
    lastArgs = null
    lastThis = null
  }

  return throttled
}
```

使用示例：

```js
const onScroll = throttle(() => {
  console.log('scrolling')
}, 200)

window.addEventListener('scroll', onScroll)
```

## 3. 深拷贝 deepClone

深拷贝要处理基本类型、对象、数组、循环引用，以及 `Date`、`RegExp`、`Map`、`Set` 等常见内置对象。

```js
function deepClone(value, cache = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (cache.has(value)) {
    return cache.get(value)
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (value instanceof RegExp) {
    const cloned = new RegExp(value.source, value.flags)
    cloned.lastIndex = value.lastIndex
    return cloned
  }

  if (value instanceof Map) {
    const cloned = new Map()
    cache.set(value, cloned)

    value.forEach((mapValue, mapKey) => {
      cloned.set(deepClone(mapKey, cache), deepClone(mapValue, cache))
    })

    return cloned
  }

  if (value instanceof Set) {
    const cloned = new Set()
    cache.set(value, cloned)

    value.forEach((setValue) => {
      cloned.add(deepClone(setValue, cache))
    })

    return cloned
  }

  const cloned = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))

  cache.set(value, cloned)

  Reflect.ownKeys(value).forEach((key) => {
    cloned[key] = deepClone(value[key], cache)
  })

  return cloned
}
```

使用示例：

```js
const source = {
  name: 'Tom',
  info: { age: 18 },
  list: [1, 2, 3]
}

source.self = source

const target = deepClone(source)

console.log(target !== source) // true
console.log(target.info !== source.info) // true
console.log(target.self === target) // true
```

## 4. 柯里化 curry

柯里化把多参数函数转换成可以分批接收参数的函数。

```js
function curry(fn, ...presetArgs) {
  return function curried(...args) {
    const allArgs = [...presetArgs, ...args]

    if (allArgs.length >= fn.length) {
      return fn.apply(this, allArgs)
    }

    return curry(fn, ...allArgs)
  }
}
```

使用示例：

```js
function add(a, b, c) {
  return a + b + c
}

const curriedAdd = curry(add)

console.log(curriedAdd(1)(2)(3)) // 6
console.log(curriedAdd(1, 2)(3)) // 6
console.log(curriedAdd(1)(2, 3)) // 6
```

## 5. 发布订阅 EventBus

发布订阅用于解耦消息发送方和接收方。常见能力包括 `on`、`off`、`once`、`emit`。

```js
class EventBus {
  constructor() {
    this.events = new Map()
  }

  on(type, handler) {
    if (!this.events.has(type)) {
      this.events.set(type, new Set())
    }

    this.events.get(type).add(handler)

    return () => this.off(type, handler)
  }

  off(type, handler) {
    const handlers = this.events.get(type)

    if (!handlers) {
      return
    }

    handlers.delete(handler)

    if (handlers.size === 0) {
      this.events.delete(type)
    }
  }

  once(type, handler) {
    const wrapper = (...args) => {
      this.off(type, wrapper)
      handler(...args)
    }

    return this.on(type, wrapper)
  }

  emit(type, ...args) {
    const handlers = this.events.get(type)

    if (!handlers) {
      return
    }

    ;[...handlers].forEach((handler) => {
      handler(...args)
    })
  }
}
```

使用示例：

```js
const bus = new EventBus()

const unsubscribe = bus.on('login', (user) => {
  console.log(user.name)
})

bus.emit('login', { name: 'Tom' })
unsubscribe()
```

## 6. LRU 缓存

LRU 表示最近最少使用。容量满时，优先淘汰最久没有被访问的数据。

`Map` 会按插入顺序保存键，删除后重新插入可以把数据移动到最新位置。

```js
class LRUCache {
  constructor(capacity) {
    if (capacity <= 0) {
      throw new Error('capacity must be greater than 0')
    }

    this.capacity = capacity
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) {
      return -1
    }

    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    this.cache.set(key, value)

    if (this.cache.size > this.capacity) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
  }
}
```

使用示例：

```js
const lru = new LRUCache(2)

lru.put('a', 1)
lru.put('b', 2)

console.log(lru.get('a')) // 1

lru.put('c', 3)

console.log(lru.get('b')) // -1
```

## 7. 并发控制

并发控制用于限制同一时间运行的异步任务数量。

```js
function limitConcurrency(tasks, limit) {
  return new Promise((resolve, reject) => {
    const results = []
    let nextIndex = 0
    let running = 0
    let finished = 0

    if (tasks.length === 0) {
      resolve(results)
      return
    }

    function runNext() {
      while (running < limit && nextIndex < tasks.length) {
        const currentIndex = nextIndex
        const task = tasks[currentIndex]

        nextIndex += 1
        running += 1

        Promise.resolve()
          .then(task)
          .then((value) => {
            results[currentIndex] = value
            running -= 1
            finished += 1

            if (finished === tasks.length) {
              resolve(results)
              return
            }

            runNext()
          })
          .catch(reject)
      }
    }

    runNext()
  })
}
```

使用示例：

```js
const tasks = [1, 2, 3, 4].map((item) => {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(item), 1000)
    })
})

limitConcurrency(tasks, 2).then((result) => {
  console.log(result) // [1, 2, 3, 4]
})
```

## 8. new 手写

`new` 做了四件事：

1. 创建一个新对象
2. 把新对象的原型指向构造函数的 `prototype`
3. 让构造函数里的 `this` 指向新对象
4. 如果构造函数返回对象，则返回该对象，否则返回新对象

```js
function myNew(Constructor, ...args) {
  const instance = Object.create(Constructor.prototype)
  const result = Constructor.apply(instance, args)

  if (
    result !== null &&
    (typeof result === 'object' || typeof result === 'function')
  ) {
    return result
  }

  return instance
}
```

使用示例：

```js
function Person(name) {
  this.name = name
}

Person.prototype.sayName = function sayName() {
  return this.name
}

const person = myNew(Person, 'Tom')

console.log(person.name) // Tom
console.log(person.sayName()) // Tom
```

## 9. instanceof 手写

`instanceof` 判断构造函数的 `prototype` 是否出现在对象的原型链上。

```js
function myInstanceof(value, Constructor) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false
  }

  let proto = Object.getPrototypeOf(value)
  const target = Constructor.prototype

  while (proto) {
    if (proto === target) {
      return true
    }

    proto = Object.getPrototypeOf(proto)
  }

  return false
}
```

使用示例：

```js
console.log(myInstanceof([], Array)) // true
console.log(myInstanceof({}, Array)) // false
console.log(myInstanceof(1, Number)) // false
```

## 10. call / apply / bind 手写

### call

```js
Function.prototype.myCall = function myCall(context, ...args) {
  if (typeof this !== 'function') {
    throw new TypeError('caller must be a function')
  }

  const target = context == null ? globalThis : Object(context)
  const key = Symbol('fn')

  target[key] = this
  const result = target[key](...args)
  delete target[key]

  return result
}
```

### apply

```js
Function.prototype.myApply = function myApply(context, args = []) {
  if (typeof this !== 'function') {
    throw new TypeError('caller must be a function')
  }

  const target = context == null ? globalThis : Object(context)
  const key = Symbol('fn')

  target[key] = this
  const result = target[key](...args)
  delete target[key]

  return result
}
```

### bind

```js
Function.prototype.myBind = function myBind(context, ...presetArgs) {
  if (typeof this !== 'function') {
    throw new TypeError('caller must be a function')
  }

  const fn = this

  function bound(...args) {
    const isNew = this instanceof bound
    const finalContext = isNew ? this : context

    return fn.apply(finalContext, [...presetArgs, ...args])
  }

  if (fn.prototype) {
    bound.prototype = Object.create(fn.prototype)
    bound.prototype.constructor = bound
  }

  return bound
}
```

使用示例：

```js
function getName(prefix) {
  return prefix + this.name
}

const user = { name: 'Tom' }

console.log(getName.myCall(user, 'hi ')) // hi Tom
console.log(getName.myApply(user, ['hi '])) // hi Tom

const boundGetName = getName.myBind(user, 'hi ')

console.log(boundGetName()) // hi Tom
```

## 11. Promise 并发调度器

并发调度器可以不断接收任务，但同一时间最多运行指定数量。

```js
class Scheduler {
  constructor(limit = 2) {
    this.limit = limit
    this.running = 0
    this.queue = []
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      })

      this.run()
    })
  }

  run() {
    while (this.running < this.limit && this.queue.length > 0) {
      const item = this.queue.shift()

      this.running += 1

      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.running -= 1
          this.run()
        })
    }
  }
}
```

使用示例：

```js
const scheduler = new Scheduler(2)

function createTask(value, delay) {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(value), delay)
    })
}

scheduler.add(createTask('a', 1000)).then(console.log)
scheduler.add(createTask('b', 500)).then(console.log)
scheduler.add(createTask('c', 300)).then(console.log)
```

## 12. 栈 Stack

栈是后进先出的数据结构。

```js
class Stack {
  constructor() {
    this.items = []
  }

  push(value) {
    this.items.push(value)
  }

  pop() {
    return this.items.pop()
  }

  peek() {
    return this.items[this.items.length - 1]
  }

  isEmpty() {
    return this.items.length === 0
  }

  size() {
    return this.items.length
  }
}
```

## 13. 队列 Queue

队列是先进先出的数据结构。为了避免 `Array.prototype.shift` 频繁移动元素，可以用头指针实现。

```js
class Queue {
  constructor() {
    this.items = []
    this.head = 0
  }

  enqueue(value) {
    this.items.push(value)
  }

  dequeue() {
    if (this.isEmpty()) {
      return undefined
    }

    const value = this.items[this.head]
    this.head += 1

    if (this.head > 50 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head)
      this.head = 0
    }

    return value
  }

  peek() {
    return this.items[this.head]
  }

  isEmpty() {
    return this.size() === 0
  }

  size() {
    return this.items.length - this.head
  }
}
```

## 14. 链表 LinkedList

链表由节点组成，每个节点保存当前值和下一个节点的引用。

```js
class ListNode {
  constructor(value) {
    this.value = value
    this.next = null
  }
}

class LinkedList {
  constructor() {
    this.head = null
    this.length = 0
  }

  append(value) {
    const node = new ListNode(value)

    if (!this.head) {
      this.head = node
      this.length += 1
      return node
    }

    let current = this.head

    while (current.next) {
      current = current.next
    }

    current.next = node
    this.length += 1

    return node
  }

  insert(index, value) {
    if (index < 0 || index > this.length) {
      return false
    }

    const node = new ListNode(value)

    if (index === 0) {
      node.next = this.head
      this.head = node
      this.length += 1
      return true
    }

    const previous = this.getNode(index - 1)
    node.next = previous.next
    previous.next = node
    this.length += 1

    return true
  }

  removeAt(index) {
    if (index < 0 || index >= this.length) {
      return undefined
    }

    let removed

    if (index === 0) {
      removed = this.head
      this.head = this.head.next
      this.length -= 1
      return removed.value
    }

    const previous = this.getNode(index - 1)
    removed = previous.next
    previous.next = removed.next
    this.length -= 1

    return removed.value
  }

  getNode(index) {
    if (index < 0 || index >= this.length) {
      return null
    }

    let current = this.head

    for (let i = 0; i < index; i += 1) {
      current = current.next
    }

    return current
  }

  toArray() {
    const result = []
    let current = this.head

    while (current) {
      result.push(current.value)
      current = current.next
    }

    return result
  }
}
```

使用示例：

```js
const list = new LinkedList()

list.append(1)
list.append(3)
list.insert(1, 2)

console.log(list.toArray()) // [1, 2, 3]

list.removeAt(1)

console.log(list.toArray()) // [1, 3]
```

## 15. 哈希表 HashTable

下面是一个简化版哈希表，用拉链法处理冲突。

```js
class HashTable {
  constructor(size = 53) {
    this.buckets = Array.from({ length: size }, () => [])
  }

  hash(key) {
    const str = String(key)
    let total = 0
    const prime = 31

    for (let i = 0; i < str.length; i += 1) {
      total = (total * prime + str.charCodeAt(i)) % this.buckets.length
    }

    return total
  }

  set(key, value) {
    const index = this.hash(key)
    const bucket = this.buckets[index]
    const pair = bucket.find((item) => item[0] === key)

    if (pair) {
      pair[1] = value
      return
    }

    bucket.push([key, value])
  }

  get(key) {
    const index = this.hash(key)
    const bucket = this.buckets[index]
    const pair = bucket.find((item) => item[0] === key)

    return pair ? pair[1] : undefined
  }

  has(key) {
    const index = this.hash(key)
    const bucket = this.buckets[index]

    return bucket.some((item) => item[0] === key)
  }

  delete(key) {
    const index = this.hash(key)
    const bucket = this.buckets[index]
    const pairIndex = bucket.findIndex((item) => item[0] === key)

    if (pairIndex === -1) {
      return false
    }

    bucket.splice(pairIndex, 1)
    return true
  }
}
```

## 16. 异步队列 AsyncQueue

异步队列适合把任务按顺序一个个执行。

```js
class AsyncQueue {
  constructor() {
    this.queue = Promise.resolve()
  }

  add(task) {
    const next = this.queue.then(() => task())

    this.queue = next.catch(() => {})

    return next
  }
}
```

使用示例：

```js
const queue = new AsyncQueue()

queue.add(() => Promise.resolve('first')).then(console.log)
queue.add(() => Promise.resolve('second')).then(console.log)
```

## 17. 限流器 RateLimiter

限流器用于限制单位时间内最多执行多少个任务。

```js
class RateLimiter {
  constructor(limit, interval) {
    this.limit = limit
    this.interval = interval
    this.tokens = limit
    this.queue = []

    setInterval(() => {
      this.tokens = this.limit
      this.run()
    }, this.interval)
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      })

      this.run()
    })
  }

  run() {
    while (this.tokens > 0 && this.queue.length > 0) {
      const item = this.queue.shift()

      this.tokens -= 1

      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
    }
  }
}
```

使用示例：

```js
const limiter = new RateLimiter(2, 1000)

limiter.add(() => Promise.resolve('task 1')).then(console.log)
limiter.add(() => Promise.resolve('task 2')).then(console.log)
limiter.add(() => Promise.resolve('task 3')).then(console.log)
```

## 复习建议

- 防抖和节流重点比较触发时机
- 深拷贝重点记住循环引用和特殊对象
- `call`、`apply`、`bind` 重点保留 `this` 语义
- `new` 和 `instanceof` 重点理解原型链
- LRU、栈、队列、链表、哈希表重点理解数据结构的操作成本
- 并发控制、异步队列、限流器重点理解任务启动顺序和结果顺序
