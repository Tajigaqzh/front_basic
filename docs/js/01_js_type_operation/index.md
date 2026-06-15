# 01 基础语法

这个目录表示 JavaScript 类型、表达式、操作符、语句等简单语法内容的总和。

## 分号前置

• “分号前置”通常指 JavaScript/TypeScript 里在一行开头写 ;，例如：

;(function () {
// ...
})()

主要用于防止上一句没有分号时，当前语句被错误地接到上一句后面。

常见需要分号前置的情况是：新语句以这些符号开头：
(
[
/
+
-
`

最常见的是这几类：
```js
const a = foo()
;(function () {})()
```


如果没有前置分号，可能被解析成：

```js
const a = foo()(function () {})()
```

再比如数组开头：

```js
const value = getValue()
;[1, 2, 3].forEach(console.log)
```

如果没有分号，可能被解析成：
```js
const value = getValue()[1, 2, 3].forEach(console.log)
```

常见场景：

1. 写立即执行函数 IIFE：

```js
;(function () {
console.log('init')
})()
```

2. 一行以数组字面量开头：

```js
;[a, b, c].forEach(fn)
```

3. 一行以括号表达式开头：

```js
;(condition ? fn1 : fn2)()
```

4. 打包、拼接多个 JS 文件时，防止前一个文件末尾没分号：

```js
;(() => {
// module code
})()
```

简单记法：如果项目不强制每句结尾写分号，那么当新语句以 ( 或 [ 开头时，最好加前置分号。


## 可补充内容

- 数据类型
- 表达式
- 操作符
- 条件语句与循环语句
- 类型转换
- 相等性比较

## 导航

- 返回 [JavaScript 模块](../index.md)
### 原始类型

JavaScript 中有 7 种原始数据类型：

| 数据类型 | 示例 | 说明 | `typeof` 结果 |
| --- | --- | --- | --- |
| `undefined` | `let a` | 表示变量已声明但未赋值 | `"undefined"` |
| `null` | `let a = null` | 表示空值，通常用于主动表示“没有对象”或“没有值” | `"object"` |
| `boolean` | `true` / `false` | 布尔值，常用于条件判断 | `"boolean"` |
| `number` | `1`、`3.14`、`NaN`、`Infinity` | 数字类型，整数和小数都属于 `number` | `"number"` |
| `bigint` | `123n` | 大整数类型，用于表示超过安全整数范围的整数 | `"bigint"` |
| `string` | `"hello"`、`'abc'`、`` `hi` `` | 字符串类型，用于表示文本 | `"string"` |
| `symbol` | `Symbol("id")` | 表示唯一值，常用于对象属性的唯一标识 | `"symbol"` |

`object` 不是原始类型，是引用类型。对象、数组、日期等都属于对象：

| 数据类型 | 示例 | 说明 | `typeof` 结果 |
| --- | --- | --- | --- |
| `object` | `{}`、`[]`、`new Date()` | 引用类型，用于存储复杂数据结构 | `"object"` |
| `function` | `function fn() {}` | 函数本质上也是对象，但 `typeof` 会单独返回 | `"function"` |

`typeof null` 返回 `"object"`，这是 JavaScript 的历史遗留问题，但 `null` 仍然是原始类型。

### Symbol

`Symbol` 是 ES6 新增的原始数据类型，用来创建唯一值：

```js
const s1 = Symbol()
const s2 = Symbol()

s1 === s2 // false
typeof s1 // "symbol"
```

即使传入相同的描述，两个 `Symbol()` 也不相等：

```js
const s1 = Symbol('id')
const s2 = Symbol('id')

s1 === s2 // false
```

`Symbol('id')` 里的 `'id'` 只是描述信息，方便调试，不参与相等性比较：

```js
const id = Symbol('id')

String(id) // "Symbol(id)"
id.description // "id"
```

`Symbol` 常用于创建对象的唯一属性名，避免和普通字符串属性名冲突：

```js
const id = Symbol('id')

const user = {
  name: 'Tom',
  [id]: 1001
}

user[id] // 1001
```

`Symbol` 属性不会被 `Object.keys()`、`for...in` 枚举出来：

```js
Object.keys(user) // ['name']

for (const key in user) {
  console.log(key)
}
// name
```

如果要获取对象上的 `Symbol` 属性，可以使用 `Object.getOwnPropertySymbols()`：

```js
Object.getOwnPropertySymbols(user) // [Symbol(id)]
Reflect.ownKeys(user) // ['name', Symbol(id)]
```

`Symbol()` 不能使用 `new` 调用，因为它是原始值，不是构造函数：

```js
Symbol('id') // 正确
new Symbol('id') // TypeError
```

### Symbol.for

`Symbol.for(key)` 会在全局 Symbol 注册表中查找指定 key：

1. 如果存在，就返回已有的 Symbol
2. 如果不存在，就创建一个新的 Symbol 并放入注册表

```js
const s1 = Symbol.for('id')
const s2 = Symbol.for('id')

s1 === s2 // true
```

这和 `Symbol()` 不同：

```js
Symbol('id') === Symbol('id') // false
Symbol.for('id') === Symbol.for('id') // true
```

`Symbol.keyFor()` 可以获取全局注册表中 Symbol 对应的 key：

```js
const id = Symbol.for('id')

Symbol.keyFor(id) // "id"
```

普通 `Symbol()` 创建的值不在全局注册表中，所以拿不到 key：

```js
const id = Symbol('id')

Symbol.keyFor(id) // undefined
```

`Symbol.keyFor()` 查找的是全局 Symbol 注册表，不是 Symbol 的描述信息：

```js
const s1 = Symbol('id')
const s2 = Symbol.for('id')

s1.description // "id"
s2.description // "id"

Symbol.keyFor(s1) // undefined
Symbol.keyFor(s2) // "id"
```

如果传入的不是 Symbol，会报错：

```js
Symbol.keyFor('id') // TypeError
```

所以 `description` 和 `Symbol.keyFor()` 的区别是：

| 写法 | 作用 | 适用范围 |
| --- | --- | --- |
| `symbol.description` | 获取 Symbol 的描述文本 | 普通 Symbol 和全局 Symbol 都可以 |
| `Symbol.keyFor(symbol)` | 获取全局 Symbol 注册表中的 key | 只适用于 `Symbol.for()` 创建或获取的 Symbol |

简单记法：`Symbol()` 每次都创建唯一值；`Symbol.for(key)` 会按 key 复用同一个 Symbol。

### Symbol.iterator

`Symbol.iterator` 是 JavaScript 内置的知名 Symbol，用来定义对象的默认迭代器。

一个对象只要实现了 `[Symbol.iterator]()` 方法，就可以被 `for...of` 遍历，也可以被展开运算符 `...`、`Array.from()` 使用：

```js
const arr = [1, 2, 3]

typeof arr[Symbol.iterator] // "function"

for (const item of arr) {
  console.log(item)
}
```

字符串、数组、Map、Set 都默认实现了 `Symbol.iterator`：

```js
Array.from('abc') // ['a', 'b', 'c']
Array.from(new Set([1, 2, 3])) // [1, 2, 3]
```

普通对象默认没有实现 `Symbol.iterator`，所以不能直接 `for...of`：

```js
const user = { name: 'Tom', age: 18 }

for (const item of user) {
  console.log(item)
}
// TypeError: user is not iterable
```

可以手动给对象添加 `[Symbol.iterator]()`：

```js
const range = {
  start: 1,
  end: 3,
  [Symbol.iterator]() {
    let current = this.start
    const end = this.end

    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false }
        }

        return { value: undefined, done: true }
      }
    }
  }
}

