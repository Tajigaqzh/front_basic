# 05 函数

函数是 JavaScript 中最重要的概念之一。它可以把一段可重复执行的代码封装起来，并通过参数接收输入，通过返回值输出结果。

```js
function add(a, b) {
  return a + b
}

add(1, 2) // 3
```

在 JavaScript 中，函数也是一种值。它可以被赋值给变量、作为参数传递、作为返回值返回，也可以作为对象的方法。

```js
const fn = function () {
  return 'hello'
}

const list = [fn]

list[0]() // hello
```

## 函数的作用

函数主要解决两个问题：

- 复用代码：把重复逻辑封装起来
- 抽象逻辑：给一段行为起一个名字，让代码更容易理解

```js
function isAdult(age) {
  return age >= 18
}

if (isAdult(20)) {
  console.log('成年人')
}
```

比起直接写 `age >= 18`，`isAdult(age)` 的语义更清晰。

## 函数声明

函数声明是最常见的函数定义方式：

```js
function sayHi(name) {
  return `Hi, ${name}`
}

sayHi('Tom') // Hi, Tom
```

函数声明由几个部分组成：

```js
function 函数名(参数1, 参数2) {
  函数体
  return 返回值
}
```

示例：

```js
function max(a, b) {
  if (a > b) {
    return a
  }

  return b
}

max(10, 20) // 20
```

### 函数声明会提升

函数声明会被提升，所以可以在定义之前调用：

```js
sayHi('Tom') // Hi, Tom

function sayHi(name) {
  return `Hi, ${name}`
}
```

这里的提升不是把函数代码真的移动到文件顶部，而是 JavaScript 在执行前会先创建函数声明。

## 函数表达式

函数也可以作为表达式赋值给变量：

```js
const sayHi = function (name) {
  return `Hi, ${name}`
}

sayHi('Tom') // Hi, Tom
```

这种写法叫函数表达式。

函数表达式不会像函数声明一样整体提升：

```js
// sayHi('Tom') // ReferenceError

const sayHi = function (name) {
  return `Hi, ${name}`
}
```

因为 `const sayHi` 这个变量在初始化之前不能访问。

### 匿名函数和具名函数表达式

函数表达式可以是匿名函数。

```js
const fn = function () {
  return 'hello'
}
```

也可以是具名函数表达式：

```js
const fn = function sayHello() {
  return 'hello'
}
```

具名函数表达式的名字主要在函数内部或调试栈中有用：

```js
const factorial = function calc(n) {
  if (n <= 1) {
    return 1
  }

  return n * calc(n - 1)
}

factorial(5) // 120
```

外部通常仍然通过变量名调用：

```js
factorial(3)
// calc(3) // ReferenceError
```

## 箭头函数

箭头函数是 ES6 提供的更简洁的函数写法：

```js
const add = (a, b) => {
  return a + b
}

add(1, 2) // 3
```

如果函数体只有一个表达式，可以省略 `{}` 和 `return`：

```js
const add = (a, b) => a + b
```

如果只有一个参数，可以省略参数外层括号：

```js
const double = n => n * 2
```

没有参数时，括号不能省略：

```js
const getName = () => 'Tom'
```

### 返回对象字面量

箭头函数直接返回对象时，需要用小括号包起来：

```js
const createUser = (name) => ({ name })

createUser('Tom') // { name: 'Tom' }
```

如果不加小括号，`{}` 会被理解成函数体：

```js
const createUser = (name) => {
  name
}

createUser('Tom') // undefined
```

### 箭头函数没有自己的 this

箭头函数不会创建自己的 `this`，它的 `this` 来自外层作用域。

```js
const user = {
  name: 'Tom',
  sayHi() {
    const fn = () => {
      return this.name
    }

    return fn()
  }
}

user.sayHi() // Tom
```

普通函数的 `this` 取决于调用方式：

```js
const user = {
  name: 'Tom',
  sayHi: function () {
    return this.name
  }
}

user.sayHi() // Tom
```

但是把方法拿出来单独调用，`this` 就可能丢失：

```js
const fn = user.sayHi

fn() // 严格模式下通常是 TypeError 或 undefined
```

### 箭头函数不适合做对象方法

对象方法通常不要写成箭头函数：

```js
const user = {
  name: 'Tom',
  sayHi: () => {
    return this.name
  }
}

user.sayHi() // 通常不是 Tom
```

因为箭头函数没有自己的 `this`，这里的 `this` 不会指向 `user`。

更推荐写成普通方法：

```js
const user = {
  name: 'Tom',
  sayHi() {
    return this.name
  }
}
```

## 参数

函数可以通过参数接收外部传入的数据。

```js
function greet(name, age) {
  return `${name} is ${age} years old`
}

greet('Tom', 18) // Tom is 18 years old
```

