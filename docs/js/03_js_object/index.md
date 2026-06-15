    # 03 对象

对象是 JavaScript 中最重要的引用类型之一，用来组织一组相关的数据和行为。

对象由一组属性组成，属性名通常是字符串或 `Symbol`，属性值可以是任意类型。

更准确地说，一个属性不只有“名字”和“值”。对普通数据属性来说，它还带有 3 个属性特性：

- `writable`：属性值是否可以被修改
- `enumerable`：属性是否会出现在枚举操作中，例如 `for...in`、`Object.keys()`
- `configurable`：属性是否可以被删除，以及属性描述符是否可以被重新配置

这些特性统称为属性描述符的一部分，后文会用 `Object.getOwnPropertyDescriptor()` 和 `Object.defineProperty()` 展开说明。

```js
const user = {
  name: 'Tom',
  age: 18,
  sayHi() {
    console.log(`Hi, ${this.name}`)
  }
}
```

## 对象创建

### 对象字面量

对象字面量是最常见的创建方式：

```js
const user = {
  name: 'Tom',
  age: 18
}
```

当变量名和属性名相同时，可以使用属性简写：

```js
const name = 'Tom'
const age = 18

const user = {
  name,
  age
}
```

方法也可以简写：

```js
const user = {
  name: 'Tom',
  sayHi() {
    console.log(this.name)
  }
}
```

### 构造函数

构造函数通常配合 `new` 使用：

```js
function User(name, age) {
  this.name = name
  this.age = age
}

const user = new User('Tom', 18)
```

`new` 的大致过程：

1. 创建一个新对象
2. 让新对象的原型指向构造函数的 `prototype`
3. 执行构造函数，并把 `this` 指向新对象
4. 如果构造函数没有显式返回对象，则返回这个新对象

### Object.create

`Object.create(proto)` 可以创建一个指定原型的新对象：

```js
const person = {
  sayHi() {
    console.log('hi')
  }
}

const user = Object.create(person)
user.name = 'Tom'

user.sayHi() // hi
```

如果希望创建一个没有原型的纯字典对象，可以传入 `null`：

```js
const map = Object.create(null)

map.name = 'Tom'
map.toString // undefined
```

这种对象的特点是：

- 没有原型链，不会继承 `Object.prototype` 上的方法
- 不会受到 `toString`、`constructor`、`hasOwnProperty` 等内置属性名干扰
- 适合用来做“纯 key-value 字典”或计数表
- 不能直接调用 `map.hasOwnProperty(key)`，因为它本身没有这个方法

需要注意，`Object.create(null)` 不是用来阻止第三方库修改对象的。只要第三方库拿到了这个对象引用，它仍然可以新增、修改或删除这个对象自己的属性。

它真正能避免的是“原型链上的意外影响”。例如某些代码遍历对象或读取属性时，可能会碰到来自 `Object.prototype` 的属性；使用无原型对象后，这类原型继承带来的干扰会减少。它也常被用来降低原型污染带来的风险，但不能替代冻结对象、深拷贝或权限隔离。

如果要判断属性是否存在，可以使用：

```js
Object.hasOwn(map, 'name') // true
```

或者兼容旧环境：

```js
Object.prototype.hasOwnProperty.call(map, 'name') // true
```

## 属性访问

对象属性可以用点语法或中括号语法访问：

```js
const user = {
  name: 'Tom',
  'home-address': 'Shanghai'
}

user.name // Tom
user['name'] // Tom
user['home-address'] // Shanghai
```

点语法更简洁，但属性名必须是合法标识符。中括号语法可以使用变量或特殊属性名：

```js
const key = 'name'
const user = { name: 'Tom' }

user[key] // Tom
```

对象的属性名会被转换成字符串或 `Symbol`：

```js
const obj = {}

obj[1] = 'one'
obj['1'] // one
```

## 计算属性名

对象字面量中可以使用表达式作为属性名：

```js
const key = 'name'

const user = {
  [key]: 'Tom',
  [`${key}Age`]: 18
}

user.name // Tom
user.nameAge // 18
```

`Symbol` 也可以作为属性名，常用于避免命名冲突：

```js
const id = Symbol('id')

const user = {
  name: 'Tom',
  [id]: 1001
}

user[id] // 1001
```

每次调用 `Symbol()` 都会创建一个唯一值，即使描述文本相同也不相等：

```js
const a = Symbol('id')
const b = Symbol('id')

a === b // false
```

所以用 `Symbol` 做属性名时，必须保存好这个 `Symbol` 变量。后续访问属性时，只有同一个 `Symbol` 才能取到值：

```js
const id = Symbol('id')

const user = {
  [id]: 1001
}

user[id] // 1001
user[Symbol('id')] // undefined
```