Array.from(range) // [1, 2, 3]
```

迭代器对象的 `next()` 方法每次返回一个对象：

| 属性 | 含义 |
| --- | --- |
| `value` | 当前迭代出来的值 |
| `done` | 是否已经迭代结束 |

除了 `Symbol.iterator`，JavaScript 还有一些内置的知名 Symbol，用来改变对象在语言内部操作中的行为：

| Symbol | 作用 |
| --- | --- |
| `Symbol.iterator` | 定义对象如何被迭代 |
| `Symbol.toStringTag` | 改变 `Object.prototype.toString.call(value)` 的结果 |
| `Symbol.toPrimitive` | 定义对象转原始值时的行为 |
| `Symbol.hasInstance` | 自定义 `instanceof` 的判断逻辑 |
| `Symbol.match` | 自定义对象在 `String.prototype.match()` 中的行为 |

简单记法：`Symbol.iterator` 决定一个对象能不能被 `for...of`、`...`、`Array.from()` 当作“可迭代对象”使用。

### 判断 NaN

`NaN` 表示 Not a Number，属于 `number` 类型：

```js
typeof NaN // "number"
```

判断一个值是不是 `NaN`，推荐使用 `Number.isNaN()`：

```js
Number.isNaN(NaN) // true
Number.isNaN(1) // false
Number.isNaN('abc') // false
Number.isNaN(undefined) // false
```

不要用 `value === NaN` 判断，因为 `NaN` 是 JavaScript 中唯一一个不等于自身的值：

```js
NaN === NaN // false
```

也可以利用这个特点判断：

```js
const value = NaN

value !== value // true
```

但这种写法可读性较差，实际开发中更推荐 `Number.isNaN(value)`。

全局方法 `isNaN()` 会先把参数转换成数字，再判断转换后的结果是不是 `NaN`，所以容易出现误判：

```js
isNaN('abc') // true，因为 Number('abc') 是 NaN
Number.isNaN('abc') // false，因为 'abc' 本身不是 NaN
```

### null和undefined区别

`null` 和 `undefined` 都可以表示“没有值”，但语义不同：

| 类型 | 含义 | 常见来源 | `typeof` 结果 |
| --- | --- | --- | --- |
| `null` | 主动赋值为空，表示这里本来应该有值，但现在没有 | 开发者手动赋值 | `"object"` |
| `undefined` | 默认的缺失值，表示还没有被赋值或没有拿到值 | JavaScript 自动产生 | `"undefined"` |

`null` 常用于主动清空一个变量，或者表示某个对象暂时不存在：

```js
let user = null
```

`undefined` 常见出现场景：

1. 声明变量但未赋值
2. 访问对象中不存在的属性
3. 函数定义了形参，但调用时未传参
4. 函数没有明确的返回值

```js
let name
typeof name // "undefined"

const user = {}
user.age // undefined

function fn(value) {
  return value
}