### 参数和实参

定义函数时写的变量叫形参：

```js
function add(a, b) {
  return a + b
}
```

调用函数时传入的值叫实参：

```js
add(1, 2)
```

其中 `a`、`b` 是形参，`1`、`2` 是实参。

### 参数数量不匹配

JavaScript 不强制要求实参数量和形参数量一致。

实参少了，缺失的参数值是 `undefined`：

```js
function add(a, b) {
  return a + b
}

add(1) // NaN
```

实参多了，多出来的参数不会报错：

```js
function add(a, b) {
  return a + b
}

add(1, 2, 3) // 3
```

### 默认参数

可以给参数设置默认值：

```js
function createUser(name, role = 'user') {
  return {
    name,
    role
  }
}

createUser('Tom') // { name: 'Tom', role: 'user' }
createUser('Tom', 'admin') // { name: 'Tom', role: 'admin' }
```

默认参数只在实参是 `undefined` 时生效：

```js
function fn(value = 10) {
  return value
}

fn(undefined) // 10
fn(null) // null
fn(0) // 0
```

### 剩余参数

剩余参数使用 `...` 收集多余参数，得到的是一个真正的数组：

```js
function sum(...nums) {
  return nums.reduce((total, item) => total + item, 0)
}

sum(1, 2, 3) // 6
```

剩余参数必须放在最后：

```js
function fn(first, ...rest) {
  return rest
}

fn(1, 2, 3) // [2, 3]
```

### arguments

普通函数内部有一个 `arguments` 对象，可以拿到调用时传入的所有参数：

```js
function sum() {
  let total = 0

  for (const item of arguments) {
    total += item
  }

  return total
}

sum(1, 2, 3) // 6
```

`arguments` 是类数组对象，不是真正的数组。现代代码中更推荐使用剩余参数：

```js
function sum(...nums) {
  return nums.reduce((total, item) => total + item, 0)
}
```

箭头函数没有自己的 `arguments`：

```js
const fn = () => {
  // arguments 来自外层，不是这个箭头函数自己的参数对象
}
```

## 返回值

函数使用 `return` 返回结果：

```js
function add(a, b) {
  return a + b
}

const result = add(1, 2)

result // 3
```

如果没有 `return`，函数默认返回 `undefined`：

```js
function sayHi() {
  console.log('hi')
}

sayHi() // undefined
```

`return` 会立即结束函数执行：

```js
function getPrice(type) {
  if (type === 'vip') {
    return 80
  }

  return 100
}

getPrice('vip') // 80
```

### return 换行问题

`return` 后面不要随便换行，因为 JavaScript 会自动插入分号：

```js
function createUser() {
  return
  {
    name: 'Tom'
  }
}

createUser() // undefined
```

正确写法：

```js
function createUser() {
  return {
    name: 'Tom'
  }
}
```

## 函数也是对象

JavaScript 函数本质上也是对象，因此函数可以拥有属性。

```js
function sayHi() {}

sayHi.count = 1

sayHi.count // 1
```

函数常见的内置属性有：

| 属性 | 说明 |
| --- | --- |
| `name` | 函数名 |
| `length` | 函数形参个数，不包含剩余参数 |

```js
function add(a, b) {
  return a + b
}

add.name // add
add.length // 2
```

箭头函数也有 `name` 和 `length`：

```js
const double = (n) => n * 2

double.name // double
double.length // 1
```

## 函数调用方式

同一个函数，用不同方式调用，`this` 可能不同。

### 普通调用

```js
function sayHi() {
  return this
}

sayHi()
```

在严格模式下，普通函数调用时 `this` 是 `undefined`。非严格模式下，浏览器中通常是 `window`。

### 方法调用

函数作为对象属性调用时，`this` 指向调用它的对象：

```js
const user = {
  name: 'Tom',
  sayHi() {
    return this.name
  }
}

user.sayHi() // Tom
```

重点是调用点左边是谁：

```js
const admin = {
  name: 'Admin',
  sayHi: user.sayHi
}

admin.sayHi() // Admin
```

### 构造函数调用

函数可以配合 `new` 调用，作为构造函数创建对象：

```js
function User(name) {
  this.name = name
}

const user = new User('Tom')

user.name // Tom
```

构造函数通常首字母大写。

如果只是普通函数，不要随意使用 `new`。现代代码中，创建对象类型更推荐使用 `class`，后续类章节会单独讲。

### call、apply、bind

`call()`、`apply()`、`bind()` 可以显式指定函数执行时的 `this`。

```js
function sayHi(prefix) {
  return `${prefix}, ${this.name}`
}

const user = { name: 'Tom' }

sayHi.call(user, 'Hi') // Hi, Tom
```

