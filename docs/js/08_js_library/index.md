# 08 库与常用内建工具

这一章整理 JavaScript 中常见的内建工具、Web API 和通用工具函数设计思路。

这里的“库”不只指第三方 npm 包，也包括语言和浏览器已经提供的基础能力，例如 `Set`、`Map`、`RegExp`、`Date`、`URL`、定时器、二进制数据处理等。掌握这些能力后，再选择 Lodash、Day.js、Axios 这类第三方库时会更清楚它们解决了什么问题。

## 学习目标

- 理解常见内建对象的适用场景
- 能用 `Set`、`Map` 解决去重、映射、缓存等问题
- 理解 `WeakMap`、`WeakSet` 和垃圾回收之间的关系
- 掌握 `Date`、时间戳、高精度时间和定时器的基本用法
- 熟悉 `RegExp`、`URL`、`URLSearchParams` 等常用 API
- 了解 `ArrayBuffer`、TypedArray、`DataView` 的定位
- 能设计可复用、低副作用、易测试的工具函数
- 能对常见第三方库做基本选型

## 常见工具库

第三方库通常不是“必须用”，而是在代码复杂度、兼容性、可维护性之间做取舍。

### 工具函数库

常见代表：

- `lodash`
- `underscore`
- `radash`

适合场景：

- 对数组、对象、集合做复杂处理
- 需要稳定的深拷贝、节流、防抖、分组、排序等工具
- 项目历史包袱较多，需要统一工具函数风格

现代 JavaScript 已经补齐很多能力，例如 `map`、`filter`、`reduce`、`Object.entries`、`Object.fromEntries`、`structuredClone` 等。简单场景优先使用标准 API，复杂场景再引入工具库。

```js
const users = [
  { id: 1, role: 'admin' },
  { id: 2, role: 'user' },
  { id: 3, role: 'admin' }
]

const groupByRole = users.reduce((result, user) => {
  const list = result[user.role] ?? []
  return {
    ...result,
    [user.role]: [...list, user]
  }
}, {})
```

### 日期库

常见代表：

- `dayjs`
- `date-fns`
- `luxon`

适合场景：

- 日期格式化
- 日期加减
- 相对时间
- 时区处理
- 国际化展示

如果只是拿当前时间戳、比较两个时间点，原生 `Date` 通常足够。如果涉及复杂格式、时区和国际化，建议使用成熟日期库。

### 请求库

常见代表：

- `fetch`
- `axios`
- `ky`

`fetch` 是浏览器内建 API，适合现代项目。`axios` 在拦截器、超时、请求取消、响应转换等方面封装更完整。

```js
async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}
```

请求封装要避免过度设计。建议先统一这几件事：

- 基础地址
- 请求头
- 参数序列化
- 错误处理
- 登录失效处理
- 超时和取消
- 响应数据格式

## Set

`Set` 用来保存不重复的值。它的核心特点是“唯一性”。

```js
const set = new Set()

set.add(1)
set.add(1)
set.add(2)

set.size // 2
set.has(1) // true
```

### 数组去重

```js
const nums = [1, 2, 2, 3, 3, 3]
const uniqueNums = [...new Set(nums)]

uniqueNums // [1, 2, 3]
```

`Set` 判断唯一性使用 SameValueZero 规则：

```js
const set = new Set()

set.add(NaN)
set.add(NaN)

set.size // 1
```

对象是否重复看引用地址，不看内容：

```js
const a = { id: 1 }
const b = { id: 1 }

new Set([a, b]).size // 2
```

### 常见集合运算

```js
const a = new Set([1, 2, 3])
const b = new Set([3, 4, 5])

const union = new Set([...a, ...b])
const intersection = new Set([...a].filter((item) => b.has(item)))
const difference = new Set([...a].filter((item) => !b.has(item)))
```

## Map

`Map` 用来保存键值对。相比普通对象，`Map` 的键可以是任意类型。

```js
const map = new Map()
const user = { id: 1 }

map.set(user, 'Tom')
map.get(user) // Tom
map.has(user) // true
```

### Map 和 Object 的区别

| 对比项 | Object | Map |
| --- | --- | --- |
| 键类型 | 通常是字符串或 Symbol | 任意类型 |
| 是否有原型属性 | 有 | 无业务无关默认键 |
| 数量获取 | `Object.keys(obj).length` | `map.size` |
| 迭代顺序 | 有规则但更复杂 | 按插入顺序 |
| 使用场景 | 描述结构化对象 | 做映射表、缓存、字典 |