fn() // undefined
```

简单记法：`null` 通常是“我主动设置为空”，`undefined` 通常是“系统默认没有值”。

### 字符、码点和 JS 字符串

理解 JS 字符串时，需要区分三个概念：

| 概念 | 含义 | 示例 |
| --- | --- | --- |
| 字符 | 人眼看到的一个文字或符号 | `a`、`中`、`😊` |
| 码点 | Unicode 给每个字符分配的编号，通常写成 `U+xxxx` | `A` 的码点是 `U+0041` |
| 码元 | 字符串底层存储时使用的编码单元 | JS 字符串使用 UTF-16 码元 |

JS 字符串使用 UTF-16 存储，`length` 统计的是 UTF-16 码元数量，不一定是人眼看到的字符数量：

```js
'a'.length // 1
'中'.length // 1
'😊'.length // 2
'𠮷'.length // 2
```

原因是 `😊`、`𠮷` 这类字符的 Unicode 码点超过了 `U+FFFF`，在 UTF-16 中需要用两个码元表示，这两个码元叫代理对。

常见字符串 API 的区别：

| API | 作用 | 返回内容 |
| --- | --- | --- |
| `charCodeAt(index)` | 获取指定位置的 UTF-16 码元 | 码元值 |
| `codePointAt(index)` | 获取指定位置开始的 Unicode 码点 | 码点值 |
| `String.fromCharCode(value)` | 根据 UTF-16 码元创建字符串 | 字符串 |
| `String.fromCodePoint(value)` | 根据 Unicode 码点创建字符串 | 字符串 |

```js
'😊'.charCodeAt(0).toString(16) // "d83d"
'😊'.charCodeAt(1).toString(16) // "de0a"
'😊'.codePointAt(0).toString(16) // "1f60a"

String.fromCharCode(0x1f60a) // 不能正确生成 😊
String.fromCodePoint(0x1f60a) // "😊"
```

遍历字符串时，`for...of` 和 `Array.from()` 会按照码点遍历，可以正确处理代理对：

```js
const str = 'a😊中'

str.length // 4

for (const char of str) {
  console.log(char)
}
// a
// 😊
// 中

Array.from(str) // ['a', '😊', '中']
```

但要注意，码点也不一定等于人眼看到的完整字符。比如组合字符和复杂 emoji 可能由多个码点组成：

```js
'e\u0301'.length // 2，看起来像 é
Array.from('e\u0301') // ['e', '́']
```

如果需要按“用户看到的字符”切分字符串，可以使用 `Intl.Segmenter`：

```js
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' })

Array.from(segmenter.segment('a😊e\u0301'), item => item.segment)
// ['a', '😊', 'é']
```

简单记法：JS 字符串的 `length` 统计的是 UTF-16 码元，不是字符数量；处理 emoji、生僻字、组合字符时，优先使用 `codePointAt()`、`String.fromCodePoint()`、`for...of`、`Array.from()` 或 `Intl.Segmenter`。

### 字符串字面量和转义字符

字符串字面量就是直接写在代码里的字符串值。JavaScript 中常见的字符串字面量有三种写法：

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| 单引号 | `'hello'` | 普通字符串 |
| 双引号 | `"hello"` | 普通字符串 |
| 模板字符串 | `` `hello` `` | 支持换行和插值表达式 |

单引号和双引号本质上没有区别，主要看项目代码风格：

```js
const name1 = 'Tom'
const name2 = "Tom"
```

如果字符串内部包含同一种引号，需要使用反斜杠 `\` 转义：

```js
const str1 = 'It\'s OK'
const str2 = "He said \"hello\""
```

也可以换一种引号包裹，减少转义：

```js
const str1 = "It's OK"
const str2 = 'He said "hello"'
```

模板字符串使用反引号，可以直接换行，也可以通过 `${}` 插入表达式：

```js
const name = 'Tom'
const age = 18

const message = `My name is ${name}, age is ${age}`
```

常见转义字符：

| 转义字符 | 含义 |
| --- | --- |
| `\'` | 单引号 |
| `\"` | 双引号 |
| `` \` `` | 反引号 |
| `\\` | 反斜杠 |
| `\n` | 换行 |
| `\r` | 回车 |
| `\t` | 制表符 |
| `\b` | 退格 |
| `\f` | 换页 |
| `\v` | 垂直制表符 |
| `\0` | 空字符 |

```js
const path = 'C:\\Users\\Tom'
const text = '第一行\n第二行'

console.log(path) // C:\Users\Tom
console.log(text)
// 第一行
// 第二行
```

还可以使用 Unicode 转义表示字符：

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| `\xXX` | `'\x41'` | 2 位十六进制，表示 Latin-1 字符 |
| `\uXXXX` | `'\u4e2d'` | 4 位十六进制，表示一个 UTF-16 码元 |
| `\u{X...}` | `'\u{1f60a}'` | 按 Unicode 码点表示字符 |

```js
'\x41' // "A"
'\u4e2d' // "中"
'\u{1f60a}' // "😊"
```

需要注意：反斜杠本身也要转义，所以 Windows 路径中常见 `\\`：

```js
const path = 'C:\\Users\\Tom'
```

简单记法：字符串里出现“会影响代码语法的字符”时，就需要转义，比如引号、反斜杠、换行等；处理 Unicode 字符时，优先使用 `\u{码点}` 这种写法。

### 变量与作用域

变量用来保存数据，作用域决定变量能在哪里被访问。

JavaScript 中常见的变量声明方式有三种：

| 对比项 | `var` | `let` | `const` |
| --- | --- | --- | --- |
| 是否可重新赋值 | 可以 | 可以 | 不可以 |
| 是否可重复声明 | 可以 | 不可以 | 不可以 |
| 是否必须初始化 | 不需要 | 不需要 | 必须初始化 |
| 作用域 | 函数作用域 | 块级作用域 | 块级作用域 |
| 是否受 `{}` 限制 | 不受普通代码块限制 | 受限制 | 受限制 |
| 声明提升 | 会提升，初始化为 `undefined` | 会提升，但有暂时性死区 | 会提升，但有暂时性死区 |
| 声明前访问 | `undefined` | `ReferenceError` | `ReferenceError` |
| 顶层声明是否挂到全局对象 | 是 | 否 | 否 |
| 推荐程度 | 尽量少用 | 需要重新赋值时使用 | 默认优先使用 |

```js
var a = 1
let b = 2
const c = 3

