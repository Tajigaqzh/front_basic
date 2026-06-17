# 10 异步

JavaScript 是单线程语言，同一时间只能执行一段同步代码。异步编程的作用，是把耗时任务交给运行环境处理，等结果准备好之后再回到 JavaScript 主线程执行后续逻辑。

常见异步场景：

- 定时任务：`setTimeout`、`setInterval`
- 网络请求：`fetch`、`XMLHttpRequest`
- 用户交互：点击、输入、滚动
- 文件读写：Node.js 里的文件系统 API
- 消息通信：Web Worker、WebSocket

异步代码不会马上得到结果，而是通过回调函数、Promise、`async / await` 或异步迭代器在未来某个时间点继续执行。

## 1. 使用回调的异步编程

回调函数是最早、最直接的异步写法：把一个函数作为参数传进去，等异步任务完成后再调用它。

```js
function getUser(callback) {
  setTimeout(() => {
    callback({ id: 1, name: 'Tom' })
  }, 1000)
}

getUser((user) => {
  console.log(user.name) // Tom
})
```

这里的执行过程是：

1. 调用 `getUser`
2. 注册一个 1 秒后的定时任务
3. 当前同步代码继续执行
4. 1 秒后调用传入的回调函数

### 错误优先回调

在 Node.js 中，很多传统异步 API 使用“错误优先回调”约定：第一个参数是错误对象，后面的参数才是成功结果。

```js
function readFile(callback) {
  setTimeout(() => {
    const error = null
    const data = 'hello'

    callback(error, data)
  }, 1000)
}

readFile((error, data) => {
  if (error) {
    console.log('读取失败', error)
    return
  }

  console.log(data)
})
```

这种写法的好处是简单，缺点是多层异步任务很容易嵌套过深。

```js
login((loginError, user) => {
  if (loginError) {
    return
  }

  getProfile(user.id, (profileError, profile) => {
    if (profileError) {
      return
    }

    getOrders(profile.id, (ordersError, orders) => {
      if (ordersError) {
        return
      }

      console.log(orders)
    })
  })
})
```

这种层层嵌套通常被称为“回调地狱”。它的问题不只是缩进多，还包括：

- 错误处理分散在每一层
- 异步流程不容易复用
- 串行和并行关系不够清晰
- 后续维护成本较高

Promise 和 `async / await` 就是为了解决这些问题而出现的。

## 2. 定时器

定时器由运行环境提供，浏览器和 Node.js 都支持常见的定时器 API。

### setTimeout

`setTimeout` 用于在指定时间后执行一次回调。

```js
setTimeout(() => {
  console.log('1 秒后执行')
}, 1000)
```

`setTimeout` 的第二个参数表示延迟时间，单位是毫秒。

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

即使延迟时间是 `0`，回调也不会立即插入当前同步代码中执行，而是要等当前调用栈清空后再执行。

### clearTimeout

`setTimeout` 会返回一个定时器标识，可以用 `clearTimeout` 取消它。

```js
const timer = setTimeout(() => {
  console.log('不会执行')
}, 1000)

clearTimeout(timer)
```

### setInterval

`setInterval` 用于按固定间隔重复执行回调。

```js
let count = 0

const timer = setInterval(() => {
  count += 1
  console.log(count)

  if (count === 3) {
    clearInterval(timer)
  }
}, 1000)
```

如果回调执行时间很长，`setInterval` 可能造成任务堆积。需要更精确地控制重复任务时，可以使用递归 `setTimeout`。

```js
function loop() {
  setTimeout(() => {
    console.log('执行一次')
    loop()
  }, 1000)
}

loop()
```

这种方式会等当前任务执行完，再安排下一次任务，更适合处理需要避免重叠执行的场景。

## 3. 事件

事件也是异步编程的重要形式。代码先注册事件监听函数，等事件发生时由运行环境调用监听函数。

```js
const button = document.querySelector('#btn')

button.addEventListener('click', () => {
  console.log('clicked')
})
```

这段代码不会立刻打印 `clicked`，只有用户点击按钮时才会执行回调。

