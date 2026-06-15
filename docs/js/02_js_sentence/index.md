# 02 语句

这个目录用于整理 JavaScript 条件语句、循环语句和控制流。

## 条件语句

条件语句用于根据条件决定执行哪一段代码。

### if

`if` 会先判断括号里的表达式是否为真值，如果是真值，就执行代码块：

```js
const age = 18

if (age >= 18) {
  console.log('成年')
}
```

### if...else

`if...else` 用于二选一：

```js
const age = 16

if (age >= 18) {
  console.log('成年')
} else {
  console.log('未成年')
}
```

### if...else if...else

多个条件可以使用 `else if`：

```js
const score = 85

if (score >= 90) {
  console.log('优秀')
} else if (score >= 60) {
  console.log('及格')
} else {
  console.log('不及格')
}
```

条件语句判断的是真假值，不要求条件本身一定是布尔值：

```js
const name = ''

if (name) {
  console.log(name)
} else {
  console.log('匿名')
}
```

## switch 语句

`switch` 用于把一个表达式和多个分支进行匹配。

```js
const type = 'success'

switch (type) {
  case 'success':
    console.log('成功')
    break
  case 'error':
    console.log('失败')
    break
  default:
    console.log('未知状态')
}
```

`switch` 使用的是严格相等比较，类似 `===`：

```js
const value = '1'

switch (value) {
  case 1:
    console.log('number 1')
    break
  case '1':
    console.log('string 1')
    break
}
// string 1
```

`break` 用来结束当前 `switch`。如果没有 `break`，代码会继续执行后面的 `case`，这种行为叫贯穿：

```js
const value = 1

switch (value) {
  case 1:
    console.log('one')
  case 2:
    console.log('two')
  default:
    console.log('default')
}
// one
// two
// default
```

如果多个分支逻辑相同，可以故意利用贯穿：

```js
const day = 6

switch (day) {
  case 6:
  case 7:
    console.log('周末')
    break
  default:
    console.log('工作日')
}
```

简单记法：`switch` 适合一个值对应多个固定分支；每个 `case` 通常都要写 `break`。

## 循环语句

循环语句用于重复执行一段代码。

### for 循环

`for` 循环通常用于已知循环次数的场景：

```js
for (let i = 0; i < 3; i++) {
  console.log(i)
}
// 0
// 1
// 2
```

`for` 语句由三部分组成：

```js
for (初始化; 条件; 更新) {
  // 循环体
}
```

执行顺序：

1. 执行初始化语句
2. 判断循环条件
3. 条件为真，执行循环体
4. 执行更新语句
5. 回到第 2 步

遍历数组时常见写法：

```js
const list = ['a', 'b', 'c']

for (let i = 0; i < list.length; i++) {
  console.log(i, list[i])
}
```

### for...of

`for...of` 用于遍历可迭代对象的值。

数组、字符串、`Map`、`Set` 都可以使用 `for...of`：

```js
const list = ['a', 'b', 'c']

for (const item of list) {
  console.log(item)
}
// a
// b
// c
```

遍历字符串：

```js
for (const char of 'hello') {
  console.log(char)
}
```

遍历 `Map`：

```js
const map = new Map([
  ['name', 'Tom'],
  ['age', 18]
])

for (const [key, value] of map) {
  console.log(key, value)
}
```

`for...of` 的底层依赖对象的 `Symbol.iterator` 方法。

### for...in

`for...in` 用于遍历对象的可枚举属性名。

```js
const user = {
  name: 'Tom',
  age: 18
}

for (const key in user) {
  console.log(key, user[key])
}
// name Tom
// age 18
```

`for...in` 会遍历可枚举的字符串属性名，包括原型链上的可枚举属性：

```js
const parent = {
  role: 'admin'
}

const user = Object.create(parent)
user.name = 'Tom'

for (const key in user) {
  console.log(key)
}
// name
// role
```

如果只想处理对象自身属性，可以配合 `Object.hasOwn()`：

```js
for (const key in user) {
  if (Object.hasOwn(user, key)) {
    console.log(key)
  }
}
```

## for...in 和 for...of 的区别

| 对比项 | `for...in` | `for...of` |
| --- | --- | --- |
| 遍历内容 | 属性名，也就是 key | 值，也就是 value |
| 主要用途 | 遍历对象属性 | 遍历可迭代对象的值 |
| 适用对象 | 普通对象、数组等 | 数组、字符串、Map、Set 等可迭代对象 |
| 是否遍历原型链 | 会遍历原型链上的可枚举属性 | 不会按原型链枚举属性 |
| 是否依赖 `Symbol.iterator` | 不依赖 | 依赖 |
| 遍历数组时 | 得到索引字符串 | 得到数组元素 |

数组示例：

```js
const arr = ['a', 'b', 'c']

for (const key in arr) {
  console.log(key)
}
// 0
// 1
// 2

for (const value of arr) {
  console.log(value)
}
// a
// b
// c
```

对象示例：

```js
const user = {
  name: 'Tom',
  age: 18
}

for (const key in user) {
  console.log(key)
}
// name
// age

for (const value of user) {
  console.log(value)
}
// TypeError: user is not iterable
```