globalThis.a // 1
globalThis.b // undefined
globalThis.c // undefined
```

#### var

`var` 声明的是函数作用域变量，不受普通代码块限制：

```js
if (true) {
  var name = 'Tom'
}

console.log(name) // "Tom"
```

`var` 可以重复声明，也可以重新赋值：

```js
var age = 18
var age = 20

age = 21
```

在函数内部使用 `var` 声明的变量，只能在函数内部访问：

```js
function fn() {
  var message = 'hello'
}

console.log(message) // ReferenceError
```

#### let

`let` 声明的是块级作用域变量，只在当前代码块中有效：

```js
if (true) {
  let name = 'Tom'
}

console.log(name) // ReferenceError
```

`let` 可以重新赋值，但不能在同一个作用域中重复声明：

```js
let age = 18
age = 20

let age = 21 // SyntaxError
```

#### const

`const` 声明的是常量，声明时必须赋值，并且不能重新赋值：

```js
const age = 18

age = 20 // TypeError
```

`const` 不能重新赋值，但如果保存的是对象或数组，对象内部的内容仍然可以修改：

```js
const user = {
  name: 'Tom'
}

user.name = 'Jerry'

console.log(user.name) // "Jerry"
```

原因是 `const` 限制的是变量绑定不能改变，不是限制对象内容不能改变。

```js
const user = { name: 'Tom' }

user = { name: 'Jerry' } // TypeError
```

简单记法：优先使用 `const`，需要重新赋值时使用 `let`，尽量少用 `var`。

### 重复声明

重复声明指在同一个作用域中，用声明语句声明同名变量。

`var` 允许在同一个作用域中重复声明：

```js
var name = 'Tom'
var name = 'Jerry'

console.log(name) // "Jerry"
```

`let` 和 `const` 不允许在同一个作用域中重复声明：

```js
let age = 18
let age = 20 // SyntaxError
```

```js
const count = 1
const count = 2 // SyntaxError
```

同一个作用域中，`var`、`let`、`const` 声明同名变量也会冲突：

```js
var name = 'Tom'
let name = 'Jerry' // SyntaxError
```

```js
let age = 18
var age = 20 // SyntaxError
```

但是在不同作用域中，可以声明同名变量：

```js
let name = 'Tom'

if (true) {
  let name = 'Jerry'

  console.log(name) // "Jerry"
}

console.log(name) // "Tom"
```

函数作用域中也可以声明和外部同名的变量：

```js
const value = 1

function fn() {
  const value = 2

  console.log(value)
}

fn() // 2
console.log(value) // 1
```

需要注意，函数参数也属于当前函数作用域中的变量名，不能再用 `let` 或 `const` 重复声明：

```js
function fn(value) {
  let value = 1 // SyntaxError
}
```

简单记法：同一作用域中，`var` 可以重复声明，`let` 和 `const` 不可以；不同作用域中可以使用相同变量名。

### 声明提升

声明提升是指变量或函数的声明会在代码执行前被处理。

`var` 会被提升，并且默认初始化为 `undefined`：

```js
console.log(name) // undefined

var name = 'Tom'
```

上面的代码可以理解为：

```js
var name

console.log(name) // undefined

name = 'Tom'
```

`let` 和 `const` 也会被提升，但在声明语句执行前不能访问，这段不能访问的区域叫暂时性死区：

```js
console.log(age) // ReferenceError

let age = 18
```

```js
console.log(count) // ReferenceError

const count = 1
```

函数声明也会提升，并且可以在声明前调用：

```js
sayHi() // "hi"

function sayHi() {
  console.log('hi')
}
```

但函数表达式要看变量声明方式：

```js
sayHi() // TypeError

var sayHi = function () {
  console.log('hi')
}
```

上面代码中，`sayHi` 这个变量会被提升为 `undefined`，但函数赋值不会被提升，所以调用时相当于执行 `undefined()`。

### 函数作用域

函数作用域是指在函数内部声明的变量，只能在函数内部访问：

```js
function fn() {
  var a = 1
  let b = 2
  const c = 3
}

console.log(a) // ReferenceError
console.log(b) // ReferenceError
console.log(c) // ReferenceError
```

内部作用域可以访问外部作用域的变量：

```js
const name = 'Tom'

function sayName() {
  console.log(name)
}

sayName() // "Tom"
```

如果内部和外部有同名变量，会优先使用内部变量：

```js
const name = 'Tom'

function sayName() {
  const name = 'Jerry'

  console.log(name)
}

