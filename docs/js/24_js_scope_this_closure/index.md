# this / 执行上下文 / 作用域链 / 闭包

这一章整理 JavaScript 中非常容易混在一起的几个运行时概念：

- 执行上下文：一段代码执行前，运行时为它准备的环境
- 调用栈：多个执行上下文的入栈和出栈过程
- 作用域链：变量查找时沿着词法外层一层层向上找
- `this`：函数被调用时确定的调用者上下文
- 闭包：函数和它能访问到的外层词法环境的组合

这几个概念经常同时出现，但关注点不同：

| 概念 | 解决的问题 | 关键点 |
| --- | --- | --- |
| 执行上下文 | 当前代码如何被执行 | 变量环境、词法环境、`this` |
| 调用栈 | 函数调用顺序如何管理 | 后进先出 |
| 作用域链 | 变量从哪里查找 | 定义位置决定 |
| `this` | 当前函数里的 `this` 是谁 | 调用方式决定 |
| 闭包 | 为什么外层变量还能被访问 | 函数保存词法环境引用 |

## 1. 执行上下文

执行上下文可以理解为 JavaScript 执行一段代码前创建的“运行环境”。

常见执行上下文有三类：

- 全局执行上下文：脚本开始执行时创建
- 函数执行上下文：函数被调用时创建
- `eval` 执行上下文：执行 `eval` 时创建，实际开发中应尽量避免

每个执行上下文中都包含几类重要信息：

- 变量环境：`var`、函数声明等
- 词法环境：`let`、`const`、块级作用域等
- 外部环境引用：用于形成作用域链
- `this` 绑定：当前上下文里的 `this`

示例：

```js
const name = 'global'

function say() {
  const message = 'hello'
  console.log(name, message)
}

say()
```

执行过程可以简化理解为：

1. 创建全局执行上下文，声明 `name` 和 `say`
2. 调用 `say()`，创建函数执行上下文
3. 在 `say` 内部查找 `message`，当前作用域能找到
4. 查找 `name`，当前作用域找不到，沿作用域链向外层查找
5. `say` 执行结束，函数执行上下文出栈

## 2. 调用栈

调用栈用来管理函数调用。函数调用时入栈，函数执行结束后出栈。

```js
function a() {
  b()
}

function b() {
  c()
}

function c() {
  console.log('c')
}

a()
```

执行顺序可以理解为：

```txt
global()
global() -> a()
global() -> a() -> b()
global() -> a() -> b() -> c()
global() -> a() -> b()
global() -> a()
global()
```

调用栈是后进先出结构。递归如果没有结束条件，会不断创建新的函数执行上下文，最终导致调用栈溢出。

```js
function loop() {
  loop()
}

// loop() // RangeError: Maximum call stack size exceeded
```

## 3. 作用域

作用域决定变量在哪里可以被访问。

JavaScript 常见作用域包括：

- 全局作用域
- 函数作用域
- 块级作用域
- 模块作用域

### 全局作用域

在最外层声明的变量处于全局作用域。

```js
const count = 1

function print() {
  console.log(count)
}

print() // 1
```

全局变量可以被很多地方访问，容易造成命名冲突和状态污染。实际开发中应减少全局变量。

### 函数作用域

函数内部声明的变量只能在函数内部访问。

```js
function createUser() {
  const name = 'Tom'
  return name
}

createUser() // Tom
// console.log(name) // ReferenceError
```

### 块级作用域

`let` 和 `const` 会形成块级作用域。

```js
if (true) {
  const message = 'hello'
  let count = 1
}

// console.log(message) // ReferenceError
// console.log(count) // ReferenceError
```

`var` 没有块级作用域，只有函数作用域。

```js
if (true) {
  var value = 1
}

console.log(value) // 1
```

这也是现代代码更推荐使用 `const` 和 `let` 的原因之一。

### 模块作用域

ES Module 文件天然拥有模块作用域。模块顶层声明的变量不会直接变成全局变量。

```js
// user.js
const name = 'Tom'

export function getName() {
  return name
}
```

其他模块只能访问显式导出的内容。

## 4. 词法作用域

JavaScript 使用词法作用域，也叫静态作用域。变量查找规则由代码写在哪里决定，而不是由函数在哪里调用决定。

```js
const name = 'global'

function printName() {
  console.log(name)
}

function run() {
  const name = 'local'
  printName()
}

run() // global
```

`printName` 定义在全局作用域，所以它访问的是全局的 `name`。即使它在 `run` 里面被调用，也不会去访问 `run` 里面的 `name`。