简单记法：`for...in` 遍历 key，适合对象；`for...of` 遍历 value，适合数组、字符串、Map、Set。

## 控制流语句

控制流语句用于改变代码的执行顺序。

### break

`break` 用于结束当前循环或 `switch`：

```js
for (let i = 0; i < 5; i++) {
  if (i === 3) {
    break
  }

  console.log(i)
}
// 0
// 1
// 2
```

### continue

`continue` 用于跳过本次循环，继续下一次循环：

```js
for (let i = 0; i < 5; i++) {
  if (i === 2) {
    continue
  }

  console.log(i)
}
// 0
// 1
// 3
// 4
```

### return

`return` 用于结束函数执行，并返回一个值：

```js
function add(a, b) {
  return a + b
}

add(1, 2) // 3
```

`return` 后面的代码不会继续执行：

```js
function fn() {
  return 'done'

  console.log('不会执行')
}
```

如果没有写返回值，默认返回 `undefined`：

```js
function fn() {
  return
}

fn() // undefined
```

### yield

`yield` 用于生成器函数，可以暂停函数执行，并向外产出一个值。

生成器函数使用 `function*` 声明：

```js
function* createId() {
  yield 1
  yield 2
  yield 3
}

const iterator = createId()

iterator.next() // { value: 1, done: false }
iterator.next() // { value: 2, done: false }
iterator.next() // { value: 3, done: false }
iterator.next() // { value: undefined, done: true }
```

生成器对象是可迭代对象，所以可以使用 `for...of`：

```js
for (const id of createId()) {
  console.log(id)
}
// 1
// 2
// 3
```

简单记法：`yield` 会暂停生成器函数，下一次调用 `next()` 时再继续执行。

### throw

`throw` 用于主动抛出异常：

```js
function divide(a, b) {
  if (b === 0) {
    throw new Error('除数不能为 0')
  }

  return a / b
}
```

抛出的异常如果没有被捕获，会中断程序执行。

## try...catch...finally

`try...catch...finally` 用于处理异常。

```js
try {
  JSON.parse('{name: Tom}')
} catch (error) {
  console.log('解析失败')
} finally {
  console.log('无论成功失败都会执行')
}
```

| 语句 | 作用 |
| --- | --- |
| `try` | 放可能出错的代码 |
| `catch` | 捕获并处理错误 |
| `finally` | 无论是否出错，最后都会执行 |

`catch` 可以拿到错误对象：

```js
try {
  throw new Error('出错了')
} catch (error) {
  console.log(error.message) // "出错了"
}
```

`finally` 常用于清理资源、关闭状态、恢复标记：

```js
let loading = true

try {
  requestData()
} catch (error) {
  console.log(error)
} finally {
  loading = false
}
```

需要注意：如果 `finally` 中有 `return` 或 `throw`，可能覆盖 `try` 或 `catch` 中的结果：

```js
function fn() {
  try {
    return 1
  } finally {
    return 2
  }
}

fn() // 2
```

实际开发中不建议在 `finally` 中写 `return`。

## with 语句

`with` 可以临时把一个对象放到作用域链前面，让访问属性时省略对象名：

```js
const user = {
  name: 'Tom',
  age: 18
}

with (user) {
  console.log(name)
  console.log(age)
}
```

`with` 的问题是变量来源不清晰：

```js
const user = {
  name: 'Tom'
}

const age = 18

with (user) {
  console.log(name) // 来自 user.name
  console.log(age) // 来自外层作用域
}
```

严格模式下禁止使用 `with`：

```js
'use strict'

with ({ name: 'Tom' }) {
  console.log(name)
}
// SyntaxError
```

现代 JavaScript 中应避免使用 `with`，直接写对象名或使用解构更清晰：

```js
const { name, age } = user

console.log(name)
console.log(age)
```

## use strict

`"use strict"` 用于开启严格模式。

严格模式会让 JavaScript 使用更严格的语法和运行规则，帮助提前发现错误。

可以在整个脚本顶部开启：

```js
'use strict'

name = 'Tom' // ReferenceError
```

也可以只在函数内部开启：

```js
function fn() {
  'use strict'

  name = 'Tom' // ReferenceError
}
```

严格模式常见影响：

| 行为 | 非严格模式 | 严格模式 |
| --- | --- | --- |
| 给未声明变量赋值 | 创建全局变量 | 抛出 `ReferenceError` |
| 删除普通变量 | 通常返回 `false` | 抛出语法错误 |
| 使用 `with` | 允许 | 抛出语法错误 |
| 函数中普通调用的 `this` | 指向全局对象 | `undefined` |
| 重复参数名 | 部分环境允许 | 抛出语法错误 |

示例：

```js
function fn() {
  'use strict'

  console.log(this)
}

fn() // undefined
```

ES Module 默认就是严格模式，不需要额外写 `"use strict"`：

```js
// module.js
console.log(this) // undefined
```

简单记法：严格模式会让 JavaScript 少一些“自动兜底”，更多错误会直接暴露出来。现代代码通常默认使用严格模式或 ES Module。

## 导航

- 返回 [JavaScript 模块](../index.md)
