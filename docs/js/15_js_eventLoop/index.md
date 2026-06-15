# 15 Event Loop

Event Loop 是 JavaScript 运行时调度同步代码、异步回调、微任务、渲染和 I/O 的机制。

JavaScript 引擎本身只负责执行代码。浏览器或 Node.js 这样的运行环境负责提供定时器、网络、事件、文件 I/O 等能力，并把异步任务的回调放回队列中等待执行。

## 演示文件

- [Event Loop Demo](./event-loop-demo.html)

这个 demo 可以直接在浏览器里打开，用来观察同步代码、微任务、宏任务、`requestAnimationFrame` 和渲染阻塞的执行顺序。

## 核心结论

- JavaScript 主线程一次只能执行一个任务
- 同步代码会先进入调用栈执行
- 异步 API 由运行环境处理，完成后把回调放入任务队列
- 当前宏任务执行完后，会清空微任务队列
- 微任务清空后，浏览器才有机会进行渲染
- 下一轮事件循环再取出下一个宏任务执行

简化流程：

```text
执行一个宏任务
      |
      v
执行当前任务中的同步代码
      |
      v
清空所有微任务
      |
      v
浏览器根据需要进行渲染
      |
      v
取出下一个宏任务
```

## 调用栈

调用栈用来记录当前正在执行的函数。函数调用时入栈，函数执行结束后出栈。

```js
function c() {
  console.log('c')
}

function b() {
  c()
}

function a() {
  b()
}

a()
```

执行顺序：

```text
a 入栈
b 入栈
c 入栈
c 出栈
b 出栈
a 出栈
```

如果同步代码一直不结束，调用栈无法清空，后面的异步回调和页面渲染都没有机会执行。

```js
while (true) {
  // 页面会卡死
}
```

## 宏任务

宏任务可以理解为事件循环每一轮取出来执行的大任务。

浏览器中常见宏任务：

- 整体 script 代码
- `setTimeout`
- `setInterval`
- DOM 事件回调
- 网络请求回调
- `postMessage`
- `MessageChannel`
- `requestAnimationFrame` 回调通常在渲染前执行，调度位置和普通宏任务不同

示例：

```js
console.log('start')

setTimeout(() => {
  console.log('timer')
}, 0)

console.log('end')

// start
// end
// timer
```

`setTimeout(..., 0)` 不代表立即执行，而是把回调放到后续任务中等待调用栈清空。

## 微任务

微任务会在当前宏任务结束后、浏览器渲染前执行。

常见微任务：

- `Promise.then`
- `Promise.catch`
- `Promise.finally`
- `queueMicrotask`
- `MutationObserver`

示例：

```js
console.log('start')

Promise.resolve().then(() => {
  console.log('promise')
})

console.log('end')

// start
// end
// promise
```

微任务队列会被一次性清空。如果微任务中继续创建微任务，新创建的微任务也会在本轮继续执行。

```js
Promise.resolve().then(() => {
  console.log('microtask 1')

  Promise.resolve().then(() => {
    console.log('microtask 2')
  })
})

setTimeout(() => {
  console.log('timer')
}, 0)

// microtask 1
// microtask 2
// timer
```

这也是为什么不能无限递归创建微任务，否则会让浏览器一直没有机会渲染。

```js
function loop() {
  queueMicrotask(loop)
}

loop()
```

## 宏任务和微任务的执行顺序

经典例子：

```js
console.log('1')

setTimeout(() => {
  console.log('2')
}, 0)

Promise.resolve().then(() => {
  console.log('3')
})

console.log('4')

// 1
// 4
// 3
// 2
```

执行过程：

1. 整体 script 作为第一个宏任务执行。
2. 输出 `1`。
3. 注册 `setTimeout`，回调进入后续宏任务队列。
4. 注册 Promise 微任务。
5. 输出 `4`。
6. 当前宏任务结束，清空微任务队列，输出 `3`。
7. 进入下一轮事件循环，执行定时器宏任务，输出 `2`。

再看一个嵌套例子：

```js
console.log('start')

setTimeout(() => {
  console.log('timer 1')

  Promise.resolve().then(() => {
    console.log('promise in timer')
  })
}, 0)

Promise.resolve().then(() => {
  console.log('promise 1')

  setTimeout(() => {
    console.log('timer in promise')
  }, 0)
})

console.log('end')

// start
// end
// promise 1
// timer 1
// promise in timer
// timer in promise
```

关键点：每执行完一个宏任务，都要先清空该宏任务产生的微任务，再执行下一个宏任务。

## async / await 与事件循环

`async / await` 本质上仍然基于 Promise。

```js
async function fn() {
  console.log('2')
  await Promise.resolve()
  console.log('4')
}

console.log('1')
fn()
console.log('3')

// 1
// 2
// 3
// 4
```

可以把 `await` 后面的代码理解成被放进 Promise 微任务中执行。