这点和 `this` 不同：

- 普通变量：看函数定义位置
- `this`：看函数调用方式

## 5. 作用域链

当访问一个变量时，JavaScript 会先在当前作用域查找。如果找不到，就沿着外层作用域继续查找，直到全局作用域。

```js
const a = 1

function outer() {
  const b = 2

  function inner() {
    const c = 3
    console.log(a, b, c)
  }

  inner()
}

outer() // 1 2 3
```

`inner` 中访问变量的顺序是：

1. 查找 `c`：当前作用域能找到
2. 查找 `b`：当前作用域找不到，到 `outer` 作用域查找
3. 查找 `a`：继续到全局作用域查找

如果所有作用域都找不到，就会抛出 `ReferenceError`。

```js
function fn() {
  console.log(value)
}

// fn() // ReferenceError: value is not defined
```

## 6. 变量提升和暂时性死区

### var 的提升

`var` 声明会被提升到当前函数或全局作用域顶部，但赋值不会提升。

```js
console.log(count) // undefined

var count = 1
```

可以粗略理解为：

```js
var count

console.log(count)

count = 1
```

### 函数声明的提升

函数声明会整体提升，所以可以在声明前调用。

```js
sayHi() // hi

function sayHi() {
  console.log('hi')
}
```

### let 和 const 的暂时性死区

`let` 和 `const` 也会在作用域创建阶段被记录，但在执行到声明语句之前不能访问，这段不可访问区域叫暂时性死区。

```js
// console.log(name) // ReferenceError

const name = 'Tom'
```

`const` 声明时必须初始化，`let` 可以先声明再赋值。

```js
let age
age = 18

const name = 'Tom'
```

## 7. this

`this` 是函数执行时自动提供的一个值。普通函数中的 `this` 主要由调用方式决定，而不是由函数定义位置决定。

### 默认绑定

直接调用普通函数时，属于默认绑定。

```js
function fn() {
  console.log(this)
}

fn()
```

在非严格模式下，浏览器中 `this` 通常指向 `window`。在严格模式下，`this` 是 `undefined`。

```js
'use strict'

function fn() {
  console.log(this)
}

fn() // undefined
```

### 隐式绑定

通过对象调用函数时，`this` 指向调用这个函数的对象。

```js
const user = {
  name: 'Tom',
  sayHi() {
    console.log(this.name)
  }
}

user.sayHi() // Tom
```

看 `this` 时重点看调用点：谁在点号前面，`this` 通常就是谁。

```js
const user = {
  name: 'Tom',
  sayHi() {
    console.log(this.name)
  }
}

const fn = user.sayHi

fn() // 非严格模式下通常是 undefined，严格模式下 this 是 undefined
```

`fn` 只是拿到了函数引用，调用时已经不是 `user.fn()` 这种形式，所以 `this` 不再指向 `user`。

### 显式绑定

可以用 `call`、`apply`、`bind` 显式指定 `this`。

```js
function sayHi(age) {
  console.log(this.name, age)
}

const user = { name: 'Tom' }

sayHi.call(user, 18) // Tom 18
sayHi.apply(user, [18]) // Tom 18

const boundSayHi = sayHi.bind(user)
boundSayHi(18) // Tom 18
```

三者区别：

| 方法 | 是否立即执行 | 参数形式 | 返回值 |
| --- | --- | --- | --- |
| `call` | 是 | 逐个传入 | 函数执行结果 |
| `apply` | 是 | 数组或类数组 | 函数执行结果 |
| `bind` | 否 | 逐个传入 | 绑定后的新函数 |

### new 绑定

使用 `new` 调用函数时，`this` 指向新创建的对象。

```js
function User(name) {
  this.name = name
}

const user = new User('Tom')

console.log(user.name) // Tom
```

`new` 的大致过程：

1. 创建一个新对象
2. 把新对象的原型指向构造函数的 `prototype`
3. 用新对象作为 `this` 执行构造函数
4. 如果构造函数返回对象，则返回该对象；否则返回新对象

### 绑定优先级

常见优先级从高到低：

```txt
new 绑定 > 显式绑定 > 隐式绑定 > 默认绑定
```

示例：

```js
function User(name) {
  this.name = name
}

const obj = {}
const BoundUser = User.bind(obj)

const user = new BoundUser('Tom')

console.log(user.name) // Tom
console.log(obj.name) // undefined
```

虽然 `bind` 绑定了 `obj`，但使用 `new` 调用时，`this` 仍然指向新创建的实例。

## 8. 箭头函数中的 this

