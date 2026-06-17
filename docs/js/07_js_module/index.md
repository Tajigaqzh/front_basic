# 07 模块

模块用于把代码拆分成独立文件，并明确每个文件对外暴露什么、依赖什么。

没有模块时，多个脚本很容易共享同一个全局作用域：

```js
// user.js
var name = 'Tom'

// order.js
var name = 'Order'
```

如果两个文件都在浏览器里用普通 `<script>` 引入，`name` 可能互相覆盖。模块的核心价值就是隔离作用域、组织依赖、控制导出。

现代 JavaScript 里最重要的两套模块系统是：

- ES Module：语言标准，使用 `import` / `export`
- CommonJS：Node.js 早期模块规范，使用 `require` / `module.exports`

在标准模块系统出现之前，也有一些常见的手动模块写法：

- 基于对象的模块
- 基于类的模块
- 基于闭包的模块
- 基于立即执行函数的自动模块化

## 模块解决的问题

模块主要解决四类问题：

- 命名冲突：每个模块有自己的作用域
- 依赖管理：明确当前文件依赖哪些模块
- 代码复用：把通用逻辑导出给其他文件使用
- 工程拆分：把大型应用拆成多个小文件、小功能

```js
// math.js
export function add(a, b) {
  return a + b
}

// index.js
import { add } from './math.js'

add(1, 2) // 3
```

`math.js` 只暴露 `add`，其他文件只能通过 `import` 使用它。

## 基于对象的模块

最简单的模块写法，是把一组相关方法放到一个对象里。

```js
const mathModule = {
  add(a, b) {
    return a + b
  },

  minus(a, b) {
    return a - b
  },
}

mathModule.add(1, 2) // 3
mathModule.minus(3, 1) // 2
```

这种方式把相关能力聚合在一起，减少了全局变量数量。

也可以把模块挂到全局对象上：

```js
window.mathModule = {
  add(a, b) {
    return a + b
  },
}
```

其他脚本可以直接访问：

```js
window.mathModule.add(1, 2)
```

这种写法的问题是：

- 仍然依赖全局对象
- 内部状态容易被外部随意修改
- 模块之间的依赖关系不清晰

例如：

```js
const userModule = {
  token: '',

  setToken(value) {
    this.token = value
  },
}

userModule.token = 'other value'
```

外部代码可以直接修改 `token`，模块无法控制状态变化。

## 基于类的模块

如果模块需要创建多个实例，可以用类来组织。

```js
class Counter {
  constructor(initialValue = 0) {
    this.count = initialValue
  }

  increment() {
    this.count++
  }

  getValue() {
    return this.count
  }
}

const counterA = new Counter()
const counterB = new Counter(10)

counterA.increment()
counterB.increment()

counterA.getValue() // 1
counterB.getValue() // 11
```

类适合描述有状态、有实例的模块，例如：

- 表单控制器
- 请求客户端
- 缓存实例
- 业务服务对象

例如请求客户端：

```js
class HttpClient {
  constructor(baseURL) {
    this.baseURL = baseURL
  }

  get(path) {
    return fetch(`${this.baseURL}${path}`)
  }
}

const userClient = new HttpClient('/api/user')

userClient.get('/profile')
```

类模块的优势是结构清晰，实例之间状态隔离；缺点是如果只是导出几个无状态工具函数，用类会显得过重。

## 基于闭包的模块

闭包可以保存私有变量，并只暴露有限的操作方法。

```js
function createCounter() {
  let count = 0

  return {
    increment() {
      count++
    },

    decrement() {
      count--
    },

    getValue() {
      return count
    },
  }
}

const counter = createCounter()

counter.increment()
counter.increment()

counter.getValue() // 2
counter.count // undefined
```

这里的 `count` 不在返回对象上，外部不能直接访问，只能通过闭包中的方法间接操作。

闭包模块适合封装私有状态：

```js
function createTokenStore() {
  let token = ''

  return {
    setToken(value) {
      token = value
    },

    getToken() {
      return token
    },

    clearToken() {
      token = ''
    },
  }
}

const tokenStore = createTokenStore()

tokenStore.setToken('abc')
tokenStore.getToken() // abc
```