### 事件对象

事件回调会接收一个事件对象，里面包含事件相关信息。

```js
document.addEventListener('click', (event) => {
  console.log(event.target)
  console.log(event.clientX, event.clientY)
})
```

常见事件对象属性：

- `target`：触发事件的元素
- `currentTarget`：当前绑定监听器的元素
- `type`：事件类型
- `clientX / clientY`：鼠标在视口中的坐标
- `key`：键盘按键值

### 移除事件

移除事件监听时，需要传入同一个函数引用。

```js
function handleClick() {
  console.log('clicked')
}

button.addEventListener('click', handleClick)
button.removeEventListener('click', handleClick)
```

下面这种写法无法移除事件，因为两次传入的是不同的函数对象。

```js
button.addEventListener('click', () => {
  console.log('clicked')
})

button.removeEventListener('click', () => {
  console.log('clicked')
})
```

### 事件委托

事件委托是把监听器绑定在父元素上，通过 `event.target` 判断真正触发事件的子元素。

```js
const list = document.querySelector('#list')

list.addEventListener('click', (event) => {
  const item = event.target.closest('li')

  if (!item) {
    return
  }

  console.log(item.dataset.id)
})
```

事件委托适合处理动态列表，因为新添加的子元素不需要重新绑定事件。

## 4. Promise

Promise 是一种表示异步结果的对象。它有三种状态：

- `pending`：进行中
- `fulfilled`：已成功
- `rejected`：已失败

状态只能从 `pending` 变成 `fulfilled` 或 `rejected`，并且一旦改变就不能再变。

```js
const promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('success')
  }, 1000)
})
```

Promise 构造函数接收一个执行器函数，这个执行器会立即同步执行。

```js
console.log('start')

new Promise((resolve) => {
  console.log('executor')
  resolve()
})

console.log('end')

// start
// executor
// end
```

`resolve` 用于把 Promise 变成成功状态，`reject` 用于把 Promise 变成失败状态。

```js
const promise = new Promise((resolve, reject) => {
  const ok = true

  if (ok) {
    resolve('成功结果')
  } else {
    reject(new Error('失败原因'))
  }
})
```

Promise 的核心价值，是把“未来的结果”封装成一个可以继续组合的对象。

## 5. Promise.then

`then` 用于注册成功和失败回调。

```js
promise.then(
  (value) => {
    console.log('成功', value)
  },
  (reason) => {
    console.log('失败', reason)
  }
)
```

第一个函数处理成功结果，第二个函数处理失败原因。

### 链式调用

`then` 会返回一个新的 Promise，所以可以继续链式调用。

```js
Promise.resolve(1)
  .then((value) => {
    return value + 1
  })
  .then((value) => {
    return value + 1
  })
  .then((value) => {
    console.log(value) // 3
  })
```

每个 `then` 的返回值会传给下一个 `then`。

```js
Promise.resolve('user')
  .then((value) => {
    return `${value}:profile`
  })
  .then((value) => {
    console.log(value) // user:profile
  })
```

如果 `then` 返回的是一个新的 Promise，后面的 `then` 会等待它完成。

```js
function delay(value, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value)
    }, ms)
  })
}

delay(1, 1000)
  .then((value) => {
    return delay(value + 1, 1000)
  })
  .then((value) => {
    console.log(value) // 2
  })
```

### catch

`catch` 用于捕获 Promise 链中的错误。

```js
Promise.resolve()
  .then(() => {
    throw new Error('出错了')
  })
  .catch((error) => {
    console.log(error.message)
  })
```

下面两种写法基本等价：

```js
promise.catch((error) => {
  console.log(error)
})

promise.then(undefined, (error) => {
  console.log(error)
})
```

### finally

`finally` 不关心成功或失败，通常用于清理资源、关闭 loading。

```js
request()
  .then((data) => {
    console.log(data)
  })
  .catch((error) => {
    console.log(error)
  })
  .finally(() => {
    console.log('结束 loading')
  })
```

## 6. all、allSettled、race

Promise 提供了一些静态方法，用来组合多个异步任务。

