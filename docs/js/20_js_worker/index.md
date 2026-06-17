# 20 Worker

Web Worker 允许浏览器在主线程之外创建后台线程，用来执行耗时任务。它不能直接操作 DOM，但可以通过消息和主线程通信，从而避免大量计算阻塞页面渲染和用户交互。

## 为什么需要 Web Worker

JavaScript 主线程负责执行脚本、处理用户事件、计算样式、布局和绘制。如果在主线程执行大量同步计算，页面会卡顿甚至无响应。

```js
button.addEventListener('click', () => {
  let total = 0

  for (let i = 0; i < 10_000_000_000; i += 1) {
    total += i
  }

  console.log(total)
})
```

这类计算会长时间占用主线程。Web Worker 可以把计算放到后台线程中执行。

```text
主线程
  |
  | postMessage
  v
Worker 线程执行耗时任务
  |
  | postMessage
  v
主线程接收结果并更新页面
```

适合放进 Worker 的任务：

- 大量数据计算
- 图片、音视频、文件处理
- 大 JSON 解析或格式转换
- 加密、压缩、解压缩
- WebAssembly 计算
- 不需要直接操作 DOM 的后台任务

不适合放进 Worker 的任务：

- 直接操作 DOM
- 依赖 `window`、`document` 的逻辑
- 很小的计算任务
- 频繁传递大量普通对象且没有优化通信成本的任务

## Dedicated Worker

Dedicated Worker 是最常见的 Worker 类型，它只服务于创建它的那个页面或脚本。

主线程：

```js
const worker = new Worker('./worker.js')

worker.postMessage({
  type: 'sum',
  payload: [1, 2, 3, 4]
})

worker.onmessage = (event) => {
  console.log(event.data) // { type: 'sum:result', payload: 10 }
}
```

`worker.js`：

```js
self.onmessage = (event) => {
  const { type, payload } = event.data

  if (type === 'sum') {
    const result = payload.reduce((total, item) => total + item, 0)

    self.postMessage({
      type: 'sum:result',
      payload: result
    })
  }
}
```

在 Worker 内部，全局对象不是 `window`，通常使用 `self`。

## 模块 Worker

现代浏览器支持模块 Worker，可以在 Worker 文件中使用 ES Module。

```js
const worker = new Worker('./worker.js', {
  type: 'module'
})
```

`worker.js`：

```js
import { calc } from './calc.js'

self.onmessage = (event) => {
  const result = calc(event.data)

  self.postMessage(result)
}
```

在 Vite、Webpack 等构建工具中，常见写法是使用 `new URL` 让构建工具正确处理 Worker 文件。

```js
const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module'
})
```

## 主线程通信

主线程和 Worker 之间通过 `postMessage` 发送消息，通过 `message` 事件接收消息。

主线程：

```js
const worker = new Worker('./worker.js')

worker.addEventListener('message', (event) => {
  console.log('from worker:', event.data)
})

worker.postMessage({
  id: 1,
  action: 'parse',
  payload: '{"name":"Tom"}'
})
```

Worker：

```js
self.addEventListener('message', (event) => {
  const { id, action, payload } = event.data

  if (action === 'parse') {
    self.postMessage({
      id,
      result: JSON.parse(payload)
    })
  }
})
```

实际项目中建议给消息加上 `id` 和 `type`，方便匹配请求和响应。

```js
{
  id: 'task-1',
  type: 'image:resize',
  payload: {}
}
```

## 数据复制和结构化克隆

`postMessage` 传递数据时，默认使用结构化克隆算法。它不是共享同一个对象，而是把数据复制到另一条线程。

可以传递：

- 普通对象
- 数组
- `Map`
- `Set`
- `Date`
- `Blob`
- `File`
- `ArrayBuffer`

不能传递：

- 函数
- DOM 节点
- 原型链上的方法语义
- 某些包含运行时状态的对象

```js
worker.postMessage({
  user: {
    id: 1,
    name: 'Tom'
  }
})
```

复制大对象会有成本。如果数据很大，要考虑可转移对象或共享内存。

## Transferable Objects

可转移对象可以把数据所有权从一个线程转移到另一个线程，避免大数据复制。

常见可转移对象：

- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `OffscreenCanvas`

```js
const buffer = new ArrayBuffer(1024)

worker.postMessage(
  {
    type: 'buffer',
    payload: buffer
  },
  [buffer]
)

console.log(buffer.byteLength) // 0
```