这和字符串属性名不同。字符串属性名只要内容一样，就能访问同一个属性：

```js
const user = {
  name: 'Tom'
}

user['name'] // Tom
```

`Symbol` 属性常见用途：

- 给对象添加内部属性，降低和业务字段重名的概率
- 给库或框架对象添加扩展信息，避免污染普通属性名
- 配合内置 well-known symbol 改变语言默认行为，例如 `Symbol.iterator`

```js
const privateId = Symbol('privateId')

const user = {
  name: 'Tom',
  [privateId]: 1001
}

user.name // Tom
user[privateId] // 1001
```

## 属性测试

测试一个属性时，通常要先明确你想问的是哪一个问题：

- 这个属性是否能被访问到？
- 这个属性是不是对象自身拥有的？
- 这个属性是否会被枚举出来？

不同 API 回答的问题不同。

### in

`in` 会判断属性是否存在于对象自身或原型链上。只要沿着原型链能找到，就返回 `true`：

```js
const user = { name: 'Tom' }

'name' in user // true
'toString' in user // true
```

`toString` 不是 `user` 自己定义的属性，而是来自 `Object.prototype`，所以 `in` 仍然返回 `true`。

### hasOwnProperty

`hasOwnProperty` 只判断对象自身属性，不会查找原型链：

```js
const user = { name: 'Tom' }

user.hasOwnProperty('name') // true
user.hasOwnProperty('toString') // false
```

但是直接调用 `obj.hasOwnProperty()` 有两个风险：

1. 对象可能没有这个方法，例如 `Object.create(null)` 创建的无原型对象
2. 对象自身可能定义了同名属性，覆盖了原型上的方法

```js
const map = Object.create(null)
map.name = 'Tom'

// map.hasOwnProperty('name') // TypeError

const user = {
  name: 'Tom',
  hasOwnProperty: 'not a function'
}

// user.hasOwnProperty('name') // TypeError
```

因此现代代码更推荐使用 `Object.hasOwn()`：

```js
const user = { name: 'Tom' }

Object.hasOwn(user, 'name') // true
Object.hasOwn(user, 'toString') // false
```

如果需要兼容不支持 `Object.hasOwn()` 的旧环境，可以使用：

```js
Object.prototype.hasOwnProperty.call(user, 'name') // true
```

### propertyIsEnumerable

`propertyIsEnumerable()` 用来判断某个属性是否同时满足两个条件：

1. 是对象自身属性
2. `enumerable` 为 `true`

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom',
  enumerable: true
})

Object.defineProperty(user, 'secret', {
  value: 'hidden',
  enumerable: false
})

user.propertyIsEnumerable('name') // true
user.propertyIsEnumerable('secret') // false
user.propertyIsEnumerable('toString') // false
```

注意，`propertyIsEnumerable()` 不会沿原型链查找。即使原型上有这个属性，只要不是对象自身属性，就返回 `false`。

如果对象可能没有 `propertyIsEnumerable` 方法，也可以使用更稳妥的写法：

```js
Object.prototype.propertyIsEnumerable.call(user, 'name') // true
```

### 对比

| 方法 | 判断自身属性 | 查找原型链 | 要求可枚举 |
| --- | --- | --- | --- |
| `key in obj` | 是 | 是 | 否 |
| `obj.hasOwnProperty(key)` | 是 | 否 | 否 |
| `Object.hasOwn(obj, key)` | 是 | 否 | 否 |
| `obj.propertyIsEnumerable(key)` | 是 | 否 | 是 |

简单记忆：

- 想知道“能不能访问到”：用 `in`
- 想知道“是不是对象自己的”：用 `Object.hasOwn()`
- 想知道“是不是对象自己的且可枚举”：用 `propertyIsEnumerable()`

## 属性枚举

枚举属性，指的是“把对象里的属性一个个列出来”。但不是所有属性都会被所有方法列出来，关键取决于三个维度：

1. 是否是对象自身属性
2. 是否可枚举，也就是属性描述符里的 `enumerable`
3. 属性名是字符串还是 `Symbol`

### 什么是可枚举属性

对象字面量创建的普通属性，默认是可枚举的：

```js
const user = {
  name: 'Tom',
  age: 18
}

Object.keys(user) // ['name', 'age']
```

使用 `Object.defineProperty()` 创建属性时，`enumerable` 默认是 `false`：

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom'
})

Object.keys(user) // []
user.name // Tom
```

这说明“能访问到”和“能枚举出来”是两回事。

### 常见枚举方法

