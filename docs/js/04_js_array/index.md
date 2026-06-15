# 04 数组

数组是 JavaScript 中最常用的数据结构之一，用来按顺序保存一组值。

数组本质上也是对象，但它有几个特殊点：

- 使用从 `0` 开始的数字索引访问元素
- 有自动维护的 `length` 属性
- 继承自 `Array.prototype`，拥有 `push`、`pop`、`map`、`filter` 等数组方法
- 可以保存任意类型的值

```js
const list = ['Tom', 18, true, { city: 'Shanghai' }]

list[0] // Tom
list.length // 4
```

## 创建数组

### 数组字面量

数组字面量是最常见、最推荐的创建方式：

```js
const nums = [1, 2, 3]
const names = ['Tom', 'Jerry']
const empty = []
```

数组中的元素可以是任意类型：

```js
const list = [
  1,
  'hello',
  true,
  null,
  undefined,
  { name: 'Tom' },
  function sayHi() {}
]
```

读取元素时使用下标：

```js
const names = ['Tom', 'Jerry']

names[0] // Tom
names[1] // Jerry
names[2] // undefined
```

数组下标从 `0` 开始。访问不存在的下标时，结果是 `undefined`。

### Array 构造函数

也可以使用 `Array` 构造函数创建数组：

```js
const arr = new Array(1, 2, 3)

arr // [1, 2, 3]
```

但 `Array` 构造函数有一个容易混淆的地方：如果只传入一个数字，它表示数组长度，而不是数组元素。

```js
new Array(3) // [empty × 3]
new Array(1, 2, 3) // [1, 2, 3]
```

`new Array(3)` 创建的是一个长度为 `3` 的稀疏数组，里面没有真正的元素：

```js
const arr = new Array(3)

arr.length // 3
arr[0] // undefined
0 in arr // false
```

这和 `[undefined, undefined, undefined]` 不一样：

```js
const a = new Array(3)
const b = [undefined, undefined, undefined]

0 in a // false
0 in b // true
```

因此日常代码中更推荐使用数组字面量 `[]`，避免 `new Array(number)` 带来的歧义。

### Array.of

`Array.of()` 可以避免 `Array` 构造函数的单数字参数歧义：

```js
Array.of(3) // [3]
Array.of(1, 2, 3) // [1, 2, 3]
```

如果你明确想把传入参数当作数组元素，可以使用 `Array.of()`。

### Array.from

`Array.from()` 可以把类数组对象或可迭代对象转换成真正的数组。

字符串是可迭代对象：

```js
Array.from('abc') // ['a', 'b', 'c']
```

`Set` 也是可迭代对象：

```js
const set = new Set([1, 2, 3])

Array.from(set) // [1, 2, 3]
```

类数组对象通常有数字下标和 `length`：

```js
const arrayLike = {
  0: 'a',
  1: 'b',
  length: 2
}

Array.from(arrayLike) // ['a', 'b']
```

`Array.from()` 的第二个参数可以在转换时顺便处理每个元素：

```js
Array.from([1, 2, 3], (item) => item * 2)
// [2, 4, 6]
```

### 使用 fill 创建固定长度数组

如果希望创建指定长度并填充默认值的数组，可以配合 `fill()`：

```js
const arr = new Array(3).fill(0)

arr // [0, 0, 0]
```

注意，如果填充的是对象，所有位置会引用同一个对象：

```js
const list = new Array(3).fill({ count: 0 })

list[0].count = 1

list[1].count // 1
```

如果每个位置都需要独立对象，可以使用 `Array.from()`：

```js
const list = Array.from({ length: 3 }, () => ({ count: 0 }))

list[0].count = 1

list[1].count // 0
```

## length 属性

数组的 `length` 表示数组长度，通常等于最大下标加 `1`。

```js
const arr = ['a', 'b']

arr.length // 2
```

给更大的下标赋值，会自动改变 `length`：