这种写法的关键点是：

- 私有变量放在函数作用域里
- 对外只返回需要暴露的方法
- 外部无法绕过方法直接改内部状态

## 基于闭包的自动模块化

早期浏览器没有原生模块系统，常用立即执行函数表达式，也就是 IIFE，来模拟模块。

```js
const userModule = (function () {
  let token = ''

  function setToken(value) {
    token = value
  }

  function getToken() {
    return token
  }

  return {
    setToken,
    getToken,
  }
})()

userModule.setToken('abc')
userModule.getToken() // abc
```

这个函数定义后立即执行，形成一个独立作用域。`token` 被闭包保存，外部只能访问返回对象中的方法。

如果需要挂到全局对象上，可以这样写：

```js
(function (global) {
  let count = 0

  function increment() {
    count++
  }

  function getCount() {
    return count
  }

  global.counterModule = {
    increment,
    getCount,
  }
})(window)
```

使用：

```js
window.counterModule.increment()
window.counterModule.getCount() // 1
```

这种方式被称为“自动模块化”，是因为文件加载后模块会自动执行并把 API 暴露到指定位置。

它的优点：

- 能隔离私有变量
- 不依赖 ES Module 或 CommonJS
- 适合早期浏览器脚本

它的缺点：

- 依赖全局变量传递模块
- 脚本加载顺序很重要
- 依赖关系不如 `import` 明确

例如：

```html
<script src="./counter.js"></script>
<script src="./main.js"></script>
```

如果 `main.js` 依赖 `counter.js`，就必须先加载 `counter.js`。

## ES Module

ES Module 简称 ESM，是 JavaScript 官方模块系统。

它有几个重要特点：

- 每个文件都是独立模块作用域
- 默认启用严格模式
- `import` / `export` 必须写在模块顶层
- 导入导出关系是静态的，便于构建工具分析
- 导入的是绑定关系，不是简单的值拷贝

### 模块作用域

模块中的变量不会自动挂到全局对象上。

```js
// user.js
const name = 'Tom'

// main.js
console.log(typeof name) // undefined
```

即使两个模块里声明同名变量，也不会冲突：

```js
// a.js
const count = 1

// b.js
const count = 2
```

它们分别属于自己的模块作用域。

### 自动严格模式

ES Module 默认就是严格模式。

```js
// module.js
// 不需要写 'use strict'

name = 'Tom' // ReferenceError
```

普通脚本里如果没有严格模式，给未声明变量赋值可能会创建全局变量；模块里会直接报错。

## export 导出

一个模块只有被导出的内容，其他模块才能导入。

ES Module 有两种常见导出：

- 具名导出
- 默认导出

## 具名导出

具名导出就是按名字导出多个成员。

```js
// math.js
export const PI = 3.14

export function add(a, b) {
  return a + b
}

export function minus(a, b) {
  return a - b
}
```

导入时必须使用对应名字：

```js
// index.js
import { PI, add, minus } from './math.js'

PI // 3.14
add(1, 2) // 3
minus(3, 1) // 2
```

也可以先声明，再统一导出：

```js
const PI = 3.14

function add(a, b) {
  return a + b
}

function minus(a, b) {
  return a - b
}

export { PI, add, minus }
```

这种写法在文件底部集中列出导出项，阅读时更容易看清模块对外 API。

### 导出时重命名

导出时可以使用 `as` 改名：

```js
const internalAdd = (a, b) => a + b

export { internalAdd as add }
```

导入方看到的是 `add`：

```js
import { add } from './math.js'

add(1, 2) // 3
```

## 默认导出

默认导出表示这个模块最主要导出的内容。

```js
// logger.js
export default function log(message) {
  console.log(`[log] ${message}`)
}
```

导入默认导出时，名字可以由导入方决定：

```js
import log from './logger.js'

log('hello')
```

也可以换成其他名字：

```js
import print from './logger.js'

print('hello')
```

一个模块最多只能有一个默认导出。

```js
export default function add(a, b) {
  return a + b
}

// export default function minus(a, b) {
//   return a - b
// }
```

第二个 `export default` 会报错。

### 默认导出表达式