| 方法 | 返回内容 | 是否包含原型属性 | 是否包含 Symbol |
| --- | --- | --- | --- |
| `Object.keys(obj)` | 可枚举的自身字符串属性名 | 否 | 否 |
| `Object.values(obj)` | 可枚举的自身字符串属性值 | 否 | 否 |
| `Object.entries(obj)` | 可枚举的自身字符串键值对 | 否 | 否 |
| `for...in` | 可枚举的字符串属性名 | 是 | 否 |
| `Object.getOwnPropertyNames(obj)` | 自身字符串属性名 | 否 | 否 |
| `Object.getOwnPropertySymbols(obj)` | 自身 Symbol 属性名 | 否 | 是 |
| `Reflect.ownKeys(obj)` | 自身字符串属性名和 Symbol 属性名 | 否 | 是 |

### Object.keys / values / entries

这三个方法只处理“自身 + 可枚举 + 字符串属性”：

```js
const user = {
  name: 'Tom',
  age: 18
}

Object.keys(user) // ['name', 'age']
Object.values(user) // ['Tom', 18]
Object.entries(user) // [['name', 'Tom'], ['age', 18]]
```

它们非常适合处理普通数据对象：

```js
for (const [key, value] of Object.entries(user)) {
  console.log(key, value)
}
```

### for...in

`for...in` 会遍历可枚举的字符串属性，并且会沿着原型链查找：

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

`for...in` 会遍历原型链上的可枚举属性，所以通常需要配合 `Object.hasOwn()`：

```js
for (const key in user) {
  if (Object.hasOwn(user, key)) {
    console.log(key, user[key])
  }
}
```

如果只想遍历对象自身属性，优先使用 `Object.keys()`、`Object.values()` 或 `Object.entries()`。

### 不可枚举属性

不可枚举属性不会出现在 `Object.keys()` 和 `for...in` 中，但仍然可以直接访问：

```js
const user = {}

Object.defineProperty(user, 'secret', {
  value: 'hidden',
  enumerable: false
})

user.secret // hidden
Object.keys(user) // []
```

如果想拿到自身的所有字符串属性，包括不可枚举属性，可以使用：

```js
Object.getOwnPropertyNames(user) // ['secret']
```

### Symbol 属性

`Object.keys()`、`Object.values()`、`Object.entries()` 和 `for...in` 都不会返回 `Symbol` 属性：

```js
const id = Symbol('id')

const user = {
  name: 'Tom',
  [id]: 1001
}

Object.keys(user) // ['name']
```

这并不表示 `Symbol` 属性不可访问，也不表示它不存在：

```js
user[id] // 1001
id in user // true
Object.hasOwn(user, id) // true
```

如果只想拿到自身的 `Symbol` 属性：

```js
Object.getOwnPropertySymbols(user) // [Symbol(id)]
```

如果想拿到自身的所有属性名，包括字符串属性、不可枚举属性和 `Symbol` 属性：

```js
Reflect.ownKeys(user) // ['name', Symbol(id)]
```

`JSON.stringify()` 也会忽略 `Symbol` 属性：

```js
JSON.stringify(user) // '{"name":"Tom"}'
```

所以 `Symbol` 属性更适合保存运行时内部信息，不适合保存需要通过 JSON 传输或持久化的数据。

### 简单选择

- 普通业务对象遍历：优先用 `Object.entries()`
- 只要自身可枚举属性名：用 `Object.keys()`
- 需要遍历原型链上的可枚举属性：用 `for...in`
- 需要不可枚举字符串属性：用 `Object.getOwnPropertyNames()`
- 需要 `Symbol` 属性：用 `Object.getOwnPropertySymbols()`
- 需要自身所有属性名：用 `Reflect.ownKeys()`

## 属性描述符

对象属性不只是一个值，还可以有描述信息。

数据属性描述符包含：

- `value`：属性值
- `writable`：是否可以修改
- `enumerable`：是否可以枚举
- `configurable`：是否可以删除或重新配置

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom',
  writable: false,
  enumerable: true,
  configurable: true
})

user.name // Tom
user.name = 'Jerry'
user.name // Tom
```

使用 `Object.defineProperty()` 新增属性时，`writable`、`enumerable`、`configurable` 默认都是 `false`：

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom'
})

Object.keys(user) // []
```

可以使用 `Object.getOwnPropertyDescriptor()` 查看属性描述符：

```js
Object.getOwnPropertyDescriptor(user, 'name')
// {
//   value: 'Tom',
//   writable: false,
//   enumerable: false,
//   configurable: false
// }
```

## 访问器属性

访问器属性通过 `get` 和 `set` 控制读取和设置：

```js
const user = {
  firstName: 'Tom',
  lastName: 'Lee',
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  },
  set fullName(value) {
    const [firstName, lastName] = value.split(' ')
    this.firstName = firstName
    this.lastName = lastName
  }
}

user.fullName // Tom Lee
user.fullName = 'Jerry Wang'
user.firstName // Jerry
```

访问器属性没有 `value` 和 `writable`，它使用 `get` 和 `set` 管理行为。