```js
const arr = []

arr[2] = 'c'

arr.length // 3
arr // [empty × 2, 'c']
```

直接修改 `length` 也会影响数组内容：

```js
const arr = [1, 2, 3, 4]

arr.length = 2

arr // [1, 2]
```

如果把 `length` 变大，只会增加空位，不会自动填充值：

```js
const arr = [1, 2]

arr.length = 4

arr // [1, 2, empty × 2]
```

## 稀疏数组

稀疏数组是指某些下标位置没有真正元素的数组。

```js
const arr = []

arr[2] = 'c'

arr.length // 3
0 in arr // false
1 in arr // false
2 in arr // true
```

稀疏数组容易让遍历方法表现不一致，实际业务中应尽量避免。需要固定长度数组时，通常用 `Array.from()` 或 `fill()` 明确填充。

## 添加和删除数组元素

数组常见的增删操作可以分成三类：

- 在尾部添加或删除
- 在头部添加或删除
- 在任意位置添加或删除

### push

`push()` 用来在数组尾部添加一个或多个元素，并返回新长度。它会修改原数组。

```js
const arr = [1, 2]

const length = arr.push(3, 4)

arr // [1, 2, 3, 4]
length // 4
```

### pop

`pop()` 用来删除数组最后一个元素，并返回被删除的元素。它会修改原数组。

```js
const arr = [1, 2, 3]

const last = arr.pop()

arr // [1, 2]
last // 3
```

如果数组为空，`pop()` 返回 `undefined`：

```js
const arr = []

arr.pop() // undefined
```

### unshift

`unshift()` 用来在数组头部添加一个或多个元素，并返回新长度。它会修改原数组。

```js
const arr = [2, 3]

const length = arr.unshift(0, 1)

arr // [0, 1, 2, 3]
length // 4
```

头部添加元素需要移动原有元素的位置，通常比尾部 `push()` 成本更高。

### shift

`shift()` 用来删除数组第一个元素，并返回被删除的元素。它会修改原数组。

```js
const arr = [1, 2, 3]

const first = arr.shift()

arr // [2, 3]
first // 1
```

头部删除元素也需要移动后续元素的位置，通常比尾部 `pop()` 成本更高。

### splice

`splice()` 可以在任意位置删除、插入或替换元素。它会修改原数组，并返回被删除的元素数组。

语法：

```js
arr.splice(start, deleteCount, item1, item2)
```

删除元素：

```js
const arr = ['a', 'b', 'c', 'd']

const removed = arr.splice(1, 2)

arr // ['a', 'd']
removed // ['b', 'c']
```

插入元素：

```js
const arr = ['a', 'd']

arr.splice(1, 0, 'b', 'c')

arr // ['a', 'b', 'c', 'd']
```

替换元素：

```js
const arr = ['a', 'x', 'd']

arr.splice(1, 1, 'b', 'c')

arr // ['a', 'b', 'c', 'd']
```

### delete 不推荐用于删除数组元素

`delete` 可以删除某个下标上的元素，但不会改变数组长度，会留下空位：

```js
const arr = ['a', 'b', 'c']

delete arr[1]

arr.length // 3
arr // ['a', empty, 'c']
1 in arr // false
```

因此删除数组元素通常不要使用 `delete`，更推荐使用 `splice()`、`pop()`、`shift()`，或者用 `filter()` 创建新数组。

### 不修改原数组的删除方式

如果不希望修改原数组，可以使用 `filter()`：

```js
const arr = [1, 2, 3, 4]

const result = arr.filter((item) => item !== 2)

result // [1, 3, 4]
arr // [1, 2, 3, 4]
```

也可以使用 `slice()` 配合展开语法删除指定位置：

```js
const arr = ['a', 'b', 'c', 'd']
const index = 1

const result = [
  ...arr.slice(0, index),
  ...arr.slice(index + 1)
]

result // ['a', 'c', 'd']
```

### 常见增删方法对比