默认导出可以导出表达式：

```js
export default {
  baseURL: '/api',
  timeout: 5000,
}
```

导入：

```js
import config from './config.js'

config.baseURL // /api
```

也可以导出类：

```js
export default class User {
  constructor(name) {
    this.name = name
  }
}
```

导入：

```js
import User from './User.js'

const user = new User('Tom')
```

## 具名导出和默认导出一起使用

一个模块可以同时存在默认导出和具名导出：

```js
// request.js
export const timeout = 5000

export function get(url) {
  return fetch(url)
}

export default function request(url, options) {
  return fetch(url, options)
}
```

导入：

```js
import request, { timeout, get } from './request.js'

request('/api/user')
get('/api/list')
timeout // 5000
```

默认导出写在 `{}` 外面，具名导出写在 `{}` 里面。

## import 导入

`import` 用来导入其他模块暴露的内容。

### 导入具名成员

```js
import { add } from './math.js'

add(1, 2)
```

导入多个成员：

```js
import { add, minus, PI } from './math.js'
```

### 导入时重命名

如果导入的名字和当前文件变量冲突，可以使用 `as`：

```js
import { add as addNumber } from './math.js'

function add(a, b, c) {
  return a + b + c
}

addNumber(1, 2) // 3
add(1, 2, 3) // 6
```

### 导入全部成员

可以把一个模块的所有具名导出收集到一个对象上：

```js
import * as math from './math.js'

math.add(1, 2)
math.minus(3, 1)
math.PI
```

这种写法适合工具模块，但不要滥用。明确导入具体成员更利于阅读和 tree shaking。

### 只执行模块

有时导入一个模块只是为了执行它的副作用，不需要拿到导出值：

```js
import './setup.js'
```

例如：

```js
// setup.js
console.log('初始化配置')
window.appConfig = {
  env: 'dev',
}
```

这种模块依赖副作用，阅读成本较高。实际项目里应尽量减少隐式副作用。

## import 必须位于顶层

静态 `import` 只能写在模块顶层，不能写在 `if`、`for`、函数内部。

```js
// 错误
if (isDev) {
  import { mock } from './mock.js'
}
```

原因是 ESM 的依赖关系需要在代码执行前就确定，构建工具和浏览器才能提前解析模块图。

正确做法是使用动态导入：

```js
if (isDev) {
  const module = await import('./mock.js')
  module.mock()
}
```

## 动态导入 import()

`import()` 是一个函数形式的动态导入，它返回 Promise。

```js
const module = await import('./math.js')

module.add(1, 2) // 3
```

如果动态导入的模块有默认导出，可以从 `default` 上读取：

```js
// dialog.js
export default function openDialog() {
  console.log('open')
}
```

```js
const module = await import('./dialog.js')

module.default()
```

也可以解构并重命名：

```js
const { default: openDialog } = await import('./dialog.js')

openDialog()
```

它可以放在条件语句、函数、事件回调里：

```js
button.addEventListener('click', async () => {
  const { openDialog } = await import('./dialog.js')

  openDialog()
})
```

动态导入常用于：

- 路由懒加载
- 大组件按需加载
- 管理后台页面拆包
- 只在特定环境加载调试工具

### Vue Router 懒加载示例

```js
const routes = [
  {
    path: '/user',
    component: () => import('./pages/UserPage.vue'),
  },
]
```

这里 `UserPage.vue` 不会进入首屏主包，访问 `/user` 时才会加载。

### 动态导入的错误处理

动态导入可能失败，例如文件不存在、网络加载失败、模块执行报错。

```js
async function loadFeature() {
  try {
    const { run } = await import('./feature.js')

    run()
  } catch (error) {
    console.error('模块加载失败', error)
  }
}

loadFeature()
```

在前端项目中，动态导入失败通常需要展示降级 UI 或重试按钮。

```js
async function openEditor() {
  try {
    const { createEditor } = await import('./editor.js')

    return createEditor()
  } catch (error) {
    return showMessage('编辑器加载失败，请稍后重试')
  }
}
```

### 动态路径的限制

动态导入虽然可以接收表达式，但构建工具不一定能分析任意路径。