如果数据本质是一个实体，例如用户、订单、配置项，优先用对象。如果数据本质是映射关系，例如“DOM 节点到状态”、“用户 id 到用户信息”，优先用 `Map`。

```js
const userMap = new Map()

for (const user of users) {
  userMap.set(user.id, user)
}

const target = userMap.get(1001)
```

### Map 转换

```js
const map = new Map([
  ['name', 'Tom'],
  ['age', 18]
])

const obj = Object.fromEntries(map)
const entries = Object.entries(obj)
const newMap = new Map(entries)
```

## WeakMap

`WeakMap` 的键必须是对象，并且不会阻止键对象被垃圾回收。

```js
const weakMap = new WeakMap()
const user = { id: 1 }

weakMap.set(user, { score: 100 })
weakMap.get(user) // { score: 100 }
```

`WeakMap` 适合保存“和对象绑定的附加信息”，尤其是外部不应该直接访问的数据。

```js
const privateData = new WeakMap()

class Counter {
  constructor() {
    privateData.set(this, { count: 0 })
  }

  increment() {
    const data = privateData.get(this)
    data.count += 1
  }

  getValue() {
    return privateData.get(this).count
  }
}
```

注意点：

- `WeakMap` 不能遍历
- 没有 `size`
- 键必须是对象
- 常用于私有数据、缓存元信息、DOM 关联状态

不能遍历是设计上的限制，因为键对象随时可能被垃圾回收。

## WeakSet

`WeakSet` 只能保存对象引用，也不会阻止对象被垃圾回收。

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

适合场景：

- 标记对象是否被处理过
- 避免递归遍历中的循环引用
- 不需要枚举集合内容，只关心对象是否出现过

## TypedArray、ArrayBuffer 和 DataView

普通数组适合保存业务数据。二进制 API 适合处理文件、图片、音频、视频、网络协议和 WebAssembly 数据。

### ArrayBuffer

`ArrayBuffer` 表示一段固定长度的原始二进制内存。

```js
const buffer = new ArrayBuffer(8)

buffer.byteLength // 8
```

`ArrayBuffer` 本身不能直接读写，需要通过视图操作。

### TypedArray

TypedArray 是一组类型化数组视图，例如：

- `Int8Array`
- `Uint8Array`
- `Uint8ClampedArray`
- `Int16Array`
- `Uint16Array`
- `Int32Array`
- `Uint32Array`
- `Float32Array`
- `Float64Array`
- `BigInt64Array`
- `BigUint64Array`

```js
const buffer = new ArrayBuffer(4)
const view = new Uint8Array(buffer)

view[0] = 255
view[1] = 16

view // Uint8Array [255, 16, 0, 0]
```

TypedArray 的特点：

- 长度固定
- 元素类型固定
- 读写性能稳定
- 适合处理连续二进制数据

### DataView

`DataView` 可以用不同类型、不同字节序读写同一段 `ArrayBuffer`。

```js
const buffer = new ArrayBuffer(4)
const view = new DataView(buffer)

view.setUint16(0, 256, false) // false 表示大端序
view.getUint16(0, false) // 256
```

如果需要按协议解析二进制数据，`DataView` 比 TypedArray 更灵活。

## RegExp 正则表达式

正则表达式用于匹配字符串模式，常见于表单校验、字符串提取、替换和分割。

```js
const pattern = /\d+/g
const text = 'a1 b22 c333'

text.match(pattern) // ['1', '22', '333']
```

### 创建方式

```js
const reg1 = /\d+/
const reg2 = new RegExp('\\d+')
```

字面量写法更简洁。构造函数适合动态拼接规则。

```js
function createKeywordRegExp(keyword) {
  return new RegExp(keyword, 'g')
}
```

动态创建正则时要注意转义用户输入：

```js
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createSafeKeywordRegExp(keyword) {
  return new RegExp(escapeRegExp(keyword), 'g')
}
```

### 常用方法

```js
/\d+/.test('abc123') // true
'abc123'.match(/\d+/) // ['123']
'abc123'.replace(/\d+/, '456') // abc456
'a,b,c'.split(/,/) // ['a', 'b', 'c']
```

### 捕获组

```js
const result = '2026-06-15'.match(/(\d{4})-(\d{2})-(\d{2})/)

result[1] // 2026
result[2] // 06
result[3] // 15
```