### Promise.all

`Promise.all` 接收一个可迭代对象，等待所有 Promise 都成功后返回结果数组。

```js
Promise.all([
  Promise.resolve('user'),
  Promise.resolve('profile'),
  Promise.resolve('orders')
]).then((result) => {
  console.log(result) // ['user', 'profile', 'orders']
})
```

特点：

- 所有任务都成功，整体才成功
- 结果顺序和传入顺序一致
- 任意一个任务失败，整体立即失败

```js
Promise.all([
  Promise.resolve(1),
  Promise.reject(new Error('fail')),
  Promise.resolve(3)
]).catch((error) => {
  console.log(error.message) // fail
})
```

`Promise.all` 适合“多个任务都必须成功”的场景，例如页面初始化时同时请求用户信息、权限信息和配置。

### Promise.allSettled

`Promise.allSettled` 会等待所有 Promise 都落定，不管成功还是失败。

```js
Promise.allSettled([
  Promise.resolve('success'),
  Promise.reject(new Error('fail'))
]).then((result) => {
  console.log(result)
})
```

结果数组中的每一项都有状态信息。

```js
[
  { status: 'fulfilled', value: 'success' },
  { status: 'rejected', reason: Error('fail') }
]
```

`Promise.allSettled` 适合“每个任务都要拿到最终结果”的场景，例如批量上传、批量删除、批量请求。

### Promise.race

`Promise.race` 会返回最先落定的那个 Promise 的结果。

```js
const request = fetch('/api/user')

const timeout = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error('请求超时'))
  }, 3000)
})

Promise.race([request, timeout])
  .then((response) => {
    console.log(response)
  })
  .catch((error) => {
    console.log(error.message)
  })
```

`race` 常用于超时控制、取最快响应等场景。

## 7. 串行期约

期约是 Promise 的中文译名。串行期约指多个 Promise 按顺序执行：前一个完成后，再开始下一个。

### 手动串行

```js
function task(name, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(name)
      resolve(name)
    }, ms)
  })
}

task('A', 1000)
  .then(() => task('B', 1000))
  .then(() => task('C', 1000))
```

这种写法适合任务数量固定的场景。

### 使用 reduce 串行

当任务数量来自数组时，可以用 `reduce` 把它们串起来。

```js
const tasks = [
  () => task('A', 1000),
  () => task('B', 1000),
  () => task('C', 1000)
]

tasks.reduce((promise, currentTask) => {
  return promise.then(() => currentTask())
}, Promise.resolve())
```

注意数组里存的是函数，而不是已经创建好的 Promise。

```js
const tasks = [
  task('A', 1000),
  task('B', 1000),
  task('C', 1000)
]
```

上面这种写法会立即启动三个任务，不能实现真正的串行。

### 串行收集结果

```js
const tasks = [
  () => task('A', 1000),
  () => task('B', 1000),
  () => task('C', 1000)
]

tasks
  .reduce((promise, currentTask) => {
    return promise.then((result) => {
      return currentTask().then((value) => {
        result.push(value)
        return result
      })
    })
  }, Promise.resolve([]))
  .then((result) => {
    console.log(result) // ['A', 'B', 'C']
  })
```

串行适合任务之间存在依赖，或者需要控制请求压力的场景。如果任务互不依赖，通常可以用 `Promise.all` 并行处理。

## 8. async 和 await

`async / await` 是 Promise 的语法糖，用同步代码的写法组织异步流程。

```js
async function getData() {
  const user = await getUser()
  const orders = await getOrders(user.id)

  return orders
}
```

`async` 函数一定返回 Promise。

```js
async function fn() {
  return 1
}

fn().then((value) => {
  console.log(value) // 1
})
```

如果 `async` 函数内部抛出错误，返回的 Promise 会变成 rejected。

```js
async function fn() {
  throw new Error('fail')
}

fn().catch((error) => {
  console.log(error.message) // fail
})
```

### await

`await` 会等待右侧 Promise 落定，并拿到成功结果。

```js
async function main() {
  const value = await Promise.resolve('hello')

  console.log(value)
}

main()
```