```js
const pageName = 'user'

const module = await import(`./pages/${pageName}.js`)
```

这类写法在构建工具中通常会被转换成一个可匹配的模块集合。

但是过于动态的路径很难被分析：

```js
const modulePath = window.localStorage.getItem('modulePath')

const module = await import(modulePath)
```

构建工具无法提前知道要打包哪些文件，浏览器也可能因为 URL、跨域或安全策略加载失败。

更推荐把可加载模块显式列出来：

```js
const modules = {
  user: () => import('./pages/user.js'),
  order: () => import('./pages/order.js'),
}

const loader = modules[pageName]

if (loader) {
  const module = await loader()

  module.render()
}
```

这样模块范围清晰，也更容易做权限控制和错误处理。

## 导入的是实时绑定

ES Module 导入的不是普通值拷贝，而是实时绑定。

```js
// counter.js
export let count = 0

export function increment() {
  count++
}
```

```js
// index.js
import { count, increment } from './counter.js'

console.log(count) // 0

increment()

console.log(count) // 1
```

`count` 的变化能被导入方观察到。

但是导入的绑定不能在导入方直接修改：

```js
import { count } from './counter.js'

// count = 10 // TypeError
```

如果需要修改，应由导出模块提供函数：

```js
// counter.js
export let count = 0

export function setCount(value) {
  count = value
}
```

## 模块只执行一次

同一个模块被多次导入，也只会执行一次。之后再导入时，拿到的是缓存后的模块实例。

```js
// config.js
console.log('config loaded')

export const config = {
  env: 'dev',
}
```

```js
// a.js
import { config } from './config.js'

// b.js
import { config } from './config.js'
```

即使 `a.js` 和 `b.js` 都导入了 `config.js`，`config loaded` 也只会输出一次。

这也是模块可以保存状态的原因：

```js
// store.js
let token = ''

export function setToken(value) {
  token = value
}

export function getToken() {
  return token
}
```

多个文件导入 `store.js` 时，访问的是同一个模块状态。

## 浏览器中使用 ES Module

浏览器可以直接通过 `<script type="module">` 使用模块。

```html
<script type="module" src="./main.js"></script>
```

`main.js`：

```js
import { add } from './math.js'

console.log(add(1, 2))
```

注意：浏览器里的模块路径通常需要写完整相对路径：

```js
import { add } from './math.js'
```

不要写成：

```js
// 浏览器原生 ESM 中通常不能这样写
import { add } from './math'
```

构建工具可以帮你补全和解析路径，但浏览器原生模块需要更明确的 URL。

### type="module" 的特点

```html
<script type="module" src="./main.js"></script>
```

模块脚本有这些特点：

- 默认延迟执行，类似 `defer`
- 默认严格模式
- 拥有独立模块作用域
- 可以使用 `import` / `export`
- 跨域加载需要满足 CORS 规则

## Node.js 中使用 ES Module

Node.js 同时支持 CommonJS 和 ES Module。

如果要在 Node.js 中使用 ESM，常见方式有两种。

### 使用 .mjs 扩展名

```js
// math.mjs
export function add(a, b) {
  return a + b
}
```

```js
// index.mjs
import { add } from './math.mjs'

console.log(add(1, 2))
```

### package.json 设置 type

```json
{
  "type": "module"
}
```

设置后，当前包内的 `.js` 文件会按 ESM 处理：

```js
// math.js
export function add(a, b) {
  return a + b
}
```

如果 `package.json` 没有设置 `"type": "module"`，Node.js 默认会把 `.js` 文件按 CommonJS 处理。

### Node.js 的模块类型判断

Node.js 判断一个文件使用哪种模块系统，主要看扩展名和 `package.json`。

常见规则：

- `.mjs`：始终按 ES Module 处理
- `.cjs`：始终按 CommonJS 处理
- `.js`：取决于最近的 `package.json` 中的 `"type"`
- `"type": "module"`：`.js` 按 ESM 处理
- `"type": "commonjs"` 或没有 `type`：`.js` 按 CommonJS 处理

示例：

```json
{
  "type": "module"
}
```

此时：

```text
index.js  -> ES Module
index.cjs -> CommonJS
index.mjs -> ES Module
```