转移后，原线程里的 `buffer` 会变成不可用状态，因为所有权已经交给 Worker。

Worker：

```js
self.onmessage = (event) => {
  const { payload } = event.data

  console.log(payload.byteLength) // 1024
}
```

可转移对象适合处理大文件、图片像素数据、音视频数据等场景。

## SharedArrayBuffer 和 Atomics

`SharedArrayBuffer` 可以让多个线程共享同一块内存。它不会复制或转移数据，而是多个线程同时访问同一份二进制内存。

```js
const sharedBuffer = new SharedArrayBuffer(4)
const view = new Int32Array(sharedBuffer)

worker.postMessage(sharedBuffer)

Atomics.store(view, 0, 1)
Atomics.notify(view, 0)
```

Worker：

```js
self.onmessage = (event) => {
  const view = new Int32Array(event.data)

  Atomics.wait(view, 0, 0)

  console.log(Atomics.load(view, 0))
}
```

`SharedArrayBuffer` 涉及跨线程共享内存，使用时要通过 `Atomics` 保证同步。它通常只在高性能计算、音视频处理、WebAssembly 多线程等场景使用。

## 错误处理

主线程可以监听 Worker 的错误。

```js
worker.addEventListener('error', (event) => {
  console.log(event.message)
  console.log(event.filename)
  console.log(event.lineno)
})
```

如果 Worker 内部 Promise rejected 但没有捕获，可以监听 `unhandledrejection`。

```js
worker.addEventListener('messageerror', () => {
  console.log('消息无法反序列化')
})
```

Worker 内部也应该主动捕获错误并把错误信息发回主线程。

```js
self.onmessage = async (event) => {
  try {
    const result = await runTask(event.data)

    self.postMessage({
      type: 'success',
      result
    })
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message
    })
  }
}
```

## 终止 Worker

主线程可以主动终止 Worker。

```js
worker.terminate()
```

Worker 内部也可以关闭自己。

```js
self.close()
```

适合终止 Worker 的场景：

- 页面离开
- 用户取消任务
- 任务执行完成后不再复用
- Worker 出现不可恢复错误

如果频繁创建和销毁 Worker，会有额外开销。高频任务可以复用 Worker 或使用 Worker 池。

## Worker 池

Worker 池是提前创建多个 Worker，把任务分发给空闲 Worker 执行。

```text
任务队列 -> Worker 1
        -> Worker 2
        -> Worker 3
```

Worker 池适合：

- 任务数量多
- 单个任务耗时明显
- 需要限制并发数量
- 不希望频繁创建 Worker

简单思路：

```js
class WorkerPool {
  constructor(createWorker, size) {
    this.workers = Array.from({ length: size }, () => ({
      worker: createWorker(),
      busy: false
    }))
    this.queue = []
  }

  run(payload) {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, resolve, reject })
      this.next()
    })
  }

  next() {
    const item = this.queue.shift()
    const record = this.workers.find((worker) => !worker.busy)

    if (!item || !record) {
      return
    }

    record.busy = true

    record.worker.onmessage = (event) => {
      record.busy = false
      item.resolve(event.data)
      this.next()
    }

    record.worker.onerror = (error) => {
      record.busy = false
      item.reject(error)
      this.next()
    }

    record.worker.postMessage(item.payload)
  }
}
```

真实项目还要处理任务 ID、超时、取消、重试和销毁。

## SharedWorker

`SharedWorker` 可以被同源下多个页面、iframe 或脚本共享。

主线程：

```js
const sharedWorker = new SharedWorker('./shared-worker.js')

sharedWorker.port.start()

sharedWorker.port.postMessage({
  type: 'hello'
})

sharedWorker.port.onmessage = (event) => {
  console.log(event.data)
}
```

`shared-worker.js`：

```js
const ports = []

self.onconnect = (event) => {
  const port = event.ports[0]

  ports.push(port)
  port.start()

  port.onmessage = (messageEvent) => {
    ports.forEach((currentPort) => {
      currentPort.postMessage(messageEvent.data)
    })
  }
}
```

SharedWorker 适合多个页面共享同一个后台连接或状态，例如：

- 多标签页共享 WebSocket
- 多页面共享缓存状态
- 多页面之间消息同步

需要注意浏览器兼容性和生命周期管理。