| 方法 | 作用 | 是否修改原数组 | 返回值 |
| --- | --- | --- | --- |
| `push()` | 尾部添加 | 是 | 新长度 |
| `pop()` | 尾部删除 | 是 | 被删除元素 |
| `unshift()` | 头部添加 | 是 | 新长度 |
| `shift()` | 头部删除 | 是 | 被删除元素 |
| `splice()` | 任意位置增删改 | 是 | 被删除元素数组 |
| `filter()` | 按条件过滤 | 否 | 新数组 |
| `slice()` | 截取数组片段 | 否 | 新数组 |

## 其他常用数组操作方法

数组方法很多，学习时建议先关注两个问题：

1. 这个方法是否会修改原数组
2. 这个方法返回什么

### slice

`slice(start, end)` 用来截取数组片段，返回一个新数组，不修改原数组。

```js
const arr = ['a', 'b', 'c', 'd']

arr.slice(1, 3) // ['b', 'c']
arr // ['a', 'b', 'c', 'd']
```

`end` 不包含在结果中：

```js
arr.slice(0, 2) // ['a', 'b']
```

如果省略 `end`，会截取到数组末尾：

```js
arr.slice(2) // ['c', 'd']
```

`slice()` 也支持负数下标，表示从数组末尾倒数：

```js
arr.slice(-2) // ['c', 'd']
arr.slice(-3, -1) // ['b', 'c']
```

常见用途是浅拷贝数组：

```js
const copy = arr.slice()
```

### splice

`splice()` 前面已经用于增删元素。这里再强调一次：它会修改原数组。

```js
const arr = ['a', 'b', 'c', 'd']

arr.splice(1, 2, 'x', 'y')

arr // ['a', 'x', 'y', 'd']
```

如果只是想截取数组，不要用 `splice()`，用 `slice()`。

```js
const arr = ['a', 'b', 'c']

arr.slice(1) // ['b', 'c']，不修改原数组
arr.splice(1) // ['b', 'c']，会把原数组改成 ['a']
```

### fill

`fill(value, start, end)` 用指定值填充数组。它会修改原数组。

```js
const arr = [1, 2, 3, 4]

arr.fill(0)

arr // [0, 0, 0, 0]
```

可以指定填充范围：

```js
const arr = [1, 2, 3, 4]

arr.fill(0, 1, 3)

arr // [1, 0, 0, 4]
```

注意，如果填充对象，所有位置引用的是同一个对象：

```js
const arr = new Array(3).fill({ count: 0 })

arr[0].count = 1

arr[1].count // 1
```

### copyWithin

`copyWithin(target, start, end)` 会把数组内部的一段元素复制到另一个位置。它会修改原数组，数组长度不变。

```js
const arr = ['a', 'b', 'c', 'd', 'e']

arr.copyWithin(0, 3)

arr // ['d', 'e', 'c', 'd', 'e']
```

含义是：从下标 `3` 开始复制到下标 `0`。

也可以指定结束位置：

```js
const arr = ['a', 'b', 'c', 'd', 'e']

arr.copyWithin(1, 3, 5)

arr // ['a', 'd', 'e', 'd', 'e']
```

这个方法日常业务中不算高频，但在需要原地移动数组片段时有用。

### indexOf 和 lastIndexOf

`indexOf()` 返回元素第一次出现的位置，找不到返回 `-1`：

```js
const arr = ['a', 'b', 'a']

arr.indexOf('a') // 0
arr.indexOf('x') // -1
```

`lastIndexOf()` 从右往左查找，返回最后一次出现的位置：

```js
arr.lastIndexOf('a') // 2
```

它们使用严格相等 `===` 判断，所以不能正确查找 `NaN`：

```js
[NaN].indexOf(NaN) // -1
```

### includes

`includes()` 判断数组是否包含某个元素，返回布尔值：

```js
const arr = ['a', 'b', 'c']

arr.includes('b') // true
arr.includes('x') // false
```