如果右侧不是 Promise，`await` 会把它包装成一个已成功的 Promise。

```js
async function main() {
  const value = await 123

  console.log(value) // 123
}
```

### 错误处理

`await` 后面的 Promise 如果失败，可以用 `try...catch` 捕获。

```js
async function main() {
  try {
    const data = await request()
    console.log(data)
  } catch (error) {
    console.log('请求失败', error)
  } finally {
    console.log('结束 loading')
  }
}
```

### 串行和并行

下面是串行执行，第二个请求会等第一个请求完成后才开始。

```js
async function main() {
  const user = await getUser()
  const orders = await getOrders()

  return { user, orders }
}
```

如果两个任务没有依赖关系，可以先同时启动，再一起等待。

```js
async function main() {
  const userPromise = getUser()
  const ordersPromise = getOrders()

  const user = await userPromise
  const orders = await ordersPromise

  return { user, orders }
}
```

也可以直接使用 `Promise.all`。

```js
async function main() {
  const [user, orders] = await Promise.all([
    getUser(),
    getOrders()
  ])

  return { user, orders }
}
```

`async / await` 让异步流程更容易阅读，但它没有改变 Promise 的本质。

## 9. 异步迭代器

普通迭代器使用 `Symbol.iterator`，配合 `for...of` 消费同步数据。

```js
const list = [1, 2, 3]

for (const item of list) {
  console.log(item)
}
```

异步迭代器使用 `Symbol.asyncIterator`，配合 `for await...of` 消费异步数据。

```js
const asyncIterable = {
  [Symbol.asyncIterator]() {
    let i = 0

    return {
      async next() {
        i += 1

        if (i > 3) {
          return { done: true }
        }

        return { value: i, done: false }
      }
    }
  }
}

async function main() {
  for await (const item of asyncIterable) {
    console.log(item)
  }
}

main()
```

异步迭代器的 `next` 方法返回 Promise，Promise 成功后得到 `{ value, done }`。

### 异步生成器

异步生成器函数用 `async function*` 定义，它会自动创建异步迭代器。

```js
async function* createAsyncNumbers() {
  yield 1
  yield 2
  yield 3
}

async function main() {
  for await (const item of createAsyncNumbers()) {
    console.log(item)
  }
}

main()
```

可以在异步生成器中使用 `await`。

```js
function delay(value, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value)
    }, ms)
  })
}

async function* createAsyncNumbers() {
  yield await delay(1, 1000)
  yield await delay(2, 1000)
  yield await delay(3, 1000)
}
```

### 常见使用场景

异步迭代器适合处理“数据分批到达”的场景：

- 分页接口逐页请求
- 文件流逐块读取
- 网络流逐段接收
- 服务端推送消息

示例：按页拉取数据。

```js
async function fetchPage(page) {
  const response = await fetch(`/api/list?page=${page}`)

  return response.json()
}

async function* fetchAllPages() {
  let page = 1

  while (true) {
    const result = await fetchPage(page)

    if (result.list.length === 0) {
      return
    }

    yield result.list
    page += 1
  }
}

async function main() {
  for await (const list of fetchAllPages()) {
    console.log(list)
  }
}
```

`for await...of` 会等每一次异步结果完成后，再进入下一轮循环。

## 10. script 标签的 async 和 defer

浏览器解析 HTML 时，如果遇到普通 `<script>`，会暂停 HTML 解析，先下载并执行脚本，脚本执行完之后再继续解析页面。

```html
<script src="./main.js"></script>
```

普通脚本的执行流程：

1. 暂停 HTML 解析
2. 下载脚本
3. 执行脚本
4. 继续解析 HTML

如果脚本体积较大，或者网络较慢，就会阻塞页面渲染。`async` 和 `defer` 都是为了解决外部脚本阻塞 HTML 解析的问题。

### defer

`defer` 表示延迟执行脚本。

```html
<script defer src="./main.js"></script>
```

特点：