## 对象合并

### Object.assign

`Object.assign(target, ...sources)` 会把源对象的可枚举自身属性复制到目标对象：

```js
const target = { a: 1 }
const source = { b: 2 }

const result = Object.assign(target, source)

result // { a: 1, b: 2 }
result === target // true
```

注意，`Object.assign()` 会直接修改第一个参数 `target`，并且返回这个 `target`。

如果不希望修改原对象，通常把空对象 `{}` 作为第一个参数：

```js
const user = { name: 'Tom', age: 18 }

const copy = Object.assign({}, user)

copy // { name: 'Tom', age: 18 }
copy === user // false
```

如果属性重复，后面的源对象会覆盖前面的属性：

```js
Object.assign({}, { a: 1 }, { a: 2 }) // { a: 2 }
```

这常用于给对象设置默认值：

```js
const defaults = {
  pageSize: 10,
  current: 1
}

const options = {
  current: 2
}

const result = Object.assign({}, defaults, options)

result // { pageSize: 10, current: 2 }
```

`Object.assign()` 只复制源对象的“可枚举自身属性”，不会复制原型链上的属性，也不会复制不可枚举属性：

```js
const parent = { role: 'admin' }
const user = Object.create(parent)

user.name = 'Tom'

Object.defineProperty(user, 'secret', {
  value: 'hidden',
  enumerable: false
})

Object.assign({}, user) // { name: 'Tom' }
```

如果源对象有 `Symbol` 属性，只要它是可枚举的，也会被复制：

```js
const id = Symbol('id')
const user = {
  name: 'Tom',
  [id]: 1001
}

const copy = Object.assign({}, user)

copy[id] // 1001
```

`Object.assign()` 是浅拷贝。如果属性值是对象，复制的是引用：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const copy = Object.assign({}, user)

copy.address.city = 'Beijing'

user.address.city // Beijing
```

还有一个细节：`Object.assign()` 读取源对象属性时会触发 getter，写入目标对象属性时会触发 setter：

```js
const source = {
  get name() {
    console.log('get name')
    return 'Tom'
  }
}

const target = {
  set name(value) {
    console.log('set name:', value)
  }
}

Object.assign(target, source)

// get name
// set name: Tom
```

### 展开语法

对象展开语法 `...` 也可以用于浅拷贝和合并对象：

```js
const user = { name: 'Tom', age: 18 }
const newUser = { ...user, age: 20 }

newUser // { name: 'Tom', age: 20 }
```

它的常见用法是：

```js
const defaults = {
  pageSize: 10,
  current: 1
}

const options = {
  current: 2
}

const result = {
  ...defaults,
  ...options
}

result // { pageSize: 10, current: 2 }
```

如果属性重复，后面的属性会覆盖前面的属性：

```js
const obj = {
  ...{ a: 1 },
  ...{ a: 2 },
  b: 3
}

obj // { a: 2, b: 3 }
```

对象展开和 `Object.assign({}, source)` 一样，本质上也是浅拷贝：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const copy = { ...user }

copy.address.city = 'Beijing'

user.address.city // Beijing
```

对象展开只展开源对象的可枚举自身属性，不会展开原型链上的属性或不可枚举属性。可枚举的 `Symbol` 属性也会被复制。

对象展开比 `Object.assign()` 更常用于日常代码中，因为写法更简洁，也更适合表达“创建一个新对象”的意图。

### 展开语法的性能问题

对象展开会创建一个新对象，并把已有属性复制进去。少量对象合并时问题不大，但在循环里频繁使用时，可能产生明显的性能和内存开销。

例如下面的写法每次循环都会创建一个新对象，并重复复制之前所有属性：

```js
const list = ['a', 'b', 'c']

let result = {}

for (const key of list) {
  result = {
    ...result,
    [key]: true
  }
}

result // { a: true, b: true, c: true }
```

如果 `list` 很大，这种写法会反复复制对象，成本会不断累积。更高效的方式是直接修改同一个对象：

```js
const result = {}

for (const key of list) {
  result[key] = true
}
```

在数组的 `reduce()` 中也容易写出类似低效代码：

```js
const result = list.reduce((acc, key) => {
  return {
    ...acc,
    [key]: true
  }
}, {})
```

更适合写成：

```js
const result = list.reduce((acc, key) => {
  acc[key] = true
  return acc
}, {})
```

简单判断：

- 创建新对象、合并少量配置：适合用展开语法
- React/Vue 状态更新：适合用展开语法表达不可变更新
- 大对象、高频循环、批量构建字典：优先直接赋值或使用 `Map`

## 浅拷贝与深拷贝

浅拷贝只复制对象第一层属性。如果属性值还是对象，复制的是引用：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const copy = { ...user }