和 `indexOf()` 不同，`includes()` 可以判断 `NaN`：

```js
[NaN].includes(NaN) // true
```

如果只关心“是否存在”，优先使用 `includes()`，语义比 `indexOf() !== -1` 更清晰。

### sort

`sort()` 用来排序数组。它会修改原数组。

默认情况下，`sort()` 会把元素转成字符串后按字典序排序：

```js
const arr = [10, 2, 1]

arr.sort()

arr // [1, 10, 2]
```

数字排序通常需要传比较函数：

```js
const arr = [10, 2, 1]

arr.sort((a, b) => a - b)

arr // [1, 2, 10]
```

降序：

```js
arr.sort((a, b) => b - a)
```

对象数组排序：

```js
const users = [
  { name: 'Tom', age: 18 },
  { name: 'Jerry', age: 16 }
]

users.sort((a, b) => a.age - b.age)

users // [{ name: 'Jerry', age: 16 }, { name: 'Tom', age: 18 }]
```

如果不想修改原数组，可以先复制再排序：

```js
const sorted = [...arr].sort((a, b) => a - b)
```

现代环境也可以使用 `toSorted()`：

```js
const sorted = arr.toSorted((a, b) => a - b)
```

### reverse

`reverse()` 会反转数组顺序。它会修改原数组。

```js
const arr = [1, 2, 3]

arr.reverse()

arr // [3, 2, 1]
```

如果不想修改原数组：

```js
const reversed = [...arr].reverse()
```

现代环境也可以使用 `toReversed()`：

```js
const reversed = arr.toReversed()
```

### concat

`concat()` 用来合并数组，返回新数组，不修改原数组。

```js
const a = [1, 2]
const b = [3, 4]

const result = a.concat(b)

result // [1, 2, 3, 4]
a // [1, 2]
```

日常代码中也常用展开语法：

```js
const result = [...a, ...b]
```

### join

`join(separator)` 会把数组元素拼接成字符串：

```js
const arr = ['a', 'b', 'c']

arr.join('-') // 'a-b-c'
arr.join('') // 'abc'
```

如果不传分隔符，默认使用逗号：

```js
arr.join() // 'a,b,c'
```

### at

`at(index)` 用来读取指定位置的元素，支持负数下标：

```js
const arr = ['a', 'b', 'c']

arr.at(0) // 'a'
arr.at(-1) // 'c'
```

它比 `arr[arr.length - 1]` 更适合读取最后一个元素：

```js
arr.at(-1) // 'c'
```

### 操作方法对比

| 方法 | 作用 | 是否修改原数组 | 返回值 |
| --- | --- | --- | --- |
| `push()` | 尾部添加 | 是 | 新长度 |
| `pop()` | 尾部删除 | 是 | 被删除元素 |
| `shift()` | 头部删除 | 是 | 被删除元素 |
| `unshift()` | 头部添加 | 是 | 新长度 |
| `slice()` | 截取片段 | 否 | 新数组 |
| `splice()` | 增删改任意位置 | 是 | 被删除元素数组 |
| `fill()` | 填充数组 | 是 | 原数组 |
| `copyWithin()` | 内部复制片段 | 是 | 原数组 |
| `indexOf()` | 查找位置 | 否 | 下标或 `-1` |
| `lastIndexOf()` | 从右查找位置 | 否 | 下标或 `-1` |
| `includes()` | 判断是否包含 | 否 | 布尔值 |
| `sort()` | 排序 | 是 | 原数组 |
| `reverse()` | 反转 | 是 | 原数组 |
| `concat()` | 合并数组 | 否 | 新数组 |
| `join()` | 拼接字符串 | 否 | 字符串 |
| `at()` | 读取元素 | 否 | 元素值 |

## 会改变原数组和不会改变原数组的方法

学习数组方法时，一定要先判断这个方法有没有副作用：它是直接修改当前数组，还是返回一个新的结果。

### 会改变原数组的方法

这些方法会直接修改调用它的数组：