- 下载脚本时不阻塞 HTML 解析
- 脚本会等 HTML 解析完成后再执行
- 多个 `defer` 脚本会按照它们在 HTML 中出现的顺序执行
- `defer` 脚本会在 `DOMContentLoaded` 事件触发前执行完

```html
<script defer src="./a.js"></script>
<script defer src="./b.js"></script>
```

上面两个脚本会并行下载，但执行顺序仍然是：

1. `a.js`
2. `b.js`

`defer` 适合页面主逻辑脚本，例如依赖 DOM 结构、需要稳定执行顺序的业务代码。

### async

`async` 表示异步下载、下载完成后立即执行。

```html
<script async src="./analytics.js"></script>
```

特点：

- 下载脚本时不阻塞 HTML 解析
- 脚本下载完成后会立即执行
- 执行脚本时会暂停 HTML 解析
- 多个 `async` 脚本的执行顺序不确定，谁先下载完谁先执行
- `async` 脚本不保证在 `DOMContentLoaded` 前或后执行

```html
<script async src="./a.js"></script>
<script async src="./b.js"></script>
```

上面两个脚本的执行顺序不固定，可能是 `a.js` 先执行，也可能是 `b.js` 先执行。

`async` 适合独立脚本，例如埋点、广告、第三方统计 SDK。这类脚本通常不依赖页面 DOM，也不依赖其他业务脚本的执行顺序。

### async 和 defer 对比

| 写法 | 下载是否阻塞 HTML 解析 | 执行时机 | 是否保证顺序 | 典型场景 |
| --- | --- | --- | --- | --- |
| 普通 `<script>` | 阻塞 | 下载完成后立即执行 | 保证 | 少量必须立即执行的脚本 |
| `<script defer>` | 不阻塞 | HTML 解析完成后执行 | 保证 | 页面主业务脚本 |
| `<script async>` | 不阻塞 | 下载完成后立即执行 | 不保证 | 独立第三方脚本 |

执行时机可以简单理解为：

```txt
普通 script：HTML 解析 -> 暂停 -> 下载 -> 执行 -> 继续解析
defer：HTML 解析和脚本下载并行 -> HTML 解析完成 -> 按顺序执行脚本 -> DOMContentLoaded
async：HTML 解析和脚本下载并行 -> 下载完成 -> 暂停解析并立即执行 -> 继续解析
```

### DOMContentLoaded 的影响

`DOMContentLoaded` 表示 HTML 已经解析完成，不等待图片、样式表等资源全部加载完成。

```js
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready')
})
```

`defer` 脚本会在 `DOMContentLoaded` 之前执行完，所以页面主脚本使用 `defer` 时，通常可以直接读取页面上的 DOM。

```html
<button id="btn">提交</button>
<script defer src="./main.js"></script>
```

```js
const button = document.querySelector('#btn')

button.addEventListener('click', () => {
  console.log('submit')
})
```

`async` 脚本执行时，HTML 可能还没有解析完成。如果脚本依赖后面的 DOM 节点，就可能拿到 `null`。

```html
<script async src="./main.js"></script>
<button id="btn">提交</button>
```

```js
const button = document.querySelector('#btn')

console.log(button) // 可能是 null
```

### 和 async 函数的区别

`<script async>` 里的 `async` 是 HTML 属性，控制外部脚本的下载和执行时机。

`async function` 里的 `async` 是 JavaScript 语法，表示函数返回 Promise，并允许函数内部使用 `await`。

```html
<script async src="./main.js"></script>
```

```js
async function main() {
  const data = await request()

  return data
}
```

这两个 `async` 名字相同，但属于完全不同的机制。

### 使用建议

- 页面主业务脚本优先使用 `defer`
- 独立第三方脚本可以使用 `async`
- 有依赖顺序的脚本不要使用 `async`
- 需要操作 DOM 的脚本不要随意放在 `<head>` 中直接同步执行
- 如果使用打包工具生成入口脚本，通常可以让入口脚本带上 `defer`

### type="module"

模块脚本默认具有类似 `defer` 的行为。

```html
<script type="module" src="./main.js"></script>
```

特点：