命名捕获组让含义更清楚：

```js
const result = '2026-06-15'.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/)

result.groups.year // 2026
result.groups.month // 06
result.groups.day // 15
```

## Date、日期和时间

`Date` 表示某一个时间点，内部本质是从 `1970-01-01T00:00:00.000Z` 到该时间点的毫秒数。

```js
const now = new Date()

now.getTime() // 毫秒时间戳
Date.now() // 当前毫秒时间戳
```

### 创建日期

```js
new Date()
new Date(1718424000000)
new Date('2026-06-15T10:00:00+08:00')
new Date(2026, 5, 15, 10, 0, 0)
```

注意：月份从 `0` 开始，所以 `5` 表示 6 月。

```js
new Date(2026, 0, 1) // 2026 年 1 月 1 日
```

### 时间戳

时间戳常见单位有两种：

- 秒：常见于后端接口、Unix 时间戳
- 毫秒：JavaScript `Date` 使用的单位

```js
const ms = Date.now()
const seconds = Math.floor(ms / 1000)
const date = new Date(seconds * 1000)
```

接口联调时要确认单位，否则很容易出现时间偏移。

### 格式化

简单展示可以使用 `Intl.DateTimeFormat`：

```js
const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

formatter.format(new Date())
```

如果要大量格式化、处理相对时间、时区转换，建议使用日期库。

## 高精度时间

`Date.now()` 适合记录业务时间，但它可能受系统时间调整影响，精度也不适合性能测量。

性能统计优先使用 `performance.now()`：

```js
const start = performance.now()

// do something

const end = performance.now()
console.log(`cost: ${end - start}ms`)
```

`performance.now()` 的特点：

- 返回毫秒，包含小数
- 相对当前页面生命周期
- 单调递增，更适合测量耗时

## URL API

`URL` 用于解析和拼接地址，比手写字符串更稳定。

```js
const url = new URL('https://example.com/users?page=1&size=20')

url.protocol // https:
url.host // example.com
url.pathname // /users
url.searchParams.get('page') // 1
```

### URLSearchParams

`URLSearchParams` 用来处理查询参数。

```js
const params = new URLSearchParams()

params.set('page', '1')
params.set('size', '20')
params.append('tag', 'js')
params.append('tag', 'web')

params.toString() // page=1&size=20&tag=js&tag=web
params.get('page') // 1
params.getAll('tag') // ['js', 'web']
```

封装 GET 请求参数时可以这样写：

```js
function withQuery(url, query = {}) {
  const target = new URL(url, window.location.origin)

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    target.searchParams.set(key, String(value))
  })

  return target.toString()
}
```

## 定时器

JavaScript 常见定时器包括：

- `setTimeout`
- `setInterval`
- `requestAnimationFrame`
- `queueMicrotask`

### setTimeout

`setTimeout` 在指定延迟后把回调放入任务队列，不保证精确准时执行。

```js
const timer = setTimeout(() => {
  console.log('run')
}, 1000)

clearTimeout(timer)
```

### setInterval

`setInterval` 会按固定间隔重复触发。

```js
const timer = setInterval(() => {
  console.log('tick')
}, 1000)

clearInterval(timer)
```

如果回调耗时较长，`setInterval` 可能出现任务堆积。对精度和控制要求更高时，可以使用递归 `setTimeout`：

```js
function startPolling(callback, delay) {
  let timer = null
  let stopped = false

  async function run() {
    if (stopped) return

    await callback()

    if (!stopped) {
      timer = setTimeout(run, delay)
    }
  }

  timer = setTimeout(run, delay)

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
```

### requestAnimationFrame

动画和视觉更新优先使用 `requestAnimationFrame`。它会在浏览器下一次重绘前执行回调。

```js
function animate() {
  // update style or canvas
  requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
```

### queueMicrotask

`queueMicrotask` 用于把回调放入微任务队列。

```js
queueMicrotask(() => {
  console.log('microtask')
})
```

它适合把逻辑推迟到当前同步代码之后、下一轮宏任务之前执行。不要在微任务里递归创建大量微任务，否则会阻塞页面渲染。

## 常见工具函数设计

工具函数应该尽量保持小、纯、可组合、可测试。

### 判断类型

```js
function getType(value) {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase()
}

getType([]) // array
getType(null) // null
getType(new Date()) // date
```

### 防抖 debounce

防抖适合“停止触发一段时间后再执行”，常见于搜索框输入、窗口尺寸变化。