如果没有 `"type": "module"`：

```text
index.js  -> CommonJS
index.cjs -> CommonJS
index.mjs -> ES Module
```

### Node.js 中的 ESM 路径

Node.js ESM 中导入相对文件时，通常需要写完整扩展名：

```js
import { add } from './math.js'
```

不要写成：

```js
// Node.js ESM 中不推荐省略扩展名
import { add } from './math'
```

这是 Node.js ESM 和很多构建工具项目的差异之一。Vite、Webpack 这类工具通常会帮你补全扩展名和目录入口，Node.js 原生 ESM 更严格。

## CommonJS

CommonJS 是 Node.js 早期默认使用的模块系统。

它的核心语法是：

- `require()`：导入模块
- `module.exports`：导出模块
- `exports`：`module.exports` 的快捷引用

Node.js 中每个 CommonJS 文件都会被包装成一个函数执行。可以把它理解成类似这样：

```js
;(function (exports, require, module, __filename, __dirname) {
  // 当前模块源码
})
```

所以 CommonJS 文件里可以直接使用这些变量：

```js
console.log(__filename) // 当前文件的完整路径
console.log(__dirname) // 当前文件所在目录
console.log(module.exports)
```

这些变量不是全局变量，而是 Node.js 在执行模块时注入的模块局部变量。

### module.exports 导出

```js
// math.js
function add(a, b) {
  return a + b
}

function minus(a, b) {
  return a - b
}

module.exports = {
  add,
  minus,
}
```

导入：

```js
// index.js
const math = require('./math')

math.add(1, 2) // 3
math.minus(3, 1) // 2
```

也可以解构：

```js
const { add, minus } = require('./math')

add(1, 2)
minus(3, 1)
```

### 导出单个函数

```js
// logger.js
module.exports = function log(message) {
  console.log(message)
}
```

导入：

```js
const log = require('./logger')

log('hello')
```

### exports 写法

```js
exports.add = function add(a, b) {
  return a + b
}

exports.minus = function minus(a, b) {
  return a - b
}
```

这等价于：

```js
module.exports.add = function add(a, b) {
  return a + b
}

module.exports.minus = function minus(a, b) {
  return a - b
}
```

### exports 的常见错误

`exports` 初始时只是指向 `module.exports` 的一个引用。

可以这样用：

```js
exports.add = function add(a, b) {
  return a + b
}
```

不要这样整体赋值：

```js
exports = {
  add(a, b) {
    return a + b
  },
}
```

这样只是改变了局部变量 `exports` 的指向，并没有改变真正导出的 `module.exports`。

如果要整体导出对象，应使用：

```js
module.exports = {
  add(a, b) {
    return a + b
  },
}
```

## CommonJS 的加载特点

CommonJS 的 `require()` 是运行时加载。

```js
if (isDev) {
  const mock = require('./mock')

  mock.start()
}
```

这和 ESM 的静态 `import` 不同。

CommonJS 模块也只会执行一次，之后从缓存里读取：

```js
// counter.js
let count = 0

count++

module.exports = {
  count,
}
```

```js
const a = require('./counter')
const b = require('./counter')

console.log(a.count) // 1
console.log(b.count) // 1
console.log(a === b) // true
```

### require 的解析规则

`require()` 传入的路径不同，解析方式也不同。

相对路径：

```js
const math = require('./math')
const format = require('../utils/format')
```

核心模块：

```js
const fs = require('fs')
const path = require('path')
```

第三方包：

```js
const express = require('express')
```

大致解析规则：

- `./`、`../` 开头：按相对路径查找
- `/` 开头：按绝对路径查找
- 没有路径前缀：先查 Node.js 内置模块，再查 `node_modules`

当省略扩展名时，CommonJS 会尝试补全：

```js
require('./math')
```

可能依次尝试：

```text
./math
./math.js
./math.json
./math.node
./math/index.js
./math/index.json
./math/index.node
```

具体细节会随 Node.js 版本和包配置变化，但这个顺序能帮助理解为什么 CommonJS 可以省略扩展名。

### require 缓存

CommonJS 会缓存模块执行结果。