copy.name = 'Jerry'
copy.address.city = 'Beijing'

user.name // Tom
user.address.city // Beijing
```

常见浅拷贝方式：

```js
const copy1 = { ...user }
const copy2 = Object.assign({}, user)
```

深拷贝会递归复制嵌套对象。现代环境可以使用 `structuredClone()`：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const copy = structuredClone(user)

copy.address.city = 'Beijing'
user.address.city // Shanghai
```

`structuredClone()` 可以处理普通对象、数组、`Map`、`Set`、`Date` 等结构，但不能克隆函数。

`JSON.parse(JSON.stringify(obj))` 也能实现部分深拷贝，但有明显限制：

```js
const obj = {
  name: 'Tom',
  age: undefined,
  sayHi() {},
  time: new Date()
}

const copy = JSON.parse(JSON.stringify(obj))
```

这种方式会丢失 `undefined`、函数、`Symbol`，并且会把 `Date` 转成字符串。

## 克隆方式对比

JavaScript 中没有一种克隆方式适合所有场景。选择克隆方式时，主要看三个问题：

1. 需要浅拷贝还是深拷贝
2. 对象里是否有 `Date`、`Map`、`Set`、函数、`Symbol`、循环引用
3. 是否需要保留原型、属性描述符、getter/setter

| 方式 | 类型 | 优点 | 主要限制 |
| --- | --- | --- | --- |
| `{ ...obj }` | 浅拷贝 | 写法简洁，适合合并少量配置和不可变更新 | 只复制一层；不复制原型和不可枚举属性 |
| `Object.assign({}, obj)` | 浅拷贝 | 兼容性好，语义明确 | 只复制一层；会触发 getter/setter；会修改第一个参数 |
| `JSON.parse(JSON.stringify(obj))` | 深拷贝的一种简化方式 | 简单，适合纯 JSON 数据 | 丢失 `undefined`、函数、`Symbol`；`Date` 变字符串；不支持 `BigInt` 和循环引用 |
| `structuredClone(obj)` | 深拷贝 | 原生支持；能处理 `Date`、`Map`、`Set`、循环引用等 | 不能克隆函数、DOM 节点等；部分旧环境不支持 |
| `lodash.clone(obj)` | 浅拷贝 | 工具库方法，处理常见对象较方便 | 只复制一层 |
| `lodash.cloneDeep(obj)` | 深拷贝 | 使用成熟，兼容复杂对象能力较好 | 增加依赖；对函数、原型、特殊对象仍需确认行为 |
| 手写递归 clone | 可浅可深 | 可按业务定制 | 容易漏掉循环引用、`Date`、`Map`、`Set`、属性描述符等边界 |

### 展开语法

展开语法适合浅拷贝普通对象：

```js
const user = {
  name: 'Tom',
  address: {
    city: 'Shanghai'
  }
}

const copy = { ...user }

copy.name = 'Jerry'
copy.address.city = 'Beijing'

user.name // Tom
user.address.city // Beijing
```

第一层属性被复制了，所以修改 `copy.name` 不影响 `user.name`。但 `address` 仍然是同一个对象引用。

### Object.assign

`Object.assign()` 和展开语法类似，也是浅拷贝：

```js
const copy = Object.assign({}, user)
```

它的一个重要区别是会修改第一个参数：

```js
const target = {}
const result = Object.assign(target, user)

result === target // true
```

### JSON 深拷贝

JSON 深拷贝只适合“纯 JSON 数据”：

```js
const data = {
  name: 'Tom',
  scores: [90, 100]
}

const copy = JSON.parse(JSON.stringify(data))
```

不适合复杂 JavaScript 对象：

```js
const obj = {
  time: new Date(),
  fn() {},
  value: undefined,
  id: Symbol('id')
}

const copy = JSON.parse(JSON.stringify(obj))

copy.time // 字符串
copy.fn // undefined
copy.value // undefined
copy.id // undefined
```

### structuredClone

`structuredClone()` 是现代浏览器和 Node.js 中的原生深拷贝 API：

```js
const obj = {
  time: new Date(),
  map: new Map([['name', 'Tom']]),
  set: new Set([1, 2, 3])
}

const copy = structuredClone(obj)

copy.time instanceof Date // true
copy.map instanceof Map // true
copy.set instanceof Set // true
```

它也能处理循环引用：

```js
const obj = { name: 'Tom' }
obj.self = obj

const copy = structuredClone(obj)

copy.self === copy // true
```

但它不能克隆函数：

```js
// structuredClone({ fn() {} }) // DataCloneError
```

### lodash.clone 和 lodash.cloneDeep

`lodash.clone()` 是浅拷贝：

```js
const copy = _.clone(user)
```

`lodash.cloneDeep()` 是深拷贝：