| 方法 | 作用 | 返回值 |
| --- | --- | --- |
| `push()` | 尾部添加元素 | 新长度 |
| `pop()` | 尾部删除元素 | 被删除的元素 |
| `shift()` | 头部删除元素 | 被删除的元素 |
| `unshift()` | 头部添加元素 | 新长度 |
| `splice()` | 在任意位置增删改元素 | 被删除元素组成的数组 |
| `sort()` | 排序 | 排序后的原数组 |
| `reverse()` | 反转顺序 | 反转后的原数组 |
| `fill()` | 用固定值填充数组 | 填充后的原数组 |
| `copyWithin()` | 在数组内部复制元素 | 修改后的原数组 |

示例：

```js
const arr = [3, 1, 2]

const result = arr.sort()

arr // [1, 2, 3]
result === arr // true
```

`sort()` 返回的不是新数组，而是被修改后的原数组。

如果你在 React、Vue 状态管理、函数式处理或多人协作代码中不希望原数据被改动，就要小心这些方法。

### 不会改变原数组的方法

这些方法不会修改原数组，而是返回新数组、新字符串、布尔值、下标或其他结果：

| 方法 | 作用 | 返回值 |
| --- | --- | --- |
| `slice()` | 截取数组片段 | 新数组 |
| `concat()` | 合并数组 | 新数组 |
| `forEach()` | 遍历数组并执行回调 | `undefined` |
| `map()` | 映射成新数组 | 新数组 |
| `filter()` | 筛选元素 | 新数组 |
| `flat()` | 打平嵌套数组 | 新数组 |
| `flatMap()` | 映射后打平一层 | 新数组 |
| `find()` | 查找第一个满足条件的元素 | 元素或 `undefined` |
| `findIndex()` | 查找第一个满足条件的下标 | 下标或 `-1` |
| `every()` | 判断是否全部满足条件 | 布尔值 |
| `some()` | 判断是否至少一个满足条件 | 布尔值 |
| `reduce()` | 从左到右累积结果 | 累积结果 |
| `reduceRight()` | 从右到左累积结果 | 累积结果 |
| `indexOf()` | 查找元素位置 | 下标或 `-1` |
| `lastIndexOf()` | 从右往左查找位置 | 下标或 `-1` |
| `includes()` | 判断是否包含元素 | 布尔值 |
| `join()` | 拼接成字符串 | 字符串 |
| `at()` | 读取指定位置元素 | 元素值 |
| `keys()` | 返回下标迭代器 | 迭代器 |
| `values()` | 返回元素值迭代器 | 迭代器 |
| `entries()` | 返回下标和值的迭代器 | 迭代器 |
| `toSorted()` | 返回排序后的数组 | 新数组 |
| `toReversed()` | 返回反转后的数组 | 新数组 |
| `toSpliced()` | 返回增删改后的数组 | 新数组 |
| `with()` | 返回替换指定位置后的数组 | 新数组 |

示例：

```js
const arr = [1, 2, 3]

const result = arr.map((item) => item * 2)

arr // [1, 2, 3]
result // [2, 4, 6]
```

### 不修改数组方法里也可能改到数据

`map()`、`filter()`、`forEach()` 这类方法本身通常不会改变原数组结构，但如果数组里保存的是对象，并且在回调里修改对象属性，原数组里的对象也会变。

```js
const users = [
  { name: 'Tom', age: 18 },
  { name: 'Jerry', age: 20 }
]

const result = users.map((user) => {
  user.age += 1
  return user
})

users[0].age // 19
result[0] === users[0] // true
```

这是因为对象是引用类型，`map()` 创建了新数组，但新数组里的对象仍然是原来的对象。

如果希望不修改原对象，应该返回新对象：

```js
const result = users.map((user) => ({
  ...user,
  age: user.age + 1
}))

result[0] === users[0] // false
```

### 现代不可变数组方法

较新的 JavaScript 提供了一些“不修改原数组”的替代方法：