`apply()` 和 `call()` 类似，只是参数用数组传入：

```js
sayHi.apply(user, ['Hello']) // Hello, Tom
```

`bind()` 不会立即执行函数，而是返回一个绑定好 `this` 的新函数：

```js
const fn = sayHi.bind(user)

fn('Hi') // Hi, Tom
```

对比：

| 方法 | 是否立即执行 | 参数形式 | 返回值 |
| --- | --- | --- | --- |
| `call()` | 是 | 一个个传 | 函数执行结果 |
| `apply()` | 是 | 数组传 | 函数执行结果 |
| `bind()` | 否 | 一个个传 | 新函数 |

## 作用域

函数会创建自己的作用域。函数内部定义的变量，外部不能直接访问。

```js
function fn() {
  const message = 'hello'
}

// console.log(message) // ReferenceError
```

函数内部可以访问外部变量：

```js
const name = 'Tom'

function sayHi() {
  return `Hi, ${name}`
}

sayHi() // Hi, Tom
```

如果内部和外部有同名变量，内部变量会覆盖外部变量：

```js
const name = 'Tom'

function sayHi() {
  const name = 'Jerry'
  return name
}

sayHi() // Jerry
```

这里的“覆盖”指的是查找变量时，内部作用域的变量优先被找到，外层同名变量不会被改掉。

## 闭包

闭包是指函数可以记住并访问它定义时所在的作用域。

```js
function createCounter() {
  let count = 0

  return function () {
    count += 1
    return count
  }
}

const counter = createCounter()

counter() // 1
counter() // 2
counter() // 3
```

`createCounter()` 执行结束后，内部变量 `count` 没有立刻消失，因为返回出去的函数仍然在使用它。

闭包常见用途：

- 保存私有状态
- 封装函数工厂
- 缓存计算结果
- 实现防抖、节流等工具函数

### 闭包保存私有状态

```js
function createUser(name) {
  let score = 0

  return {
    getName() {
      return name
    },
    addScore(value) {
      score += value
    },
    getScore() {
      return score
    }
  }
}

const user = createUser('Tom')

user.addScore(10)
user.getScore() // 10
```

外部不能直接访问 `score`，只能通过返回的方法间接操作。

## 高阶函数

高阶函数是指满足下面任意一个条件的函数：

- 接收函数作为参数
- 返回一个函数

数组里的很多方法都是高阶函数：

```js
const nums = [1, 2, 3]

const result = nums.map((item) => item * 2)

result // [2, 4, 6]
```

这里 `map()` 接收了一个函数作为参数，所以它是高阶函数。

### 函数作为参数

```js
function calculate(a, b, handler) {
  return handler(a, b)
}

calculate(1, 2, (a, b) => a + b) // 3
calculate(1, 2, (a, b) => a * b) // 2
```

通过传入不同函数，可以让同一个 `calculate()` 执行不同逻辑。

### 函数作为返回值

```js
function createMultiplier(n) {
  return function (value) {
    return value * n
  }
}

const double = createMultiplier(2)
const triple = createMultiplier(3)

double(10) // 20
triple(10) // 30
```

这种写法常用于创建带有固定配置的函数。

## 纯函数

纯函数是指满足两个条件的函数：

- 相同输入一定得到相同输出
- 不修改外部状态，也不产生副作用

```js
function add(a, b) {
  return a + b
}
```

这是纯函数。

下面这个不是纯函数，因为它修改了外部变量：

```js
let total = 0

function addToTotal(value) {
  total += value
  return total
}
```

下面这个也不是纯函数，因为它修改了传入对象：

```js
function addAge(user) {
  user.age += 1
  return user
}
```

更推荐返回新对象：

```js
function addAge(user) {
  return {
    ...user,
    age: user.age + 1
  }
}
```

纯函数更容易测试、复用和组合。

## 递归函数

函数可以调用自己，这叫递归。

```js
function factorial(n) {
  if (n <= 1) {
    return 1
  }

  return n * factorial(n - 1)
}

factorial(5) // 120
```

递归必须有结束条件，否则会无限调用，最终导致调用栈溢出。

```js
function fn() {
  return fn()
}

// fn() // RangeError: Maximum call stack size exceeded
```

递归适合处理树形结构、嵌套结构等问题。

```js
const tree = {
  name: 'root',
  children: [
    { name: 'a', children: [] },
    {
      name: 'b',
      children: [{ name: 'b-1', children: [] }]
    }
  ]
}

function collectNames(node) {
  const result = [node.name]

  for (const child of node.children) {
    result.push(...collectNames(child))
  }

  return result
}

collectNames(tree) // ['root', 'a', 'b', 'b-1']
```

## 立即执行函数