sayName() // "Jerry"
```

### 块级作用域

块级作用域指 `{}` 形成的作用域，比如 `if`、`for`、`while` 中的代码块。

`let` 和 `const` 有块级作用域：

```js
if (true) {
  let a = 1
  const b = 2
}

console.log(a) // ReferenceError
console.log(b) // ReferenceError
```

`var` 没有块级作用域：

```js
if (true) {
  var a = 1
}

console.log(a) // 1
```

`for` 循环中更推荐使用 `let`，因为每次循环都会形成新的块级作用域：

```js
for (let i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i)
  })
}
// 0
// 1
// 2
```

如果使用 `var`，循环里的回调共享的是同一个 `i`：

```js
for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i)
  })
}
// 3
// 3
// 3
```

简单记法：函数会形成函数作用域，`let` 和 `const` 会被 `{}` 限制在块级作用域中，`var` 只受函数限制，不受普通代码块限制。

### 解构赋值

解构赋值是一种从数组或对象中快速取值，并赋值给变量的语法。

#### 数组解构

数组解构按位置取值：

```js
const arr = [1, 2, 3]

const [a, b, c] = arr

console.log(a) // 1
console.log(b) // 2
console.log(c) // 3
```

可以跳过不需要的元素：

```js
const arr = [1, 2, 3]

const [first, , third] = arr

console.log(first) // 1
console.log(third) // 3
```

可以设置默认值：

```js
const arr = [1]

const [a, b = 2] = arr

console.log(a) // 1
console.log(b) // 2
```

默认值只有在对应位置的值是 `undefined` 时才会生效：

```js
const [a = 1] = [undefined]
const [b = 1] = [null]

console.log(a) // 1
console.log(b) // null
```

可以使用剩余语法收集剩下的元素：

```js
const arr = [1, 2, 3, 4]

const [first, ...rest] = arr

console.log(first) // 1
console.log(rest) // [2, 3, 4]
```

#### 对象解构

对象解构按属性名取值：

```js
const user = {
  name: 'Tom',
  age: 18
}

const { name, age } = user

console.log(name) // "Tom"
console.log(age) // 18
```

对象解构时，变量名默认要和属性名一致。

如果想换一个变量名，可以使用重命名语法：

```js
const user = {
  name: 'Tom'
}

const { name: userName } = user

console.log(userName) // "Tom"
```

这里的 `name` 是要读取的属性名，`userName` 才是声明出来的变量名。

对象解构也可以设置默认值：

```js
const user = {
  name: 'Tom'
}

const { name, age = 18 } = user

console.log(name) // "Tom"
console.log(age) // 18
```

默认值同样只有在属性值是 `undefined` 时才会生效：

```js
const { a = 1 } = { a: undefined }
const { b = 1 } = { b: null }

console.log(a) // 1
console.log(b) // null
```

重命名和默认值可以一起使用：

```js
const user = {}

const { name: userName = 'Anonymous' } = user

console.log(userName) // "Anonymous"
```

可以使用剩余语法收集剩下的属性：

```js
const user = {
  id: 1,
  name: 'Tom',
  age: 18
}

const { id, ...info } = user

console.log(id) // 1
console.log(info) // { name: 'Tom', age: 18 }
```

#### 嵌套解构

解构可以处理嵌套数组或嵌套对象：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const {
  address: { city }
} = user

console.log(city) // "Shanghai"
```

需要注意，上面代码只声明了 `city`，没有声明 `address` 变量。

如果嵌套对象可能不存在，需要配合默认值：

```js
const user = {}

const {
  address: { city } = {}
} = user

console.log(city) // undefined
```

#### 函数参数解构

函数参数也可以使用解构，常用于配置对象：

```js
function createUser({ name, age }) {
  console.log(name, age)
}

createUser({ name: 'Tom', age: 18 })
```

可以给参数和属性都设置默认值：

```js
function createUser({ name = 'Anonymous', age = 18 } = {}) {
  console.log(name, age)
}

createUser() // "Anonymous" 18
createUser({ name: 'Tom' }) // "Tom" 18
```

这里参数默认值 `= {}` 用来避免调用 `createUser()` 时，对 `undefined` 解构导致报错。

#### 已声明变量的对象解构

如果变量已经声明过，再使用对象解构赋值时，需要用括号包起来：

```js
let name

;({ name } = { name: 'Tom' })

console.log(name) // "Tom"
```

如果不加括号，JavaScript 会把 `{}` 当成代码块，而不是对象解构。

这里前面的分号是为了避免和上一行代码发生自动分号插入问题。

简单记法：数组解构按位置取值，对象解构按属性名取值；默认值只在值为 `undefined` 时生效；函数参数解构常用于接收配置对象。

### 可选链操作符

可选链操作符 `?.` 用来安全地访问对象属性或调用函数。

当 `?.` 左边的值是 `null` 或 `undefined` 时，表达式会直接返回 `undefined`，不会继续向后访问，也不会报错。

```js
const user = null

user.name // TypeError
user?.name // undefined
```

#### 属性访问

普通属性访问：

```js
const user = {
  profile: {
    name: 'Tom'
  }
}

user?.profile?.name // "Tom"
```

如果中间某一层是 `null` 或 `undefined`，会直接返回 `undefined`：

```js
const user = {}

user.profile.name // TypeError
user.profile?.name // undefined
user?.profile?.name // undefined
```

#### 动态属性访问

访问动态属性名时，可以使用 `?.[]`：