```js
const copy = _.cloneDeep(user)
```

在已经使用 Lodash 的项目里，`cloneDeep` 是常见选择。但如果项目没有 Lodash，不应该只为了克隆对象就随意引入整个工具库。现代环境可以优先考虑 `structuredClone()`。

### 如何选择

- 只复制普通对象第一层：用 `{ ...obj }`
- 合并配置对象：用 `{ ...defaults, ...options }`
- 需要兼容旧环境：可以用 `Object.assign({}, obj)`
- 纯 JSON 数据深拷贝：可以用 JSON 方案
- 复杂对象深拷贝：优先考虑 `structuredClone()`
- 项目已经依赖 Lodash 且需要兼容复杂场景：可以用 `_.cloneDeep()`
- 需要保留原型、属性描述符、getter/setter：普通克隆方式都不够，需要专门实现

## 对象序列化

对象序列化，通常指把对象转换成可以存储或传输的字符串。最常见的方式是 `JSON.stringify()`：

```js
const user = {
  name: 'Tom',
  age: 18
}

const json = JSON.stringify(user)

json // '{"name":"Tom","age":18}'
```

反序列化则是把字符串还原成对象：

```js
const obj = JSON.parse(json)

obj.name // Tom
```

### 不能被正常序列化的值

`JSON.stringify()` 只能表示 JSON 支持的数据类型：对象、数组、字符串、数字、布尔值和 `null`。很多 JavaScript 特有的值不能被正常序列化。

对象属性中的 `undefined`、函数和 `Symbol` 会被忽略：

```js
const obj = {
  name: 'Tom',
  age: undefined,
  sayHi() {},
  id: Symbol('id')
}

JSON.stringify(obj) // '{"name":"Tom"}'
```

数组中的 `undefined`、函数和 `Symbol` 会变成 `null`：

```js
const arr = [1, undefined, function () {}, Symbol('id')]

JSON.stringify(arr) // '[1,null,null,null]'
```

`BigInt` 不能直接序列化，会抛出错误：

```js
const obj = {
  id: 100n
}

// JSON.stringify(obj) // TypeError: Do not know how to serialize a BigInt
```

### Date 会变成字符串

`Date` 对象会被转换成 ISO 格式字符串，反序列化后不会自动变回 `Date`：

```js
const obj = {
  time: new Date('2026-01-01T00:00:00.000Z')
}

const json = JSON.stringify(obj)
const copy = JSON.parse(json)

copy.time // '2026-01-01T00:00:00.000Z'
copy.time instanceof Date // false
```

如果需要恢复成 `Date`，需要自己转换：

```js
copy.time = new Date(copy.time)
```

### Map、Set 会丢失结构

`Map` 和 `Set` 不是普通 JSON 结构，直接序列化通常得不到想要的结果：

```js
const obj = {
  map: new Map([['name', 'Tom']]),
  set: new Set([1, 2, 3])
}

JSON.stringify(obj) // '{"map":{},"set":{}}'
```

如果要序列化它们，通常需要先转换成数组：

```js
const obj = {
  map: Array.from(new Map([['name', 'Tom']])),
  set: Array.from(new Set([1, 2, 3]))
}

JSON.stringify(obj) // '{"map":[["name","Tom"]],"set":[1,2,3]}'
```

### 循环引用会报错

如果对象内部存在循环引用，`JSON.stringify()` 会抛出错误：

```js
const obj = {
  name: 'Tom'
}

obj.self = obj

// JSON.stringify(obj) // TypeError: Converting circular structure to JSON
```

循环引用需要专门处理，例如手动去掉循环字段，或使用支持循环引用的序列化方案。

### toJSON

对象可以定义 `toJSON()` 方法，自定义序列化结果：

```js
const user = {
  name: 'Tom',
  password: 'secret',
  toJSON() {
    return {
      name: this.name
    }
  }
}

JSON.stringify(user) // '{"name":"Tom"}'
```

这常用于隐藏敏感字段或调整输出格式。

### replacer 和 space

`JSON.stringify()` 的第二个参数可以控制哪些属性被序列化：

```js
const user = {
  name: 'Tom',
  age: 18,
  password: 'secret'
}

JSON.stringify(user, ['name', 'age']) // '{"name":"Tom","age":18}'
```

也可以传入函数进行过滤：

```js
JSON.stringify(user, (key, value) => {
  if (key === 'password') {
    return undefined
  }
  return value
})
```

第三个参数 `space` 用来格式化输出：

```js
JSON.stringify(user, null, 2)
```

### JSON 序列化的适用场景

适合：

- 接口传输普通数据
- 本地存储简单配置
- 简单对象的日志输出

不适合：

- 克隆包含函数、`Date`、`Map`、`Set`、`BigInt` 的复杂对象
- 保留对象原型和方法
- 处理循环引用