| 会修改原数组 | 不修改原数组的替代方法 | 作用 |
| --- | --- | --- |
| `sort()` | `toSorted()` | 返回排序后的新数组 |
| `reverse()` | `toReversed()` | 返回反转后的新数组 |
| `splice()` | `toSpliced()` | 返回增删改后的新数组 |
| 直接按下标赋值 | `with()` | 返回替换指定位置后的新数组 |

示例：

```js
const arr = [3, 1, 2]

const sorted = arr.toSorted((a, b) => a - b)

arr // [3, 1, 2]
sorted // [1, 2, 3]
```

```js
const arr = ['a', 'b', 'c']

const result = arr.with(1, 'x')

arr // ['a', 'b', 'c']
result // ['a', 'x', 'c']
```

这些方法更适合需要保持原数据不变的场景。不过它们属于较新的语法，使用前要确认运行环境是否支持。

## 迭代数组

迭代数组，就是按顺序访问数组中的元素。除了传统 `for` 和 `for...of`，数组还提供了一组常用迭代器方法：

- `forEach()`
- `map()`
- `filter()`
- `find()`
- `findIndex()`
- `every()`
- `some()`
- `reduce()`
- `reduceRight()`

这些方法都会接收一个回调函数。常见回调参数是：

```js
array.method((item, index, array) => {
  // item：当前元素
  // index：当前下标
  // array：原数组
})
```

大多数迭代器方法不会修改原数组，但如果你在回调里主动修改对象或数组，原数据仍然可能变化。

### for

传统 `for` 循环最灵活，可以访问下标，也可以中途 `break` 或 `continue`：

```js
const arr = ['a', 'b', 'c']

for (let i = 0; i < arr.length; i += 1) {
  console.log(i, arr[i])
}
```

适合需要下标、需要提前终止、需要精细控制循环过程的场景。

### for...of

`for...of` 用来遍历数组元素，写法更简洁：

```js
const arr = ['a', 'b', 'c']

for (const item of arr) {
  console.log(item)
}
```

如果同时需要下标，可以配合 `entries()`：

```js
for (const [index, item] of arr.entries()) {
  console.log(index, item)
}
```

`for...of` 可以使用 `break` 和 `continue`。

### forEach

`forEach()` 会对每个元素执行一次回调。它不会返回新数组，返回值是 `undefined`。

```js
const arr = ['a', 'b', 'c']

arr.forEach((item, index) => {
  console.log(index, item)
})
```

`forEach()` 适合执行副作用，例如打印日志、调用接口、修改外部变量：

```js
let sum = 0

[1, 2, 3].forEach((item) => {
  sum += item
})

sum // 6
```

`forEach()` 不能用 `break` 提前结束。如果需要提前终止，通常使用 `for`、`for...of`、`some()`、`every()` 或 `find()`。

### map

`map()` 会把每个元素映射成新值，并返回一个新数组。它不会修改原数组。

```js
const arr = [1, 2, 3]

const result = arr.map((item) => item * 2)

result // [2, 4, 6]
arr // [1, 2, 3]
```

适合“一进一出”的转换场景。

注意，如果 `map()` 回调没有返回值，新数组中会得到 `undefined`：

```js
const result = [1, 2, 3].map((item) => {
  item * 2
})

result // [undefined, undefined, undefined]
```

### filter

`filter()` 会根据条件筛选元素，并返回一个新数组。

```js
const arr = [1, 2, 3, 4]

const result = arr.filter((item) => item % 2 === 0)

result // [2, 4]
```

适合删除不符合条件的元素，或者筛选列表。

### find

`find()` 返回第一个满足条件的元素，并且找到后立即停止遍历：

```js
const users = [
  { id: 1, name: 'Tom' },
  { id: 2, name: 'Jerry' },
  { id: 3, name: 'Lucy' }
]

const user = users.find((item) => item.id === 2)

user // { id: 2, name: 'Jerry' }
```