```js
const path = require.resolve('./counter')

console.log(require.cache[path])
```

`require.cache` 中保存了已经加载过的模块。再次 `require()` 同一个模块时，Node.js 会直接返回缓存中的 `module.exports`。

学习时可以手动删除缓存观察模块重新执行：

```js
const path = require.resolve('./counter')

delete require.cache[path]

const counter = require('./counter')
```

业务代码里一般不建议依赖这种写法，它更多用于测试、调试或热更新机制。

## Node.js 中 ESM 和 CommonJS 互相使用

实际项目里可能同时遇到 ESM 和 CommonJS。

### CommonJS 导入 ESM

CommonJS 不能直接用静态 `import`，但可以使用动态 `import()`：

```js
// index.cjs
async function main() {
  const math = await import('./math.mjs')

  console.log(math.add(1, 2))
}

main()
```

因为 `import()` 返回 Promise，所以这段代码必须放在 async 函数里，或者用 Promise 链处理。

### ESM 导入 CommonJS

ESM 可以导入 CommonJS 的默认导出。

```js
// math.cjs
module.exports = {
  add(a, b) {
    return a + b
  },
}
```

```js
// index.mjs
import math from './math.cjs'

math.add(1, 2) // 3
```

这里的默认导入通常对应 CommonJS 的 `module.exports`。

### ESM 中没有 __dirname 和 __filename

ESM 文件里不能直接使用 CommonJS 的 `__dirname` 和 `__filename`。

```js
// index.mjs
console.log(__dirname) // ReferenceError
```

可以用 `import.meta.url` 自己转换：

```js
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log(__filename)
console.log(__dirname)
```

这也是很多 Node.js ESM 项目中常见的兼容写法。

## ES Module 和 CommonJS 的区别

两者最核心的区别如下：

| 对比项 | ES Module | CommonJS |
| --- | --- | --- |
| 标准来源 | JavaScript 语言标准 | Node.js 社区规范 |
| 导入语法 | `import` | `require()` |
| 导出语法 | `export` | `module.exports` |
| 加载时机 | 编译阶段静态分析 | 运行时加载 |
| 导入位置 | 只能在顶层静态导入 | 可以写在条件和函数里 |
| 导入结果 | 实时绑定 | 通常是导出对象的引用或值 |
| 异步能力 | 原生支持异步模块加载 | 同步加载为主 |
| tree shaking | 更友好 | 较困难 |

### 静态结构和运行时结构

ESM 的依赖关系在执行前就能确定：

```js
import { add } from './math.js'
```

CommonJS 的依赖关系可能要运行到某一行才知道：

```js
const name = isDev ? './mock' : './prod'
const service = require(name)
```

这也是构建工具更喜欢 ESM 的原因。

## 循环依赖

循环依赖指两个模块互相依赖。

```js
// a.js
import { b } from './b.js'

export const a = 'a'

console.log(b)
```

```js
// b.js
import { a } from './a.js'

export const b = 'b'

console.log(a)
```

循环依赖不一定会报错，但很容易出现初始化顺序问题。

### ESM 循环依赖

ESM 使用实时绑定，可以在一定程度上处理循环依赖，但如果访问了还没初始化的绑定，会报错。

```js
// a.js
import { b } from './b.js'

console.log(b)

export const a = 'a'
```

```js
// b.js
import { a } from './a.js'

console.log(a)

export const b = 'b'
```

`b.js` 在 `a` 初始化前访问它，可能触发：

```text
ReferenceError: Cannot access 'a' before initialization
```

一种改法是把访问放到函数调用时：

```js
// a.js
import { getB } from './b.js'

export const a = 'a'

export function getA() {
  return a
}

console.log(getB())
```

```js
// b.js
import { getA } from './a.js'

export const b = 'b'

export function getB() {
  return `${b}-${getA()}`
}
```

这样模块初始化阶段不直接读取对方未完成的变量。

### CommonJS 循环依赖

CommonJS 遇到循环依赖时，可能拿到的是对方模块尚未完成导出的中间状态。

```js
// a.js
const b = require('./b')

module.exports = {
  name: 'a',
  bName: b.name,
}
```