```js
function debounce(fn, delay = 300) {
  let timer = null

  return function debounced(...args) {
    clearTimeout(timer)

    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}
```

### 节流 throttle

节流适合“固定时间内最多执行一次”，常见于滚动、拖拽、频繁点击。

```js
function throttle(fn, delay = 300) {
  let lastTime = 0

  return function throttled(...args) {
    const now = Date.now()

    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}
```

### 深拷贝

现代浏览器和 Node.js 可以优先考虑 `structuredClone`：

```js
const cloned = structuredClone({
  name: 'Tom',
  list: [1, 2, 3]
})
```

`structuredClone` 支持大多数结构化数据，但不能克隆函数、DOM 节点等。

手写深拷贝时要处理循环引用：

```js
function deepClone(value, cache = new WeakMap()) {
  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (cache.has(value)) {
    return cache.get(value)
  }

  const result = Array.isArray(value) ? [] : {}

  cache.set(value, result)

  Reflect.ownKeys(value).forEach((key) => {
    result[key] = deepClone(value[key], cache)
  })

  return result
}
```

### once

`once` 用来保证函数只执行一次。

```js
function once(fn) {
  let called = false
  let result

  return function runOnce(...args) {
    if (!called) {
      called = true
      result = fn.apply(this, args)
    }

    return result
  }
}
```

### memoize

`memoize` 用缓存避免重复计算。

```js
function memoize(fn, resolver = (...args) => JSON.stringify(args)) {
  const cache = new Map()

  return function memoized(...args) {
    const key = resolver(...args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = fn.apply(this, args)
    cache.set(key, result)

    return result
  }
}
```

缓存函数要注意：

- 缓存键是否稳定
- 缓存是否会无限增长
- 参数里有对象时如何判断相等
- 异步函数失败时是否缓存错误

## 请求封装示例

一个基础请求函数可以覆盖大多数业务项目的初始需求：

```js
class HttpError extends Error {
  constructor(message, response) {
    super(message)
    this.name = 'HttpError'
    this.response = response
    this.status = response.status
  }
}

async function http(url, options = {}) {
  const {
    baseURL = '',
    query,
    timeout = 10000,
    headers,
    ...fetchOptions
  } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const target = new URL(url, baseURL || window.location.origin)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, String(value))
    }
  })

  try {
    const response = await fetch(target, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status}`, response)
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      return response.json()
    }

    return response.text()
  } finally {
    clearTimeout(timer)
  }
}
```

这类封装后续可以继续加入：

- 请求拦截器
- 响应拦截器
- token 自动注入
- 统一错误提示
- 重试机制
- 并发请求取消
- 文件上传下载

## 选型建议

选择第三方库时可以从这些角度判断：

- 是否真的解决了当前问题
- 是否可以被标准 API 简单替代
- 包体积是否可接受
- Tree shaking 是否友好
- TypeScript 类型是否完整
- 维护是否活跃
- API 是否稳定
- 团队是否熟悉
- 是否会影响运行时性能
- 是否引入额外安全风险

不要因为一个小函数引入一个很重的库，也不要为了“零依赖”在业务里重复维护大量脆弱工具函数。

## 常见误区

- 把时间戳秒和毫秒混用
- 用普通对象保存任意类型 key
- 用 `JSON.parse(JSON.stringify(value))` 当通用深拷贝
- 动态正则不转义用户输入
- 用 `setInterval` 做复杂轮询但不处理停止条件
- 忘记清除定时器，导致内存泄漏或重复请求
- 在 `Map` 里无限缓存数据但没有淘汰策略
- 把所有工具函数都放进一个巨大 `utils.js`

## 推荐练习

1. 使用 `Set` 实现数组去重、交集、并集、差集。
2. 使用 `Map` 把用户列表转换成以 `id` 为键的查询表。
3. 使用 `WeakMap` 给对象保存私有状态。
4. 手写 `debounce`、`throttle`、`once`、`memoize`。
5. 使用 `URLSearchParams` 封装查询参数拼接函数。
6. 使用 `Date.now()` 和 `performance.now()` 分别记录业务时间和函数耗时。
7. 使用 `ArrayBuffer`、`Uint8Array`、`DataView` 写入并读取二进制数据。
8. 封装一个带超时、错误处理和 query 参数的 `fetch` 请求函数。

## 导航

- 返回 [JavaScript 模块](../index.md)