```js
async function fn() {
  console.log('before')
  await 1
  console.log('after')
}
```

大致等价于：

```js
function fn() {
  console.log('before')

  return Promise.resolve(1).then(() => {
    console.log('after')
  })
}
```

更复杂的例子：

```js
async function async1() {
  console.log('async1 start')
  await async2()
  console.log('async1 end')
}

async function async2() {
  console.log('async2')
}

console.log('script start')

setTimeout(() => {
  console.log('setTimeout')
}, 0)

async1()

new Promise((resolve) => {
  console.log('promise1')
  resolve()
}).then(() => {
  console.log('promise2')
})

console.log('script end')
```

输出：

```text
script start
async1 start
async2
promise1
script end
async1 end
promise2
setTimeout
```

分析：

1. 整体 script 执行，输出 `script start`。
2. 注册 `setTimeout`。
3. 调用 `async1`，输出 `async1 start`。
4. 调用 `async2`，输出 `async2`。
5. `await async2()` 后面的 `async1 end` 进入微任务。
6. 创建 Promise 时构造函数同步执行，输出 `promise1`。
7. `then` 回调进入微任务。
8. 输出 `script end`。
9. 清空微任务，输出 `async1 end`、`promise2`。
10. 执行定时器，输出 `setTimeout`。

## 浏览器渲染时机

浏览器渲染不是每执行一行代码就发生一次。通常在一轮宏任务结束、微任务清空后，浏览器才有机会进行样式计算、布局、绘制和合成。

```text
宏任务
      |
      v
微任务全部执行完
      |
      v
浏览器判断是否需要渲染
      |
      v
样式计算 -> 布局 -> 绘制 -> 合成
```

这意味着大量同步代码或大量微任务都会阻塞渲染。

```js
button.addEventListener('click', () => {
  box.textContent = 'loading'

  const start = Date.now()

  while (Date.now() - start < 3000) {
    // 阻塞 3 秒
  }
})
```

上面代码设置了 `loading`，但浏览器要等当前任务结束后才有机会渲染，所以用户可能看不到立即更新。

如果希望先让浏览器渲染，再执行耗时代码，可以把耗时任务拆到后续任务中。

```js
button.addEventListener('click', () => {
  box.textContent = 'loading'

  setTimeout(() => {
    heavyWork()
  }, 0)
})
```

## requestAnimationFrame

`requestAnimationFrame` 会在浏览器下一次重绘前执行，适合做动画和视觉更新。

```js
function animate() {
  updatePosition()
  requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
```

一般可以这样理解：

```text
执行宏任务
清空微任务
执行 requestAnimationFrame 回调
浏览器渲染
执行下一轮任务
```

`requestAnimationFrame` 的特点：

- 回调频率通常和屏幕刷新率一致
- 页面在后台时，执行频率可能降低或暂停
- 比 `setInterval` 更适合动画
- 可以避免在不可见页面里浪费计算资源

## requestIdleCallback

`requestIdleCallback` 用于在浏览器空闲时执行低优先级任务。

```js
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    runTask(tasks.shift())
  }
})
```

适合场景：

- 非关键日志处理
- 预加载
- 缓存清理
- 大任务切片

不要把关键业务逻辑放进 `requestIdleCallback`，因为浏览器忙碌时它可能很晚才执行。

## 浏览器加载和渲染流程

浏览器从输入 URL 到页面可交互，大致会经历：

```text
DNS 解析
      |
      v
建立连接
      |
      v
发送 HTTP 请求
      |
      v
接收 HTML
      |
      v
解析 HTML，构建 DOM
      |
      v
解析 CSS，构建 CSSOM
      |
      v
执行 JavaScript
      |
      v
构建 Render Tree
      |
      v
Layout
      |
      v
Paint
      |
      v
Composite
```

JavaScript 会影响页面渲染：

- 同步脚本会阻塞 HTML 解析
- 脚本可能读取和修改 DOM、CSSOM
- CSSOM 未完成时，脚本执行可能被阻塞
- 大量同步脚本会延迟首屏渲染

### script、defer、async

普通脚本：

```html
<script src="main.js"></script>
```

特点：

- 解析 HTML 时遇到脚本会暂停解析
- 下载脚本
- 执行脚本
- 脚本执行完后继续解析 HTML

`defer`：

```html
<script defer src="main.js"></script>
```

特点：

- 脚本下载不阻塞 HTML 解析
- 等 HTML 解析完成后按顺序执行
- 会在 `DOMContentLoaded` 前执行
- 适合依赖 DOM 的业务脚本

`async`：

```html
<script async src="analytics.js"></script>
```

特点：

- 脚本下载不阻塞 HTML 解析
- 下载完成后立即执行
- 多个 `async` 脚本执行顺序不固定
- 适合统计脚本、广告脚本等独立逻辑

## DOMContentLoaded 和 load