- 默认不阻塞 HTML 解析
- 会等 HTML 解析完成后执行
- 可以使用 `import` 和 `export`
- 默认运行在严格模式下

如果给模块脚本加上 `async`，它会变成下载完成后尽快执行，不再等待 HTML 解析完成。

```html
<script type="module" async src="./main.js"></script>
```

## 11. 首页加载时长优化

首页加载优化的目标不是单纯让所有资源下载更快，而是让用户更早看到可用内容、更早完成关键交互。

常见关注指标：

- `FCP`：First Contentful Paint，首次内容绘制
- `LCP`：Largest Contentful Paint，最大内容绘制
- `TTI`：Time to Interactive，页面可交互时间
- `TBT`：Total Blocking Time，总阻塞时间
- `CLS`：Cumulative Layout Shift，累计布局偏移

其中首页体验通常重点关注：

- 首屏内容多久出现
- 最大图片或标题多久渲染出来
- 主线程是否被大段 JavaScript 阻塞
- 用户点击、输入是否能及时响应

### 资源加载顺序

浏览器加载首页大致经历这些阶段：

1. 请求 HTML
2. 解析 HTML，发现 CSS、JS、图片等资源
3. 下载 CSS 并构建 CSSOM
4. 下载并执行 JavaScript
5. 构建 DOM 和渲染树
6. 布局、绘制、合成

首页慢，通常不是某一个点的问题，而是关键资源链路过长：

```txt
HTML -> CSS -> JS -> 接口 -> 图片 -> 首屏渲染
```

优化时要优先缩短首屏必须依赖的链路。

### 减少首屏 JavaScript 体积

JavaScript 会影响首页加载的多个阶段：

- 下载 JS 需要网络时间
- 解析 JS 需要 CPU 时间
- 执行 JS 可能阻塞主线程
- 框架初始化和组件渲染也需要时间

常见做法：

- 路由级代码分割
- 首屏不用的组件延迟加载
- 移除未使用依赖
- 避免把大型库打进首页包
- 用更轻量的替代库

示例：路由懒加载。

```js
const UserPage = () => import('./pages/UserPage.js')
const OrderPage = () => import('./pages/OrderPage.js')
```

示例：按需加载大型功能。

```js
async function openEditor() {
  const { createEditor } = await import('./editor.js')

  createEditor()
}
```

不要为了首页初始化提前加载所有页面、所有弹窗、所有图表库。首屏只加载首屏真正需要的代码。

### 使用 defer、module 和动态 import

入口脚本优先使用 `defer` 或 `type="module"`，避免阻塞 HTML 解析。

```html
<script defer src="./main.js"></script>
```

模块脚本默认具备类似 `defer` 的效果：

```html
<script type="module" src="./main.js"></script>
```

非首屏逻辑可以放到动态导入里：

```js
button.addEventListener('click', async () => {
  const { showDialog } = await import('./dialog.js')

  showDialog()
})
```

这种方式可以减少首页初始包体积，但也要避免把用户马上会用到的关键功能切得过碎，否则会增加额外请求和交互等待。

### 优化 CSS

CSS 会阻塞渲染。浏览器需要先构建 CSSOM，才能完成页面渲染。

常见做法：

- 删除未使用 CSS
- 避免加载整套组件库样式
- 提取首屏关键 CSS
- 非关键 CSS 延迟加载
- 避免过深、过复杂的选择器

示例：延迟加载非关键 CSS。

```html
<link rel="preload" href="./extra.css" as="style" onload="this.rel='stylesheet'">
```

关键 CSS 可以直接内联在 HTML 中，减少一次额外请求。

```html
<style>
  .page-title {
    font-size: 24px;
    font-weight: 600;
  }
</style>
```

内联关键 CSS 要控制体积，只放首屏必要样式，不要把整站样式全部内联。

### 优化图片

图片通常是首页最大的资源之一，特别容易影响 LCP。

常见做法：

- 使用合适尺寸，不要用大图强行缩小
- 使用 WebP、AVIF 等更高压缩率格式
- 为图片设置 `width` 和 `height`，避免布局偏移
- 首屏关键图优先加载
- 非首屏图片懒加载