箭头函数没有自己的 `this`。它会捕获定义时外层作用域中的 `this`。

```js
const user = {
  name: 'Tom',
  sayHi() {
    const fn = () => {
      console.log(this.name)
    }

    fn()
  }
}

user.sayHi() // Tom
```

这里箭头函数里的 `this` 来自 `sayHi`，而 `sayHi` 是通过 `user.sayHi()` 调用的，所以 `this.name` 是 `Tom`。

箭头函数不适合作为需要动态 `this` 的对象方法。

```js
const user = {
  name: 'Tom',
  sayHi: () => {
    console.log(this.name)
  }
}

user.sayHi() // 通常不是 Tom
```

箭头函数常见适用场景：

- 回调函数中需要沿用外层 `this`
- 数组方法里的短函数
- Promise、定时器、事件回调里避免额外保存 `this`

```js
function Counter() {
  this.count = 0

  setInterval(() => {
    this.count += 1
    console.log(this.count)
  }, 1000)
}

new Counter()
```

## 9. 闭包

闭包是函数和它能访问到的外层词法环境的组合。

一个简单闭包：

```js
function outer() {
  const name = 'Tom'

  function inner() {
    console.log(name)
  }

  return inner
}

const fn = outer()

fn() // Tom
```

`outer` 已经执行结束，但 `inner` 仍然能访问 `outer` 里的 `name`。原因是 `inner` 被返回到外部后，仍然持有对外层词法环境的引用。

闭包形成的基本条件：

1. 函数内部定义了函数
2. 内部函数访问了外部函数的变量
3. 内部函数在外部函数执行结束后仍然可能被调用

严格来说，只要函数能访问外部词法环境，就和闭包机制有关。面试中常说的闭包，通常指内部函数被保存到外部之后，仍然访问外层变量的情况。

## 10. 闭包的应用

### 保存私有状态

```js
function createCounter() {
  let count = 0

  return {
    increment() {
      count += 1
      return count
    },
    decrement() {
      count -= 1
      return count
    },
    getCount() {
      return count
    }
  }
}

const counter = createCounter()

counter.increment() // 1
counter.increment() // 2
counter.getCount() // 2
```

外部无法直接访问 `count`，只能通过返回的方法间接操作它。

### 函数柯里化

```js
function add(a) {
  return function (b) {
    return a + b
  }
}

const add10 = add(10)

add10(5) // 15
```

`add10` 保存了第一次调用时传入的 `a`。

### 缓存计算结果

```js
function createMemo() {
  const cache = new Map()

  return function memo(key, factory) {
    if (cache.has(key)) {
      return cache.get(key)
    }

    const value = factory()
    cache.set(key, value)
    return value
  }
}

const memo = createMemo()

const result = memo('user', () => ({ name: 'Tom' }))
```

`cache` 不暴露到外部，但每次调用 `memo` 时都能继续访问它。

### 防抖

防抖用于把短时间内频繁触发的操作合并成最后一次。

```js
function debounce(fn, delay) {
  let timer = null

  return function (...args) {
    clearTimeout(timer)

    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}
```

这里返回的函数通过闭包保存了 `timer`。

### 节流

节流用于限制函数在一段时间内最多执行一次。

```js
function throttle(fn, delay) {
  let lastTime = 0

  return function (...args) {
    const now = Date.now()

    if (now - lastTime < delay) {
      return
    }

    lastTime = now
    fn.apply(this, args)
  }
}
```

这里返回的函数通过闭包保存了 `lastTime`。

## 11. 闭包和循环

经典问题：

```js
for (var i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i)
  }, 0)
}

// 3
// 3
// 3
```

原因是 `var` 没有块级作用域，三个回调共享同一个 `i`。等回调执行时，循环已经结束，`i` 已经变成 `3`。

使用 `let` 可以得到预期结果：

```js
for (let i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i)
  }, 0)
}

// 0
// 1
// 2
```

`let` 会为每次循环创建新的块级作用域，因此每个回调保存的是不同的 `i`。

也可以用立即执行函数保存当次循环值：

```js
for (var i = 0; i < 3; i += 1) {
  ;(function (current) {
    setTimeout(() => {
      console.log(current)
    }, 0)
  })(i)
}
```

## 12. 闭包和内存

闭包会让外层变量的生命周期变长。只要内部函数还被引用，相关外层变量就不能被垃圾回收。

```js
function createReader() {
  const bigData = new Array(100000).fill('data')

  return function read(index) {
    return bigData[index]
  }
}

const read = createReader()

read(0)
```