```js
const key = 'name'
const user = {
  name: 'Tom'
}

user?.[key] // "Tom"
```

数组也可以使用：

```js
const list = null

list?.[0] // undefined
```

#### 函数调用

可选链也可以用于函数调用：

```js
const fn = null

fn?.() // undefined
```

调用对象方法时，要根据要保护的位置选择写法：

```js
const user = null

user?.sayHi() // user 是 null 或 undefined 时，不会继续调用
```

如果对象一定存在，但方法可能不存在，应该把 `?.` 放在方法后面：

```js
const user = {}

user.sayHi?.() // undefined
```

如果对象和方法都可能不存在，可以连续使用可选链：

```js
const user = null

user?.sayHi?.() // undefined
```

需要注意：如果属性存在，但不是函数，使用 `?.()` 仍然会报错：

```js
const user = {
  sayHi: 'hello'
}

user.sayHi?.() // TypeError
```

#### 和空值合并操作符一起使用

可选链经常和空值合并操作符 `??` 一起使用。

`?.` 负责安全访问，`??` 负责提供默认值：

```js
const user = {}

const name = user.profile?.name ?? 'Anonymous'

console.log(name) // "Anonymous"
```

`??` 只会在左边是 `null` 或 `undefined` 时使用默认值：

```js
const user = {
  age: 0
}

user.age ?? 18 // 0
```

#### 注意点

可选链只会对 `null` 和 `undefined` 短路，不会对 `0`、`false`、`''`、`NaN` 短路：

```js
const value = 0

value?.toString() // "0"
```

可选链左边的变量必须已经声明，否则仍然会报错：

```js
user?.name // ReferenceError，如果 user 没有声明
```

可选链不能出现在赋值语句的左边：

```js
const user = {}

user?.name = 'Tom' // SyntaxError
```

如果用括号中断了可选链，后续访问不会继续受到保护：

```js
const user = null

user?.profile?.name // undefined
(user?.profile).name // TypeError
```

简单记法：`?.` 只保护它左边那一段访问；左边是 `null` 或 `undefined` 时返回 `undefined`，否则继续执行。

### 位操作符

位操作符会把数字转换成 32 位有符号整数，然后按二进制位进行运算。

| 操作符 | 名称 | 示例 | 说明 |
| --- | --- | --- | --- |
| `&` | 按位与 | `a & b` | 两个二进制位都为 `1`，结果才是 `1` |
| `|` | 按位或 | `a | b` | 两个二进制位只要有一个是 `1`，结果就是 `1` |
| `^` | 按位异或 | `a ^ b` | 两个二进制位不同，结果是 `1`；相同则是 `0` |
| `~` | 按位非 | `~a` | 反转所有二进制位 |
| `<<` | 左移 | `a << n` | 二进制整体向左移动 `n` 位，右边补 `0` |
| `>>` | 有符号右移 | `a >> n` | 二进制整体向右移动 `n` 位，保留符号位 |
| `>>>` | 无符号右移 | `a >>> n` | 二进制整体向右移动 `n` 位，左边补 `0` |

#### 按位与

`&` 常用于判断某些二进制位是否存在：

```js
5 & 3 // 1
```

计算过程：

```txt
5: 101
3: 011
------
1: 001
```

#### 按位或

`|` 常用于把某些二进制位设置为 `1`：

```js
5 | 3 // 7
```

计算过程：

```txt
5: 101
3: 011
------
7: 111
```

#### 按位异或

`^` 表示相同为 `0`，不同为 `1`：

```js
5 ^ 3 // 6
```

计算过程：

```txt
5: 101
3: 011
------
6: 110
```

#### 按位非

`~` 会反转所有二进制位：

```js
~5 // -6
```

在 JavaScript 中，`~x` 的结果等价于 `-(x + 1)`：

```js
~0 // -1
~1 // -2
~-1 // 0
```

#### 移位操作符

左移 `<<` 可以理解为在 32 位整数范围内乘以 `2` 的 `n` 次方：

```js
3 << 1 // 6
3 << 2 // 12
```

有符号右移 `>>` 会保留符号位：

```js
8 >> 1 // 4
-8 >> 1 // -4
```

无符号右移 `>>>` 会把数字当成无符号 32 位整数处理，左边补 `0`：

```js
8 >>> 1 // 4
-8 >>> 1 // 2147483644
```

#### 常见用途

| 写法 | 作用 | 示例 |
| --- | --- | --- |
| `n & 1` | 判断奇偶 | `5 & 1 // 1`，奇数 |
| `n << 1` | 乘以 2 | `4 << 1 // 8` |
| `n >> 1` | 除以 2 并向下取整 | `5 >> 1 // 2` |
| `~~n` | 去掉小数部分 | `~~3.9 // 3` |
| `flags & value` | 判断标记位是否存在 | `(7 & 2) !== 0 // true` |

需要注意：位操作符会把操作数转换成 32 位整数，所以不适合处理超过 32 位范围的整数：

```js
2147483648 | 0 // -2147483648
```

小数也会先被转换成整数：

```js
3.9 | 0 // 3
```

简单记法：位操作符不是直接对十进制数字计算，而是先转成 32 位整数，再对每一位二进制进行操作。

### 逻辑或与逻辑与

逻辑或 `||` 和逻辑与 `&&` 常用于条件判断，也常用于短路求值。