`DOMContentLoaded` 表示 HTML 已经解析完成，DOM 树已经构建好，不等待图片、视频等资源加载完成。

```js
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready')
})
```

`load` 表示页面依赖资源都加载完成。

```js
window.addEventListener('load', () => {
  console.log('all resources loaded')
})
```

通常业务初始化使用 `DOMContentLoaded` 就够了。只有需要等待图片尺寸、字体、iframe 等资源时，才需要用 `load`。

## Node.js 事件循环

Node.js 也有事件循环，但它的阶段比浏览器更细，主要由 libuv 驱动。

常见阶段可以简化理解为：

```text
timers
      |
      v
pending callbacks
      |
      v
poll
      |
      v
check
      |
      v
close callbacks
```

常见 API 对应关系：

- `setTimeout`、`setInterval`：timers 阶段
- I/O 回调：poll 阶段
- `setImmediate`：check 阶段
- `close` 事件：close callbacks 阶段
- `process.nextTick`：特殊队列，优先级高于 Promise 微任务
- `Promise.then`、`queueMicrotask`：微任务队列

示例：

```js
setTimeout(() => {
  console.log('timeout')
}, 0)

setImmediate(() => {
  console.log('immediate')
})
```

在主模块里，`setTimeout(..., 0)` 和 `setImmediate` 的先后顺序可能受环境影响，不应该依赖它们的绝对顺序。

在 I/O 回调中，`setImmediate` 通常先于 `setTimeout(..., 0)` 执行。

```js
const fs = require('fs')

fs.readFile(__filename, () => {
  setTimeout(() => {
    console.log('timeout')
  }, 0)

  setImmediate(() => {
    console.log('immediate')
  })
})
```

通常输出：

```text
immediate
timeout
```

### process.nextTick

`process.nextTick` 是 Node.js 的特殊任务队列，它会在当前调用栈结束后、Promise 微任务之前执行。

```js
Promise.resolve().then(() => {
  console.log('promise')
})

process.nextTick(() => {
  console.log('nextTick')
})

console.log('sync')

// sync
// nextTick
// promise
```

过度使用 `process.nextTick` 也可能阻塞 I/O。

## 常见面试题

### 题目 1

```js
console.log('A')

setTimeout(() => {
  console.log('B')
}, 0)

Promise.resolve().then(() => {
  console.log('C')
})

console.log('D')
```

输出：

```text
A
D
C
B
```

原因：同步代码先执行，微任务在当前宏任务结束后执行，定时器宏任务最后执行。

### 题目 2

```js
setTimeout(() => {
  console.log('1')

  Promise.resolve().then(() => {
    console.log('2')
  })
}, 0)

setTimeout(() => {
  console.log('3')
}, 0)
```

输出：

```text
1
2
3
```

原因：第一个定时器宏任务执行完后，会先清空它产生的微任务，再执行第二个定时器宏任务。

### 题目 3

```js
async function foo() {
  console.log('foo start')
  await bar()
  console.log('foo end')
}

async function bar() {
  console.log('bar')
}

console.log('script start')

foo()

Promise.resolve().then(() => {
  console.log('promise')
})

console.log('script end')
```

输出：

```text
script start
foo start
bar
script end
foo end
promise
```

原因：`await bar()` 后面的代码会作为微任务排队，排队时间早于后面的 `Promise.then`。

## 常见误区

- `setTimeout(fn, 0)` 不是立即执行
- Promise 构造函数里的代码是同步执行的
- `await` 后面的代码会进入微任务
- 微任务会在下一轮宏任务前全部清空
- 浏览器不一定每轮事件循环都渲染，但渲染前一定会清空微任务
- 大量微任务会阻塞渲染
- `requestAnimationFrame` 更适合动画，`setInterval` 不适合高精度动画
- 浏览器事件循环和 Node.js 事件循环不完全一样

## 学习建议

学习 Event Loop 时不要死记“宏任务列表”和“微任务列表”，更重要的是把流程画出来：

1. 当前同步代码执行到哪里。
2. 哪些回调进入了宏任务队列。
3. 哪些回调进入了微任务队列。
4. 当前宏任务结束后，微任务按什么顺序清空。
5. 浏览器有没有机会渲染。
6. 下一轮宏任务是什么。

## 小结

- Event Loop 负责协调同步代码、异步回调、微任务和渲染
- 整体 script、定时器、事件回调等通常可以理解为宏任务
- Promise 回调、`queueMicrotask`、`MutationObserver` 属于微任务
- 每个宏任务结束后都会清空微任务队列
- 浏览器渲染通常发生在宏任务结束、微任务清空之后
- `async / await` 本质上仍然基于 Promise 和微任务
- Node.js 事件循环有自己的阶段，`process.nextTick` 优先级高于 Promise 微任务

## 导航

- 返回 [JavaScript 模块](../index.md)