找不到时返回 `undefined`：

```js
users.find((item) => item.id === 100) // undefined
```

### findIndex

`findIndex()` 返回第一个满足条件的元素下标，并且找到后立即停止遍历：

```js
const index = users.findIndex((item) => item.id === 2)

index // 1
```

找不到时返回 `-1`：

```js
users.findIndex((item) => item.id === 100) // -1
```

`find()` 适合拿元素，`findIndex()` 适合拿位置。

### every

`every()` 判断是否所有元素都满足条件。只要遇到一个不满足条件的元素，就立即返回 `false`：

```js
const arr = [1, 2, 3]

arr.every((item) => item > 0) // true
arr.every((item) => item > 1) // false
```

可以把它理解成“全部通过测试”。

### some

`some()` 判断是否至少有一个元素满足条件：

```js
const arr = [1, 2, 3]

arr.some((item) => item > 2) // true
```

只要遇到一个满足条件的元素，就立即返回 `true`：

```js
arr.some((item) => item > 10) // false
```

可以把它理解成“至少一个通过测试”。

`every()` 和 `some()` 都支持短路：一旦结果确定，就不会继续遍历后面的元素。

### reduce

`reduce()` 用来把数组归约成一个结果，可以是数字、对象、数组或其他值。

```js
const arr = [1, 2, 3]

const sum = arr.reduce((acc, item) => {
  return acc + item
}, 0)

sum // 6
```

常见用途是求和、分组、计数、把数组转换成对象：

```js
const users = [
  { id: 1, name: 'Tom' },
  { id: 2, name: 'Jerry' }
]

const userMap = users.reduce((acc, user) => {
  acc[user.id] = user
  return acc
}, {})

userMap[1].name // Tom
```

`reduce()` 的回调参数通常是：

```js
arr.reduce((accumulator, currentValue, index, array) => {
  return accumulator
}, initialValue)
```

- `accumulator`：累积值
- `currentValue`：当前元素
- `initialValue`：初始累积值

建议总是传入 `initialValue`，这样空数组也不会报错：

```js
[].reduce((sum, item) => sum + item, 0) // 0

// [].reduce((sum, item) => sum + item) // TypeError
```

### reduceRight

`reduceRight()` 和 `reduce()` 类似，只是遍历方向从右到左：

```js
const arr = ['a', 'b', 'c']

const result = arr.reduceRight((acc, item) => {
  return acc + item
}, '')

result // cba
```

它适合处理需要从右往左组合的场景，例如函数组合：

```js
const add1 = (value) => value + 1
const double = (value) => value * 2
const square = (value) => value * value

const fns = [add1, double, square]

const result = fns.reduceRight((value, fn) => {
  return fn(value)
}, 2)

// square(2) -> double(4) -> add1(8)
result // 9
```

### 迭代方法对比

| 方法 | 返回值 | 是否修改原数组 | 是否短路 | 常见用途 |
| --- | --- | --- | --- | --- |
| `forEach()` | `undefined` | 否 | 否 | 执行副作用 |
| `map()` | 新数组 | 否 | 否 | 转换数组 |
| `filter()` | 新数组 | 否 | 否 | 筛选数组 |
| `find()` | 元素或 `undefined` | 否 | 是 | 查找元素 |
| `findIndex()` | 下标或 `-1` | 否 | 是 | 查找下标 |
| `every()` | 布尔值 | 否 | 是 | 是否全部满足条件 |
| `some()` | 布尔值 | 否 | 是 | 是否至少一个满足条件 |
| `reduce()` | 任意值 | 否 | 否 | 从左到右聚合 |
| `reduceRight()` | 任意值 | 否 | 否 | 从右到左聚合 |

### 选择建议