## 原型与原型链

JavaScript 的对象不是通过“类”来共享能力的，底层核心是原型机制。

每个普通对象内部都有一个隐藏引用，指向另一个对象，这个被指向的对象就是它的原型。规范里把这个隐藏引用称为 `[[Prototype]]`，代码中通常用 `Object.getPrototypeOf()` 获取：

```js
const user = { name: 'Tom' }

Object.getPrototypeOf(user) === Object.prototype // true
```

可以把关系理解成：

```text
user
  └── [[Prototype]] -> Object.prototype
                         └── [[Prototype]] -> null
```

### 原型链查找规则

当访问一个属性时，JavaScript 会按下面的顺序查找：

1. 先查找对象自身属性
2. 如果自身没有，就去它的原型对象上找
3. 如果原型对象上也没有，就继续查找原型的原型
4. 一直找到 `null`
5. 如果整条链都找不到，结果就是 `undefined`

```js
const parent = {
  sayHi() {
    console.log('hi')
  }
}

const child = Object.create(parent)
child.name = 'Tom'

child.name // Tom
child.sayHi() // hi
```

查找 `child.sayHi` 的路径可以画成：

```text
访问 child.sayHi
      │
      ▼
┌──────────────┐
│ child 自身    │  有 name，没有 sayHi
└──────┬───────┘
       │ 沿 [[Prototype]] 查找
       ▼
┌──────────────┐
│ parent 原型   │  找到 sayHi
└──────┬───────┘
       │ 如果还找不到，继续沿 [[Prototype]]
       ▼
┌──────────────────┐
│ Object.prototype  │
└──────┬───────────┘
       │
       ▼
      null
```

上面代码中，`name` 是 `child` 自己的属性，`sayHi` 来自 `parent`。访问 `child.sayHi()` 时，JS 先找 `child`，找不到后沿着原型找到 `parent.sayHi`。

原型链的终点通常是 `null`：

```js
Object.getPrototypeOf(Object.prototype) // null
```

### 自身属性会覆盖原型上的同名属性

如果对象自身和原型上有同名属性，优先使用对象自身的属性：

```js
const parent = {
  name: 'parent',
  sayHi() {
    console.log(this.name)
  }
}

const child = Object.create(parent)
child.name = 'child'

child.name // child
child.sayHi() // child
```

这里的“覆盖”不是把原型属性改掉，而是属性查找时自身属性优先，因此原型上的同名属性被遮蔽了。`child.name` 不会修改 `parent.name`，只是让查找在 `child` 自身这一层就结束。

可以用 `Object.hasOwn()` 判断属性是不是对象自身拥有的：

```js
Object.hasOwn(child, 'name') // true
Object.hasOwn(child, 'sayHi') // false

'sayHi' in child // true
```

区别是：

- `Object.hasOwn(obj, key)`：只判断自身属性
- `key in obj`：判断自身属性和原型链属性

### 构造函数、prototype 和实例原型

函数可以作为构造函数使用。每个函数都有一个 `prototype` 属性，它会成为 `new` 出来的实例对象的原型：

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  console.log(`Hi, ${this.name}`)
}

const tom = new User('Tom')

tom.sayHi() // Hi, Tom
Object.getPrototypeOf(tom) === User.prototype // true
```

关系可以画成：

```text
User 函数
  └── prototype -> User.prototype

tom 实例
  └── [[Prototype]] -> User.prototype
                         └── [[Prototype]] -> Object.prototype
                                                └── [[Prototype]] -> null
```

注意区分两个概念：

- `User.prototype`：函数对象上的普通属性，主要给实例当原型
- `Object.getPrototypeOf(tom)`：实例对象内部真正指向的原型

很多文章会提到 `__proto__`，它是访问对象 `[[Prototype]]` 的历史遗留访问器：

```js
tom.__proto__ === User.prototype // true
```

但不建议在业务代码中直接使用 `__proto__`。更明确的方式是：

```js
Object.getPrototypeOf(obj)
Object.setPrototypeOf(obj, proto)
```

但频繁修改对象原型会影响性能，实际业务代码中应尽量避免。

### constructor 属性不是绝对可靠

默认情况下，构造函数的 `prototype` 对象上会有一个 `constructor` 属性，指回构造函数本身：

```js
User.prototype.constructor === User // true
tom.constructor === User // true
```

但 `constructor` 只是一个普通的原型属性，可以被改掉或被覆盖，所以不要把它当成严格类型判断依据：

```js
User.prototype = {
  sayHi() {}
}