立即执行函数表达式，英文是 IIFE：Immediately Invoked Function Expression。

```js
(function () {
  const message = 'hello'
  console.log(message)
})()
```

它的特点是定义后立即执行，常用于创建独立作用域。

```js
const result = (function () {
  const a = 1
  const b = 2

  return a + b
})()

result // 3
```

在早期没有 `let`、`const`、模块系统时，IIFE 经常用来避免变量污染全局作用域。现代项目中使用频率降低了，但理解它有助于阅读老代码。

## 函数柯里化

柯里化是把接收多个参数的函数，转换成一层层接收单个参数的函数。

普通写法：

```js
function add(a, b, c) {
  return a + b + c
}

add(1, 2, 3) // 6
```

柯里化写法：

```js
function add(a) {
  return function (b) {
    return function (c) {
      return a + b + c
    }
  }
}

add(1)(2)(3) // 6
```

可以用箭头函数写得更简洁：

```js
const add = (a) => (b) => (c) => a + b + c
```

柯里化的用途不是为了炫技，而是为了提前固定一部分参数。

```js
const createChecker = (min) => (value) => value >= min

const isAdult = createChecker(18)

isAdult(20) // true
isAdult(16) // false
```

## 防抖和节流

防抖和节流是高频事件处理中的常见函数工具。

### 防抖 debounce

防抖的含义是：事件频繁触发时，只在最后一次触发结束后执行。

常见场景：

- 搜索框输入联想
- 窗口大小变化后重新计算布局
- 表单输入校验

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

使用：

```js
const onInput = debounce(function (value) {
  console.log(value)
}, 300)

onInput('a')
onInput('ab')
onInput('abc')
```

上面连续调用时，只有最后一次会在 `300ms` 后执行。

### 节流 throttle

节流的含义是：事件频繁触发时，固定时间内最多执行一次。

常见场景：

- 滚动事件
- 鼠标移动事件
- 按钮连续点击限制

```js
function throttle(fn, delay) {
  let lastTime = 0

  return function (...args) {
    const now = Date.now()

    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}
```

使用：

```js
const onScroll = throttle(function () {
  console.log('scroll')
}, 300)
```

防抖关注“最后一次”，节流关注“固定频率”。

## 常见选择建议

### 函数声明还是函数表达式

如果是普通工具函数，函数声明清晰直观：

```js
function formatDate(date) {
  return String(date)
}
```

如果函数需要作为值传递、作为回调、或者希望和变量初始化保持一致，可以使用函数表达式或箭头函数：

```js
const formatDate = (date) => String(date)
```

### 普通函数还是箭头函数

适合使用箭头函数的场景：

- 简短回调
- 数组方法里的处理函数
- 不需要自己的 `this`

```js
const result = [1, 2, 3].map((item) => item * 2)
```

适合使用普通函数的场景：

- 对象方法
- 构造函数
- 需要 `arguments`
- 需要通过 `call()`、`apply()`、`bind()` 改变 `this`

```js
const user = {
  name: 'Tom',
  sayHi() {
    return this.name
  }
}
```

## 常见错误

### 忘记 return

```js
const result = [1, 2, 3].map((item) => {
  item * 2
})

result // [undefined, undefined, undefined]
```

正确写法：

```js
const result = [1, 2, 3].map((item) => {
  return item * 2
})
```

或者：

```js
const result = [1, 2, 3].map((item) => item * 2)
```

### this 丢失

```js
const user = {
  name: 'Tom',
  sayHi() {
    return this.name
  }
}

const fn = user.sayHi

fn() // this 丢失
```

可以使用 `bind()` 固定 `this`：

```js
const fn = user.sayHi.bind(user)

fn() // Tom
```

### 把箭头函数当构造函数

箭头函数不能作为构造函数使用：

```js
const User = (name) => {
  this.name = name
}

// new User('Tom') // TypeError
```

需要构造函数时，使用普通函数或 `class`：

```js
function User(name) {
  this.name = name
}

const user = new User('Tom')
```

## 小结

- 函数用来封装可复用逻辑
- 函数声明会提升，函数表达式不会整体提升
- 箭头函数写法简洁，但没有自己的 `this` 和 `arguments`
- 参数可以设置默认值，也可以使用剩余参数收集多个值
- 没有 `return` 的函数默认返回 `undefined`
- 函数也是对象，可以有 `name`、`length` 等属性
- 普通函数的 `this` 取决于调用方式
- `call()`、`apply()`、`bind()` 可以显式指定 `this`
- 闭包可以让函数记住定义时的作用域
- 高阶函数可以接收函数或返回函数
- 防抖关注最后一次触发，节流关注固定频率执行

## 导航

- 返回 [JavaScript 模块](../index.md)