- 只是遍历并执行操作：用 `forEach()` 或 `for...of`
- 需要生成同长度新数组：用 `map()`
- 需要筛选元素：用 `filter()`
- 需要找第一个元素：用 `find()`
- 需要找第一个下标：用 `findIndex()`
- 需要判断全部满足：用 `every()`
- 需要判断是否存在：用 `some()`
- 需要聚合成一个值：用 `reduce()`
- 需要从右往左聚合：用 `reduceRight()`

## 打平数组

打平数组，就是把嵌套数组展开成更少层级的数组。

### flat

`flat()` 会按照指定深度打平数组，并返回一个新数组，不会修改原数组。

默认只打平一层：

```js
const arr = [1, [2, 3], [4, [5]]]

const result = arr.flat()

result // [1, 2, 3, 4, [5]]
arr // [1, [2, 3], [4, [5]]]
```

可以传入深度参数：

```js
const arr = [1, [2, 3], [4, [5]]]

arr.flat(1) // [1, 2, 3, 4, [5]]
arr.flat(2) // [1, 2, 3, 4, 5]
```

如果不知道嵌套有多少层，可以使用 `Infinity`：

```js
const arr = [1, [2, [3, [4]]]]

arr.flat(Infinity) // [1, 2, 3, 4]
```

`flat()` 会跳过数组空位：

```js
const arr = [1, , 3, [4, , 6]]

arr.flat() // [1, 3, 4, 6]
```

### flatMap

`flatMap()` 等价于先 `map()`，再 `flat(1)`：

```js
const arr = [1, 2, 3]

const result = arr.flatMap((item) => [item, item * 2])

result // [1, 2, 2, 4, 3, 6]
```

它只会打平一层：

```js
const arr = [1, 2]

arr.flatMap((item) => [[item, item * 2]])
// [[1, 2], [2, 4]]
```

`flatMap()` 常用于一个元素生成多个元素的场景：

```js
const sentences = ['hello world', 'js array']

const words = sentences.flatMap((sentence) => sentence.split(' '))

words // ['hello', 'world', 'js', 'array']
```

也可以用来过滤元素：返回空数组表示删除当前元素。

```js
const arr = [1, 2, 3, 4]

const result = arr.flatMap((item) => {
  if (item % 2 === 0) {
    return [item]
  }
  return []
})

result // [2, 4]
```

### flat 和 flatMap 对比

| 方法 | 作用 | 打平深度 | 是否修改原数组 |
| --- | --- | --- | --- |
| `flat(depth)` | 直接打平嵌套数组 | 可指定 | 否 |
| `flatMap(callback)` | 先映射，再打平一层 | 固定一层 | 否 |

简单选择：

- 已经有嵌套数组，需要展开：用 `flat()`
- 遍历时一个元素要变成多个元素：用 `flatMap()`
- 需要打平多层：用 `flat(depth)` 或 `flat(Infinity)`

## 小结

- 优先使用数组字面量 `[]`
- 少用 `new Array(number)`，它创建的是指定长度的稀疏数组
- `Array.of()` 可以把参数明确当成元素
- `Array.from()` 适合把类数组、可迭代对象转换成数组
- `length` 可以被自动更新，也可以被手动修改
- 稀疏数组不是每个位置都有元素，日常代码应尽量避免
- 尾部增删优先用 `push()` 和 `pop()`
- 任意位置增删改可以用 `splice()`
- 不想修改原数组时，可以用 `filter()`、`slice()` 等返回新数组的方法
- `push()`、`pop()`、`shift()`、`unshift()`、`splice()`、`sort()`、`reverse()`、`fill()`、`copyWithin()` 会修改原数组
- `slice()`、`concat()`、`map()`、`filter()`、`flat()`、`flatMap()` 等不会修改原数组
- 现代环境中可以用 `toSorted()`、`toReversed()`、`toSpliced()`、`with()` 避免直接修改原数组
- 转换数组用 `map()`，筛选数组用 `filter()`，聚合结果用 `reduce()`
- 打平嵌套数组用 `flat()`，映射后打平一层用 `flatMap()`

## 导航

- 返回 [JavaScript 模块](../index.md)