const jerry = new User('Jerry')
jerry.constructor === User // false
```

更稳妥的判断方式通常是 `instanceof`，或者根据业务需要检查具体能力：

```js
jerry instanceof User // true
typeof jerry.sayHi === 'function' // true
```

### 原型链的意义

原型链的主要价值是共享方法，避免每个实例都重复创建同一份函数：

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  console.log(this.name)
}

const a = new User('A')
const b = new User('B')

a.sayHi === b.sayHi // true
```

如果把方法写在构造函数内部，每次 `new` 都会创建一个新函数：

```js
function User(name) {
  this.name = name
  this.sayHi = function () {
    console.log(this.name)
  }
}

const a = new User('A')
const b = new User('B')

a.sayHi === b.sayHi // false
```

所以，实例自己的数据通常放在对象自身上，共享方法通常放在原型上。

## 对象冻结与限制

### Object.preventExtensions

`Object.preventExtensions(obj)` 禁止对象新增属性，但已有属性仍然可以修改或删除：

```js
const user = { name: 'Tom' }

Object.preventExtensions(user)
user.age = 18

user.age // undefined
```

### Object.seal

`Object.seal(obj)` 禁止新增和删除属性，也不能重新配置属性描述符，但已有可写属性仍然可以修改：

```js
const user = { name: 'Tom' }

Object.seal(user)

user.name = 'Jerry'
delete user.name

user.name // Jerry
```

### Object.freeze

`Object.freeze(obj)` 会冻结对象，禁止新增、删除、修改属性：

```js
const user = { name: 'Tom' }

Object.freeze(user)

user.name = 'Jerry'
user.name // Tom
```

`Object.freeze()` 是浅冻结，嵌套对象仍然可以修改：

```js
const user = {
  address: {
    city: 'Shanghai'
  }
}

Object.freeze(user)
user.address.city = 'Beijing'

user.address.city // Beijing
```

## 常用 Object API

| API | 作用 |
| --- | --- |
| `Object.keys(obj)` | 获取对象自身可枚举字符串属性名 |
| `Object.values(obj)` | 获取对象自身可枚举字符串属性值 |
| `Object.entries(obj)` | 获取对象自身可枚举字符串键值对 |
| `Object.fromEntries(entries)` | 根据键值对创建对象 |
| `Object.assign(target, ...sources)` | 合并对象或浅拷贝 |
| `Object.create(proto)` | 创建指定原型的对象 |
| `Object.getPrototypeOf(obj)` | 获取对象原型 |
| `Object.setPrototypeOf(obj, proto)` | 设置对象原型 |
| `Object.defineProperty(obj, key, descriptor)` | 定义单个属性描述符 |
| `Object.defineProperties(obj, descriptors)` | 定义多个属性描述符 |
| `Object.getOwnPropertyDescriptor(obj, key)` | 获取单个属性描述符 |
| `Object.getOwnPropertyDescriptors(obj)` | 获取全部自身属性描述符 |
| `Object.hasOwn(obj, key)` | 判断是否为对象自身属性 |
| `Object.freeze(obj)` | 冻结对象 |
| `Object.seal(obj)` | 密封对象 |
| `Object.preventExtensions(obj)` | 禁止对象扩展 |

`Object.entries()` 和 `Object.fromEntries()` 经常配合使用：

```js
const user = {
  name: 'Tom',
  age: 18
}

const result = Object.fromEntries(
  Object.entries(user).map(([key, value]) => [key, String(value)])
)

result // { name: 'Tom', age: '18' }
```

## 常见注意点

### 对象是引用类型

对象赋值复制的是引用，不是对象本身：

```js
const a = { name: 'Tom' }
const b = a

b.name = 'Jerry'

a.name // Jerry
```

如果需要复制对象，应使用浅拷贝或深拷贝。

### const 不代表对象不可变

`const` 只保证变量绑定不能重新赋值，不保证对象内容不能修改：

```js
const user = { name: 'Tom' }

user.name = 'Jerry' // 可以
user = {} // TypeError
```

如果希望对象内容不可变，可以使用 `Object.freeze()`。

### 属性查找会沿原型链进行

同名属性优先读取对象自身属性：

```js
const parent = { name: 'parent' }
const child = Object.create(parent)

child.name // parent

child.name = 'child'
child.name // child
```

给 `child.name` 赋值后，通常是在 `child` 自身新增或修改属性，不会直接修改 `parent.name`。

### 可枚举不等于可访问

不可枚举属性仍然可以直接访问，只是不会出现在 `Object.keys()` 或 `for...in` 中：

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom',
  enumerable: false
})

user.name // Tom
Object.keys(user) // []
```



## 迭代对象

对象默认是不可迭代的，如果想迭代对象的值，可以使用for/in或者基于Object.keys()使用for/of
如果既想要对象属性的键，又想要对象属性的值。可以Objects.entries()


## for in 和for of的差别

## 导航

- 返回 [JavaScript 模块](../index.md)