这里 `bigData` 会被 `read` 持有。如果 `read` 一直存在，`bigData` 也会一直存在。

闭包不是内存泄漏。只有当不再需要的数据仍然被意外引用，导致无法回收时，才属于内存泄漏。

常见处理方式：

- 不要在闭包中保存不必要的大对象
- 不需要时解除引用
- 组件卸载时清理定时器、事件监听、订阅等

```js
let read = createReader()

read(0)

read = null
```

## 13. 手写 call / apply / bind

下面是为了理解原理的简化实现，不覆盖所有边界情况。

### call

```js
Function.prototype.myCall = function (context, ...args) {
  const target = context == null ? globalThis : Object(context)
  const key = Symbol('fn')

  target[key] = this
  const result = target[key](...args)

  delete target[key]
  return result
}
```

核心思路是把函数临时挂到对象上，通过对象方法调用来改变 `this`。

```js
function say(age) {
  return `${this.name}-${age}`
}

say.myCall({ name: 'Tom' }, 18) // Tom-18
```

### apply

```js
Function.prototype.myApply = function (context, args) {
  const target = context == null ? globalThis : Object(context)
  const key = Symbol('fn')

  target[key] = this
  const result = target[key](...(args || []))

  delete target[key]
  return result
}
```

`apply` 和 `call` 的主要区别是参数用数组传入。

```js
function say(age) {
  return `${this.name}-${age}`
}

say.myApply({ name: 'Tom' }, [18]) // Tom-18
```

### bind

```js
Function.prototype.myBind = function (context, ...boundArgs) {
  const fn = this

  function boundFn(...args) {
    const isNew = this instanceof boundFn
    const thisArg = isNew ? this : context

    return fn.apply(thisArg, [...boundArgs, ...args])
  }

  boundFn.prototype = Object.create(fn.prototype)

  return boundFn
}
```

`bind` 需要注意两点：

- 不会立即执行原函数，而是返回一个新函数
- 返回的新函数如果被 `new` 调用，`this` 应该指向新实例

```js
function User(name, age) {
  this.name = name
  this.age = age
}

const BoundUser = User.myBind({ name: 'Other' }, 'Tom')
const user = new BoundUser(18)

console.log(user.name) // Tom
console.log(user.age) // 18
```

## 14. 常见题目

### this 丢失

```js
const user = {
  name: 'Tom',
  sayHi() {
    console.log(this.name)
  }
}

setTimeout(user.sayHi, 0) // 通常不是 Tom
```

`setTimeout` 接收的是函数引用，真正调用时不是 `user.sayHi()`，所以 `this` 丢失。

可以用箭头函数保留调用关系：

```js
setTimeout(() => {
  user.sayHi()
}, 0)
```

也可以用 `bind` 固定 `this`：

```js
setTimeout(user.sayHi.bind(user), 0)
```

### 对象方法中的嵌套函数

```js
const user = {
  name: 'Tom',
  sayHi() {
    function inner() {
      console.log(this.name)
    }

    inner()
  }
}

user.sayHi() // 通常不是 Tom
```

`inner()` 是普通函数直接调用，`this` 不会自动继承 `sayHi` 的 `this`。

改成箭头函数即可使用外层 `this`：

```js
const user = {
  name: 'Tom',
  sayHi() {
    const inner = () => {
      console.log(this.name)
    }

    inner()
  }
}

user.sayHi() // Tom
```

### 作用域和 this 同时出现

```js
const name = 'global'

const user = {
  name: 'Tom',
  sayHi() {
    const name = 'local'

    console.log(name)
    console.log(this.name)
  }
}

user.sayHi()

// local
// Tom
```

`name` 是普通变量，按照作用域链查找；`this.name` 先确定 `this`，再从 `this` 指向的对象上取 `name`。

## 15. 总结

- 执行上下文是代码运行时的环境，函数每次调用都会创建新的函数执行上下文
- 调用栈负责管理执行上下文，遵循后进先出
- JavaScript 使用词法作用域，普通变量查找由函数定义位置决定
- 作用域链是变量从当前作用域向外层作用域逐级查找的路径
- 普通函数的 `this` 由调用方式决定，箭头函数的 `this` 来自外层作用域
- 闭包让函数在外层函数执行结束后，仍然可以访问外层变量
- 闭包常用于私有状态、缓存、柯里化、防抖、节流等场景
- 闭包会延长变量生命周期，但闭包本身不等于内存泄漏

## 导航

- 返回 [JavaScript 模块](../index.md)