```html
<img
  src="./banner.webp"
  width="1200"
  height="480"
  fetchpriority="high"
  alt="首页横幅"
>
```

非首屏图片使用懒加载：

```html
<img
  src="./product.webp"
  width="300"
  height="200"
  loading="lazy"
  alt="商品图"
>
```

如果 LCP 元素是首屏大图，不要给它设置 `loading="lazy"`，否则可能推迟最大内容绘制。

### 预加载关键资源

对首屏强依赖资源，可以使用 `preload` 提前告诉浏览器优先下载。

```html
<link rel="preload" href="./main.css" as="style">
<link rel="preload" href="./banner.webp" as="image">
```

如果马上要访问第三方域名，可以使用 `preconnect` 提前建立连接。

```html
<link rel="preconnect" href="https://cdn.example.com">
```

使用建议：

- 只预加载首屏关键资源
- 不要对大量资源滥用 `preload`
- 预加载字体时要加正确的 `as` 和 `crossorigin`

```html
<link
  rel="preload"
  href="./font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

### 接口请求优化

首页接口慢，也会拖慢首屏可用时间。

常见做法：

- 合并首屏强依赖接口
- 并行请求互不依赖的数据
- 缓存不经常变化的数据
- 延迟请求非首屏数据
- 给接口设置超时和降级展示
- 服务端直接下发首屏必要数据

串行请求会拉长首页耗时：

```js
async function initPage() {
  const user = await getUser()
  const config = await getConfig()
  const list = await getList()

  return { user, config, list }
}
```

如果三者没有依赖关系，应该并行：

```js
async function initPage() {
  const [user, config, list] = await Promise.all([
    getUser(),
    getConfig(),
    getList()
  ])

  return { user, config, list }
}
```

非首屏数据可以延后请求：

```js
async function initPage() {
  const aboveFoldData = await getAboveFoldData()

  renderAboveFold(aboveFoldData)

  requestIdleCallback(() => {
    getBelowFoldData().then(renderBelowFold)
  })
}
```

如果需要兼容不支持 `requestIdleCallback` 的环境，可以封装降级：

```js
const runWhenIdle = window.requestIdleCallback || ((callback) => {
  return setTimeout(callback, 1)
})
```

### 缓存策略

静态资源应该充分利用 HTTP 缓存。

常见策略：

- HTML 不使用强缓存，保证能拿到最新入口
- 带 hash 的 JS、CSS、图片使用长期强缓存
- 接口数据按业务特点设置缓存
- CDN 缓存公共静态资源

示例：

```txt
index.html：Cache-Control: no-cache
main.a1b2c3.js：Cache-Control: max-age=31536000, immutable
style.a1b2c3.css：Cache-Control: max-age=31536000, immutable
```

文件名带内容 hash 时，内容变化会生成新文件名，所以可以放心设置长期缓存。

### 服务端渲染和静态化

如果首页依赖大量 JavaScript 才能渲染内容，用户可能要等 JS 下载、解析、执行完之后才能看到页面。

可以考虑：

- SSR：服务端渲染首屏 HTML
- SSG：构建时生成静态 HTML
- 骨架屏：先展示稳定占位结构
- 流式渲染：服务端分段输出 HTML

适用场景：

- 内容型页面适合 SSG
- 首屏强 SEO 或弱网体验要求高的页面适合 SSR
- 后台管理系统通常优先做代码分割、缓存和接口优化

SSR 不是万能优化。它能让首屏内容更早出现，但仍然需要处理客户端激活、接口缓存和服务端压力。

### 减少主线程阻塞

首页加载后如果主线程长时间执行 JavaScript，用户即使看到了页面，也可能点不动。

常见做法：

- 拆分长任务
- 避免首页执行大量同步计算
- 大计算放到 Web Worker
- 列表渲染使用分页或虚拟列表
- 避免一次性渲染大量 DOM 节点

示例：把长任务切成小块。

```js
function runTasks(tasks) {
  const task = tasks.shift()

  if (task) {
    task()
    setTimeout(() => runTasks(tasks), 0)
  }
}
```

这样可以让浏览器在任务之间有机会处理用户输入和渲染。

### 第三方脚本治理

第三方脚本经常是首页变慢的重要来源，例如统计、客服、广告、监控 SDK。

治理方式：

- 只加载必要 SDK
- 使用 `async` 加载独立第三方脚本
- 非首屏需要的 SDK 延迟加载
- 对第三方脚本设置超时和降级
- 定期检查第三方脚本体积和耗时

```html
<script async src="https://example.com/analytics.js"></script>
```

不要让第三方脚本阻塞页面主流程，也不要把多个无关 SDK 都放进首页同步初始化。

### 字体优化

Web Font 可能导致文字迟迟不显示，或者字体切换时发生布局抖动。

常见做法：

- 使用 `font-display: swap`
- 只加载需要的字重
- 使用 WOFF2 格式
- 预加载首屏关键字体
- 中文字体尽量谨慎使用全量 Web Font

```css
@font-face {
  font-family: "AppFont";
  src: url("./font.woff2") format("woff2");
  font-display: swap;
}
```

### 构建产物优化

构建阶段可以直接影响首页资源体积。

常见检查项：

- 开启压缩和 tree shaking
- 使用 gzip 或 brotli
- 分析包体积，找出大依赖
- 公共依赖合理拆包
- 现代浏览器使用更现代的构建目标
- 删除 source map 的线上公开访问，或仅在内部错误平台使用

可以用包分析工具查看首页入口包含了哪些模块，重点检查：

- 是否引入了完整组件库
- 是否引入了完整图标库
- 是否把非首屏编辑器、图表、富文本打进首页
- 是否存在重复依赖

### 排查步骤

排查首页加载慢时，可以按这个顺序看：

1. 看 Network：HTML、CSS、JS、图片、接口哪个最慢
2. 看 Coverage：首屏 JS 和 CSS 有多少未使用代码
3. 看 Performance：主线程是否有长任务
4. 看 Lighthouse：LCP、TBT、CLS 主要问题是什么
5. 看包分析：首页入口是否包含大依赖
6. 看接口瀑布流：是否存在不必要的串行请求

优化优先级通常是：

1. 先处理阻塞首屏的关键资源
2. 再减少首页 JS 体积和执行时间
3. 再优化图片、字体、缓存
4. 最后治理非关键资源和第三方脚本

### 常见方案总结

| 问题 | 优化方向 |
| --- | --- |
| JS 包过大 | 代码分割、动态导入、移除大依赖 |
| CSS 阻塞渲染 | 提取关键 CSS、删除未使用 CSS |
| 首屏图片慢 | 压缩图片、设置尺寸、预加载 LCP 图片 |
| 接口串行 | 使用 `Promise.all` 并行请求 |
| 主线程阻塞 | 拆分长任务、使用 Web Worker |
| 第三方脚本慢 | `async` 加载、延迟初始化、移除非必要 SDK |
| 缓存命中低 | 静态资源 hash 文件名加长期缓存 |
| 首屏白屏久 | SSR、SSG、骨架屏、减少入口 JS |

## 当前文档

- [手写 Promise](./promise-impl.md)

## 小结

- 回调函数是最基础的异步组织方式，但复杂流程容易嵌套过深
- 定时器和事件都是运行环境提供的异步能力
- Promise 把异步结果封装成对象，解决了链式调用和组合问题
- `Promise.all` 适合全部成功，`Promise.allSettled` 适合收集全部结果，`Promise.race` 适合竞争最快结果
- 串行期约要保存“任务函数”，不要提前创建所有 Promise
- `async / await` 是 Promise 的语法糖，让异步代码更接近同步写法
- 异步迭代器适合处理流式、分页、分批到达的数据
- `defer` 适合页面主脚本，`async` 适合不依赖执行顺序的独立脚本
- 首页加载优化要优先缩短关键资源链路，减少首屏 JS、CSS、图片、接口和主线程阻塞

## 导航

- 返回 [JavaScript 模块](../index.md)