| 操作符 | 名称 | 规则 | 返回值 |
| --- | --- | --- | --- |
| `||` | 逻辑或 | 左边是真值，直接返回左边；否则返回右边 | 返回其中一个操作数 |
| `&&` | 逻辑与 | 左边是假值，直接返回左边；否则返回右边 | 返回其中一个操作数 |

需要注意：`||` 和 `&&` 的结果不一定是 `true` 或 `false`，它们会返回参与运算的原始值。

#### 逻辑或

`||` 会从左到右计算，遇到第一个真值就返回；如果都不是真值，就返回最后一个值：

```js
'hello' || 'default' // "hello"
0 || 'default' // "default"
'' || 'default' // "default"
null || 'default' // "default"
undefined || 'default' // "default"
```

常见用途是设置默认值：

```js
const name = inputName || 'Anonymous'
```

但要注意，`||` 会把 `0`、`''`、`false` 也当成假值：

```js
const count = 0

const value = count || 10

console.log(value) // 10
```

如果只想在 `null` 或 `undefined` 时使用默认值，更适合使用空值合并操作符 `??`：

```js
const count = 0

count || 10 // 10
count ?? 10 // 0
```

#### 逻辑与

`&&` 会从左到右计算，遇到第一个假值就返回；如果都是真值，就返回最后一个值：

```js
'hello' && 'world' // "world"
0 && 'world' // 0
'' && 'world' // ""
null && 'world' // null
undefined && 'world' // undefined
```

常见用途是条件成立时才执行后面的表达式：

```js
isLogin && showUserInfo()
```

也可以用于条件渲染：

```js
hasMessage && '有新消息'
```

需要注意，如果左边是 `0`，结果会返回 `0`，不是 `false`：

```js
const count = 0

count && '有数据' // 0
```

#### 假值

在逻辑运算中，下面这些值会被当成假值：

| 假值 |
| --- |
| `false` |
| `0` |
| `-0` |
| `0n` |
| `''` |
| `null` |
| `undefined` |
| `NaN` |

除了这些假值，其他值基本都会被当成真值：

```js
Boolean([]) // true
Boolean({}) // true
Boolean('0') // true
Boolean('false') // true
```

#### 短路求值

短路求值指的是：如果左边已经能决定结果，右边就不会执行。

`||` 左边是真值时，右边不会执行：

```js
true || console.log('不会执行')
```

`&&` 左边是假值时，右边不会执行：

```js
false && console.log('不会执行')
```

这个特性常用于避免不必要的计算或避免报错：

```js
user && user.name
```

不过现在访问对象属性时，更推荐使用可选链操作符：

```js
user?.name
```

简单记法：`||` 找第一个真值，`&&` 找第一个假值；它们返回的是原始操作数，不一定是布尔值。

### 三元运算符

操作符也叫运算符，是用来对一个或多个值进行计算、比较、赋值或逻辑判断的符号。

比如：

| 操作符 | 作用 | 示例 |
| --- | --- | --- |
| `+` | 加法或字符串拼接 | `1 + 2` |
| `=` | 赋值 | `name = 'Tom'` |
| `>` | 比较大小 | `age > 18` |
| `&&` | 逻辑与 | `isLogin && showUser()` |
| `?:` | 条件选择 | `age >= 18 ? '成年' : '未成年'` |

三元运算符也叫条件运算符，是 JavaScript 中唯一需要三个操作数的运算符。

语法：

```js
条件 ? 条件为 true 时的结果 : 条件为 false 时的结果
```

示例：

```js
const age = 18

const result = age >= 18 ? '成年' : '未成年'

console.log(result) // "成年"
```

执行过程：

1. 先计算 `?` 前面的条件
2. 如果条件是真值，返回 `?` 后面的表达式
3. 如果条件是假值，返回 `:` 后面的表达式

三元运算符是一个表达式，所以它有返回值，可以直接赋值给变量：

```js
const score = 90

const level = score >= 60 ? '及格' : '不及格'
```

也可以直接作为函数参数：

```js
console.log(isLogin ? '欢迎回来' : '请先登录')
```

三元运算符适合处理简单的二选一逻辑：

```js
const buttonText = disabled ? '不可点击' : '提交'
```

如果逻辑比较复杂，更适合使用 `if...else`，可读性更好：

```js
if (score >= 90) {
  level = '优秀'
} else if (score >= 60) {
  level = '及格'
} else {
  level = '不及格'
}
```

三元运算符可以嵌套，但不建议写得太复杂：

```js
const level = score >= 90 ? '优秀' : score >= 60 ? '及格' : '不及格'
```

上面代码虽然能运行，但阅读成本较高。复杂条件优先使用 `if...else`。

需要注意，三元运算符判断的也是条件的真假值，不要求条件本身必须是布尔值：

```js
const name = ''

const displayName = name ? name : '匿名'

console.log(displayName) // "匿名"
```

简单记法：三元运算符用于简单的“条件二选一”；它是表达式，有返回值，适合赋值或直接返回结果。

### eval 和 with

`eval` 和 `with` 都是 JavaScript 中不推荐使用的语法。

它们的问题主要是：会让代码的作用域变得难以判断，也会影响 JavaScript 引擎优化代码。

#### eval

`eval()` 可以把字符串当成 JavaScript 代码执行：

```js
eval('1 + 2') // 3
```

也可以执行语句：

```js
eval('const message = "hello"; console.log(message)')
```

但是 `eval()` 最大的问题是：它会执行字符串里的任意代码。