```js
// b.js
const a = require('./a')

module.exports = {
  name: 'b',
  aName: a.name,
}
```

如果 `b.js` 读取 `a.name` 时，`a.js` 还没执行完，可能得到 `undefined`。

### 如何减少循环依赖

常见处理方式：

- 抽出公共模块，让双方都依赖第三个模块
- 延迟访问，把顶层访问改成函数内部访问
- 重新划分模块边界，避免两个模块互相知道太多
- 让底层模块不依赖上层业务模块

例如：

```js
// constants.js
export const ROLE_ADMIN = 'admin'
```

```js
// user.js
import { ROLE_ADMIN } from './constants.js'
```

```js
// permission.js
import { ROLE_ADMIN } from './constants.js'
```

`user.js` 和 `permission.js` 不再互相依赖，而是共同依赖 `constants.js`。

## 模块路径

模块路径大致分为三类：

- 相对路径
- 绝对路径或别名路径
- 包名路径

### 相对路径

```js
import { add } from './math.js'
import { format } from '../utils/format.js'
```

`./` 表示当前目录，`../` 表示上一级目录。

### 别名路径

很多项目会配置路径别名：

```js
import Button from '@/components/Button.vue'
import { formatDate } from '@/utils/date'
```

`@` 通常指向 `src` 目录，具体含义由构建工具配置决定。

Vite 中常见配置：

```js
// vite.config.js
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

### 包名路径

从 `node_modules` 导入依赖：

```js
import axios from 'axios'
import { createApp } from 'vue'
```

这些模块由包管理器安装，并由 Node.js 或构建工具解析。

## index.js 默认入口

在很多构建环境里，导入目录时会自动查找目录下的 `index.js`：

```js
import { add } from './utils'
```

可能等价于：

```js
import { add } from './utils/index.js'
```

但是不同环境对扩展名和目录入口的支持不同。学习和写库时，推荐路径尽量明确；在业务项目里，可以遵循团队和构建工具的约定。

## 聚合导出

聚合导出常用于模块入口文件。

目录结构：

```text
utils/
├─ date.js
├─ number.js
└─ index.js
```

`date.js`：

```js
export function formatDate(date) {
  return date.toISOString().slice(0, 10)
}
```

`number.js`：

```js
export function formatNumber(num) {
  return String(num)
}
```

`index.js`：

```js
export { formatDate } from './date.js'
export { formatNumber } from './number.js'
```

使用：

```js
import { formatDate, formatNumber } from './utils/index.js'
```

也可以重新导出全部具名导出：

```js
export * from './date.js'
export * from './number.js'
```

注意：`export *` 不会重新导出默认导出。

如果要重新导出默认导出，需要这样写：

```js
export { default as request } from './request.js'
```

## Tree Shaking

Tree shaking 指构建工具移除没有被使用的导出代码。

```js
// math.js
export function add(a, b) {
  return a + b
}

export function heavyTask() {
  console.log('很多代码')
}
```

```js
// index.js
import { add } from './math.js'

add(1, 2)
```

如果 `heavyTask` 没有被使用，构建工具可能会把它从最终产物中移除。

ESM 更适合 tree shaking，因为它的导入导出关系是静态的。

### 影响 tree shaking 的写法

不利于分析的写法：

```js
import * as utils from './utils.js'

const name = 'add'

utils[name](1, 2)
```

构建工具很难判断哪些成员会被使用。

更清晰的写法：

```js
import { add } from './utils.js'

add(1, 2)
```

## 副作用模块

模块除了导出值，也可能在执行时修改外部环境，这叫副作用。

```js
// polyfill.js
Array.prototype.first = function first() {
  return this[0]
}
```

使用：

```js
import './polyfill.js'
```

这种模块没有显式导出，但执行后改变了全局对象。

副作用不是一定不能用，但要谨慎：

- 初始化类逻辑可以集中放在入口文件
- 全局修改要少做，并写清楚原因
- 工具函数模块尽量保持无副作用

## import.meta

`import.meta` 是 ESM 中提供模块元信息的对象。

在浏览器中：

```js
console.log(import.meta.url)
```

它会输出当前模块文件的 URL。

在 Vite 中，常见用法是读取环境变量：

```js
console.log(import.meta.env.MODE)
console.log(import.meta.env.DEV)
console.log(import.meta.env.PROD)
```

也常用于构造资源地址：

```js
const imageUrl = new URL('./assets/logo.png', import.meta.url).href
```

## top-level await

ES Module 支持在模块顶层使用 `await`。

```js
// config.js
const response = await fetch('/api/config')