## Service Worker

Service Worker 也是 Worker 的一种，但它的定位不同：它运行在浏览器后台，可以拦截网络请求、管理缓存、处理推送通知。

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

`sw.js`：

```js
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
```

Service Worker 常用于：

- 离线缓存
- PWA
- 请求代理
- 后台同步
- 推送通知

它和普通 Web Worker 的区别：

- 普通 Worker 由页面创建，通常跟随页面生命周期
- Service Worker 由浏览器管理，可以在页面关闭后仍被唤醒
- Service Worker 可以拦截网络请求
- Service Worker 不能直接访问 DOM

## OffscreenCanvas

`OffscreenCanvas` 可以把 Canvas 绘制工作放到 Worker 中执行，减少主线程压力。

主线程：

```js
const canvas = document.querySelector('canvas')
const offscreen = canvas.transferControlToOffscreen()
const worker = new Worker('./canvas-worker.js')

worker.postMessage(
  {
    canvas: offscreen
  },
  [offscreen]
)
```

Worker：

```js
self.onmessage = (event) => {
  const canvas = event.data.canvas
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = 'red'
  ctx.fillRect(0, 0, 100, 100)
}
```

适合复杂图表、图片处理、游戏渲染、可视化等场景。

## Worker 中可以使用什么

Worker 中常见可用能力：

- `fetch`
- `setTimeout`
- `setInterval`
- `Promise`
- `WebSocket`
- `IndexedDB`
- `crypto`
- `importScripts`
- `WebAssembly`

Worker 中不能直接使用：

- `window`
- `document`
- DOM API
- 直接操作页面元素
- 部分和 UI 强相关的浏览器 API

传统 Worker 可以用 `importScripts` 加载脚本。

```js
importScripts('./lib.js')
```

模块 Worker 中更推荐使用 `import`。

## 性能优化场景

### 大数据计算

```js
// main.js
const worker = new Worker('./sort-worker.js')

worker.postMessage(largeList)

worker.onmessage = (event) => {
  render(event.data)
}
```

```js
// sort-worker.js
self.onmessage = (event) => {
  const sorted = event.data.toSorted((a, b) => a.value - b.value)

  self.postMessage(sorted)
}
```

### 大文件切片计算 hash

```js
self.onmessage = async (event) => {
  const file = event.data
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)

  self.postMessage(hashBuffer, [hashBuffer])
}
```

### 图片处理

```js
self.onmessage = async (event) => {
  const imageBitmap = await createImageBitmap(event.data)
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(imageBitmap, 0, 0)

  const blob = await canvas.convertToBlob({
    type: 'image/png'
  })

  self.postMessage(blob)
}
```

## 常见问题

### Worker 能操作 DOM 吗

不能。Worker 运行在独立线程中，不能访问 `document` 和页面 DOM。需要把结果发回主线程，由主线程更新 UI。

### Worker 一定会让代码更快吗

不一定。Worker 可以避免阻塞主线程，但创建 Worker、复制数据、线程通信都有成本。小任务放进 Worker 可能反而更慢。

### postMessage 是引用传递吗

默认不是。`postMessage` 使用结构化克隆复制数据。想避免大数据复制，可以使用 Transferable Objects 或 `SharedArrayBuffer`。

### Worker 适合处理网络请求吗

可以，但不一定必要。普通接口请求本身不会阻塞主线程。Worker 更适合请求后还要做大量解析、计算、压缩、解密的场景。

### SharedWorker 和 Service Worker 有什么区别

SharedWorker 用于同源多个页面共享一个后台线程，重点是多页面共享状态或连接。Service Worker 用于拦截请求、缓存资源、PWA 和后台能力，生命周期由浏览器管理。

## 小结

- Web Worker 可以把耗时任务放到后台线程，避免阻塞主线程
- Worker 不能直接操作 DOM，只能通过消息和主线程通信
- `postMessage` 默认使用结构化克隆，大数据传递要考虑 Transferable Objects
- Dedicated Worker 服务单个页面，SharedWorker 可被多个同源页面共享
- Service Worker 主要用于离线缓存、请求拦截和 PWA
- Worker 适合计算密集型任务，不适合非常轻量的逻辑
- 使用 Worker 时要考虑创建成本、通信成本、错误处理、取消和销毁

## 导航

- 返回 [JavaScript 模块](../index.md)