```js
const code = 'console.log("run code")'

eval(code)
```

如果字符串来自用户输入或外部接口，就可能带来安全风险：

```js
const input = 'alert(document.cookie)'

eval(input)
```

`eval()` 还会让作用域变复杂。

在非严格模式下，直接调用 `eval()` 可能影响当前作用域：

```js
var name = 'Tom'

eval('var name = "Jerry"')

console.log(name) // "Jerry"
```

在严格模式下，`eval()` 内部有自己的作用域，不会把变量泄漏到外层：

```js
'use strict'

eval('var name = "Tom"')

console.log(name) // ReferenceError
```

如果只是解析 JSON，不要使用 `eval()`，应该使用 `JSON.parse()`：

```js
const json = '{"name":"Tom","age":18}'

const user = JSON.parse(json)

console.log(user.name) // "Tom"
```

简单记法：`eval()` 是“把字符串当代码执行”，能力很强，但风险也很高。实际开发中应尽量避免。

#### with

`with` 可以临时把一个对象放到作用域链的前面，让访问属性时可以省略对象名：

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

上面代码类似于：

```js
console.log(user.name)
console.log(user.age)
```

但 `with` 的问题是：变量到底来自对象属性，还是来自外层作用域，不容易判断。

```js
const user = {
  name: 'Tom'
}

const age = 18

with (user) {
  console.log(name) // "Tom"，来自 user.name
  console.log(age) // 18，来自外层作用域
}
```

如果对象后来新增了同名属性，代码含义可能发生变化：

```js
const user = {
  name: 'Tom',
  age: 20
}

const age = 18

with (user) {
  console.log(age) // 20，来自 user.age
}
```

`with` 在严格模式下禁止使用：

```js
'use strict'

with ({ name: 'Tom' }) {
  console.log(name)
}
// SyntaxError
```

实际开发中应该直接写清楚对象名，或者先解构：

```js
const user = {
  name: 'Tom',
  age: 18
}

console.log(user.name)
console.log(user.age)
```

```js
const { name, age } = user

console.log(name)
console.log(age)
```

简单记法：`with` 是“临时省略对象名”，但会让变量来源变模糊。现代 JavaScript 中应避免使用。

| 语法 | 作用 | 主要问题 | 建议 |
| --- | --- | --- | --- |
| `eval()` | 把字符串当作代码执行 | 安全风险高，作用域难分析，影响性能优化 | 避免使用 |
| `with` | 临时把对象放进作用域链 | 变量来源不清晰，严格模式禁用，影响性能优化 | 避免使用 |

### delete 操作符

`delete` 操作符用于删除对象自身的属性。

语法：

```js
delete object.property
delete object[propertyName]
```

示例：

```js
const user = {
  name: 'Tom',
  age: 18
}

delete user.age

console.log(user) // { name: 'Tom' }
```

动态属性名可以使用方括号：

```js
const key = 'name'
const user = {
  name: 'Tom'
}

delete user[key]

console.log(user) // {}
```

#### 返回值

`delete` 会返回一个布尔值：

| 返回值 | 含义 |
| --- | --- |
| `true` | 删除成功，或者属性本来就不存在 |
| `false` | 删除失败，通常是属性不可配置 |

```js
const user = {
  name: 'Tom'
}

delete user.name // true
delete user.age // true
```

如果属性不可配置，`delete` 会失败：

```js
const user = {}

Object.defineProperty(user, 'id', {
  value: 1,
  configurable: false
})

delete user.id // false，非严格模式
```

在严格模式下，删除不可配置属性会报错：

```js
'use strict'

const user = {}

Object.defineProperty(user, 'id', {
  value: 1,
  configurable: false
})

delete user.id // TypeError
```

#### delete 删除的是属性

`delete` 不能删除通过 `let`、`const`、`var` 声明的普通变量：

```js
let name = 'Tom'

delete name // false，或者在严格模式下报错
```

它真正适合删除的是对象属性：

```js
const user = {
  name: 'Tom'
}

delete user.name // true
```

#### 删除数组元素

`delete` 可以删除数组中的某一项，但不会改变数组长度，会留下一个空位：

```js
const arr = [1, 2, 3]

delete arr[1]

console.log(arr) // [1, empty, 3]
console.log(arr.length) // 3
```

所以删除数组元素通常不推荐使用 `delete`。

如果想按索引删除数组元素，更常用 `splice()`：

```js
const arr = [1, 2, 3]

arr.splice(1, 1)

console.log(arr) // [1, 3]
console.log(arr.length) // 2
```

#### 删除原型属性

`delete` 只能删除对象自身的属性，不能直接删除原型链上的属性：

```js
const parent = {
  name: 'Tom'
}

const child = Object.create(parent)

delete child.name // true

console.log(child.name) // "Tom"
```

上面代码中，`child` 自己没有 `name` 属性，`name` 来自原型对象 `parent`，所以 `delete child.name` 并没有删除 `parent.name`。

如果对象自身有同名属性，`delete` 删除的是自身属性，删除后可能继续访问到原型上的属性：

```js
const parent = {
  name: 'parent'
}

const child = Object.create(parent)
child.name = 'child'

console.log(child.name) // "child"

delete child.name

console.log(child.name) // "parent"
```

简单记法：`delete` 用来删除对象自身属性；删除数组元素不会改变 `length`；不要用它删除普通变量。