export const config = await response.json()
```

导入这个模块的其他模块，会等待它完成初始化。

```js
import { config } from './config.js'

console.log(config)
```

顶层 `await` 很方便，但不要在基础模块中滥用。因为它会影响依赖它的整个模块链加载速度。

## JSON 模块

不同运行环境对 JSON 模块的支持略有差异。

在一些构建工具中可以直接导入 JSON：

```js
import packageInfo from './package.json'

console.log(packageInfo.name)
```

在较新的 Node.js ESM 中，可能需要 import attributes：

```js
import data from './data.json' with { type: 'json' }
```

实际项目中应以当前运行环境和构建工具规则为准。

## 模块设计建议

### 一个模块只做一类事情

好的模块边界应该清晰。

```js
// date.js
export function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date, days) {
  const next = new Date(date)

  next.setDate(next.getDate() + days)

  return next
}
```

`date.js` 专注日期处理，不要同时放请求、缓存、DOM 操作。

### 导出稳定 API

模块内部实现可以变，导出的名字和行为要尽量稳定。

```js
// user-service.js
async function requestUser(id) {
  const response = await fetch(`/api/users/${id}`)

  return response.json()
}

export async function getUser(id) {
  return requestUser(id)
}
```

外部只依赖 `getUser`，不需要知道内部请求细节。

### 避免默认导出过多

默认导出可以用于一个模块只有一个核心对象的情况：

```js
export default class UserService {}
```

如果模块导出多个工具函数，具名导出通常更清晰：

```js
export function formatDate() {}
export function formatNumber() {}
```

具名导出的好处：

- 导入名字统一
- 重构时更容易查找
- IDE 自动补全更明确
- 更利于构建工具分析

### 不要导出可随意修改的对象

```js
export const state = {
  token: '',
}
```

其他模块可以直接修改：

```js
import { state } from './state.js'

state.token = 'abc'
```

如果状态修改需要控制，应该导出函数：

```js
let token = ''

export function setToken(value) {
  token = value
}

export function getToken() {
  return token
}
```

## 常见错误

### 忘记写相对路径

```js
// 错误
import { add } from 'math.js'
```

这会被当成包名解析。

应该写：

```js
import { add } from './math.js'
```

### 具名导入和默认导入混淆

```js
// math.js
export default function add(a, b) {
  return a + b
}
```

正确：

```js
import add from './math.js'
```

错误：

```js
import { add } from './math.js'
```

如果是具名导出：

```js
// math.js
export function add(a, b) {
  return a + b
}
```

正确：

```js
import { add } from './math.js'
```

### 在普通 script 中使用 import

```html
<script src="./main.js"></script>
```

如果 `main.js` 里写了：

```js
import { add } from './math.js'
```

浏览器会报错。应该改成：

```html
<script type="module" src="./main.js"></script>
```

### 混用 ESM 和 CommonJS

不要在同一个文件里随意混用：

```js
import { add } from './math.js'

module.exports = {
  add,
}
```

是否能运行取决于当前文件被 Node.js 或构建工具按哪种模块系统处理。更好的做法是一个文件统一使用一种模块语法。

## 小结

模块的关键点：

- ESM 是现代 JavaScript 的标准模块系统
- `export` 决定模块暴露什么，`import` 决定模块依赖什么
- 具名导出适合多个 API，默认导出适合一个核心 API
- ESM 的导入导出是静态结构，适合构建分析和 tree shaking
- CommonJS 使用 `require` 和 `module.exports`，在 Node.js 生态中仍然常见
- 循环依赖要尽量避免，必要时可以抽公共模块或延迟访问
- 模块设计要保持边界清晰、依赖方向稳定、导出 API 明确

## 导航

- 返回 [JavaScript 模块](../index.md)
