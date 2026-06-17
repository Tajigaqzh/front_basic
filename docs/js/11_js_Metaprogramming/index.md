# 11 元编程

元编程指的是“让代码操作代码本身的结构和行为”。在 JavaScript 中，常见的元编程能力包括：

- 查看和修改属性特性
- 控制对象能否继续扩展
- 操作原型链
- 使用公认符号改变对象在语言内部的表现
- 使用模板标签改写模板字符串的求值方式
- 使用 `Reflect` 以函数形式调用对象内部操作
- 使用 `Proxy` 拦截对象的基本操作

元编程通常用于框架、库、响应式系统、校验器、ORM、权限控制、调试工具等场景。普通业务代码中也可以使用，但要注意不要让对象行为变得过于隐式。

## 1. 属性的特性

对象属性不只是一个键值对。每个属性背后都有一组“属性描述符”，用来描述这个属性能不能被修改、能不能枚举、能不能重新配置。

### 数据属性

数据属性常见的描述符有 4 个：

- `value`：属性值
- `writable`：能否修改属性值
- `enumerable`：能否被枚举
- `configurable`：能否删除或重新配置属性描述符

```js
const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom',
  writable: false,
  enumerable: true,
  configurable: true,
})

console.log(user.name) // Tom

user.name = 'Jerry'
console.log(user.name) // Tom
```

`writable: false` 表示这个属性不能被重新赋值。在严格模式下，重新赋值会直接报错。

```js
'use strict'

const user = {}

Object.defineProperty(user, 'name', {
  value: 'Tom',
  writable: false,
})

// TypeError: Cannot assign to read only property 'name'
user.name = 'Jerry'
```

### enumerable

`enumerable` 控制属性能否被 `for...in`、`Object.keys`、对象展开等方式枚举。

```js
const user = {
  name: 'Tom',
}

Object.defineProperty(user, 'password', {
  value: '123456',
  enumerable: false,
})

console.log(Object.keys(user)) // ['name']
console.log(user.password) // 123456
```

属性仍然存在，只是不会出现在常规枚举结果中。

```js
console.log(Object.getOwnPropertyNames(user))
// ['name', 'password']
```

### configurable

`configurable` 控制属性能否被删除，以及描述符能否被重新配置。

```js
const user = {}

Object.defineProperty(user, 'id', {
  value: 1,
  configurable: false,
})

delete user.id

console.log(user.id) // 1
```

一旦 `configurable` 被设置为 `false`，后续就不能再把它改回 `true`。

```js
Object.defineProperty(user, 'id', {
  configurable: true,
})
// TypeError: Cannot redefine property: id
```

### 访问器属性

访问器属性不直接保存值，而是通过 `get` 和 `set` 控制读取和写入。

```js
const user = {
  firstName: 'Tom',
  lastName: 'Green',
}

Object.defineProperty(user, 'fullName', {
  get() {
    return `${this.firstName} ${this.lastName}`
  },
  set(value) {
    const [firstName, lastName] = value.split(' ')
    this.firstName = firstName
    this.lastName = lastName
  },
  enumerable: true,
  configurable: true,
})

console.log(user.fullName) // Tom Green

user.fullName = 'Jerry White'

console.log(user.firstName) // Jerry
console.log(user.lastName) // White
```

访问器属性常用于计算属性、数据校验、兼容旧字段等场景。

### 获取属性描述符

可以使用 `Object.getOwnPropertyDescriptor` 查看某个属性的描述符。

```js
const user = {
  name: 'Tom',
}

const descriptor = Object.getOwnPropertyDescriptor(user, 'name')

console.log(descriptor)
// {
//   value: 'Tom',
//   writable: true,
//   enumerable: true,
//   configurable: true
// }
```

也可以一次性查看对象自身所有属性的描述符。

```js
const descriptors = Object.getOwnPropertyDescriptors(user)

console.log(descriptors)
```

### 批量定义属性

`Object.defineProperties` 可以一次定义多个属性。

```js
const product = {}

Object.defineProperties(product, {
  title: {
    value: 'JavaScript Guide',
    writable: true,
    enumerable: true,
  },
  price: {
    value: 99,
    writable: true,
    enumerable: true,
  },
  label: {
    get() {
      return `${this.title}: ${this.price}`
    },
    enumerable: true,
  },
})

console.log(product.label) // JavaScript Guide: 99
```

## 2. 对象的可扩展能力

JavaScript 对象默认是可扩展的，也就是可以随时添加新属性。

```js
const user = {
  name: 'Tom',
}

user.age = 18

console.log(user.age) // 18
```

元编程中经常需要限制对象结构，避免运行时被随意添加、删除或修改属性。

### Object.preventExtensions

`Object.preventExtensions` 禁止对象新增属性，但已有属性仍然可以修改和删除。

```js
const user = {
  name: 'Tom',
}

Object.preventExtensions(user)

user.age = 18

console.log(user.age) // undefined
console.log(Object.isExtensible(user)) // false
```

已有属性仍然可以修改。

```js
user.name = 'Jerry'

console.log(user.name) // Jerry
```

已有属性仍然可以删除。

```js
delete user.name

console.log(user.name) // undefined
```

### Object.seal

`Object.seal` 会密封对象：

- 不能新增属性
- 不能删除属性
- 不能重新配置属性描述符
- 已有可写属性仍然可以修改值

```js
const user = {
  name: 'Tom',
}

Object.seal(user)

user.age = 18
delete user.name
user.name = 'Jerry'

console.log(user.age) // undefined
console.log(user.name) // Jerry
console.log(Object.isSealed(user)) // true
```

### Object.freeze

`Object.freeze` 会冻结对象：

- 不能新增属性
- 不能删除属性
- 不能重新配置属性描述符
- 不能修改已有数据属性的值

```js
const config = {
  host: 'localhost',
  port: 3000,
}

Object.freeze(config)

config.port = 8080
config.debug = true

console.log(config.port) // 3000
console.log(config.debug) // undefined
console.log(Object.isFrozen(config)) // true
```

### freeze 是浅冻结

`Object.freeze` 只冻结对象的第一层。如果属性值还是对象，它里面的内容仍然可以修改。

```js
const config = {
  server: {
    host: 'localhost',
    port: 3000,
  },
}

Object.freeze(config)

config.server.port = 8080

console.log(config.server.port) // 8080
```

如果需要深冻结，可以递归处理。

```js
function deepFreeze(obj) {
  Object.freeze(obj)

  for (const key of Object.keys(obj)) {
    const value = obj[key]

    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value)
    }
  }

  return obj
}

const config = deepFreeze({
  server: {
    host: 'localhost',
    port: 3000,
  },
})

config.server.port = 8080

console.log(config.server.port) // 3000
```

## 3. prototype

JavaScript 对象通过原型链实现属性查找和继承。元编程可以读取、修改对象的原型，从而改变对象的行为来源。

### 读取对象原型

推荐使用 `Object.getPrototypeOf` 读取对象原型。

```js
const user = {
  name: 'Tom',
}

console.log(Object.getPrototypeOf(user) === Object.prototype) // true
```

数组的原型是 `Array.prototype`。

```js
const list = []

console.log(Object.getPrototypeOf(list) === Array.prototype) // true
```

### 设置对象原型

可以使用 `Object.setPrototypeOf` 修改对象原型。

```js
const animal = {
  eat() {
    return 'eating'
  },
}

const dog = {
  name: 'Lucky',
}

Object.setPrototypeOf(dog, animal)

console.log(dog.eat()) // eating
```

属性查找时，会先找对象自身属性，再沿着原型链向上查找。

```js
const base = {
  role: 'base',
}

const obj = {
  role: 'self',
}

Object.setPrototypeOf(obj, base)

console.log(obj.role) // self
```

### Object.create

`Object.create` 可以创建一个以指定对象为原型的新对象。

```js
const userMethods = {
  sayHi() {
    return `Hi, ${this.name}`
  },
}

const user = Object.create(userMethods)
user.name = 'Tom'

console.log(user.sayHi()) // Hi, Tom
console.log(Object.getPrototypeOf(user) === userMethods) // true
```

也可以创建没有原型的纯字典对象。

```js
const map = Object.create(null)

map.name = 'Tom'

console.log(map.name) // Tom
console.log(Object.getPrototypeOf(map)) // null
```

没有原型的对象不会继承 `toString`、`hasOwnProperty` 等方法，适合用来做纯键值表。

### hasOwn 和 in

`in` 会检查对象自身和原型链上的属性。

```js
const base = {
  type: 'base',
}

const obj = Object.create(base)
obj.name = 'Tom'

console.log('name' in obj) // true
console.log('type' in obj) // true
```

`Object.hasOwn` 只检查对象自身属性。

```js
console.log(Object.hasOwn(obj, 'name')) // true
console.log(Object.hasOwn(obj, 'type')) // false
```

## 4. 公认符号

公认符号是 JavaScript 内置的一组 `Symbol` 值，用来暴露语言内部的一些协议入口。对象实现这些符号属性后，就可以改变自己在某些语法或内置 API 中的行为。

### Symbol.iterator

对象实现 `Symbol.iterator` 后，就可以被 `for...of`、展开语法、数组解构等消费。

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
          return {
            value: current++,
            done: false,
          }
        }

        return {
          value: undefined,
          done: true,
        }
      },
    }
  },
}

console.log([...range]) // [1, 2, 3]
```

使用生成器可以写得更简洁。

```js
const range = {
  start: 1,
  end: 3,
  *[Symbol.iterator]() {
    for (let i = this.start; i <= this.end; i++) {
      yield i
    }
  },
}

for (const item of range) {
  console.log(item)
}
// 1
// 2
// 3
```

### Symbol.toStringTag

`Symbol.toStringTag` 可以修改 `Object.prototype.toString` 的结果。

```js
const user = {
  [Symbol.toStringTag]: 'User',
}

console.log(Object.prototype.toString.call(user))
// [object User]
```

很多内置对象也实现了这个符号。

```js
console.log(Object.prototype.toString.call(new Map()))
// [object Map]
```

### Symbol.toPrimitive

`Symbol.toPrimitive` 用来控制对象转原始值时的行为。

```js
const price = {
  value: 99,
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') {
      return `￥${this.value}`
    }

    return this.value
  },
}

console.log(String(price)) // ￥99
console.log(price + 1) // 100
```

`hint` 可能是：

- `string`
- `number`
- `default`

### Symbol.hasInstance

`Symbol.hasInstance` 可以控制 `instanceof` 的判断逻辑。

```js
class EvenNumber {
  static [Symbol.hasInstance](value) {
    return typeof value === 'number' && value % 2 === 0
  }
}

console.log(2 instanceof EvenNumber) // true
console.log(3 instanceof EvenNumber) // false
```

### Symbol.species

`Symbol.species` 用于控制派生对象的构造函数。它常见于继承数组、Promise、Map、Set 等内置类型时。

```js
class MyArray extends Array {
  static get [Symbol.species]() {
    return Array
  }
}

const list = new MyArray(1, 2, 3)
const mapped = list.map((item) => item * 2)

console.log(mapped instanceof MyArray) // false
console.log(mapped instanceof Array) // true
```

这里 `map` 返回的是普通数组，而不是 `MyArray` 实例。

## 5. 模板标签

模板标签是一个放在模板字符串前面的函数。它可以拦截模板字符串的原始文本和插值结果。

### 基础用法

```js
function tag(strings, ...values) {
  console.log(strings)
  console.log(values)
}

const name = 'Tom'
const age = 18

tag`name: ${name}, age: ${age}`

// ['name: ', ', age: ', '']
// ['Tom', 18]
```

第一个参数 `strings` 是字符串片段数组，后面的参数是插值表达式的结果。

### 拼接模板

```js
function format(strings, ...values) {
  let result = ''

  for (let i = 0; i < strings.length; i++) {
    result += strings[i]

    if (i < values.length) {
      result += String(values[i]).toUpperCase()
    }
  }

  return result
}

const name = 'tom'

const message = format`hello ${name}`

console.log(message) // hello TOM
```

### HTML 转义

模板标签常用于防止把用户输入直接拼接进 HTML。

```js
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function html(strings, ...values) {
  let result = ''

  for (let i = 0; i < strings.length; i++) {
    result += strings[i]

    if (i < values.length) {
      result += escapeHtml(values[i])
    }
  }

  return result
}

const input = '<script>alert(1)</script>'

const template = html`<div>${input}</div>`

console.log(template)
// <div>&lt;script&gt;alert(1)&lt;/script&gt;</div>
```

### raw

`strings.raw` 可以拿到没有被转义处理过的原始字符串。

```js
function showRaw(strings) {
  console.log(strings[0])
  console.log(strings.raw[0])
}

showRaw`line1\nline2`

// line1
// line2
// line1\nline2
```

普通字符串片段中的 `\n` 会被解释成换行，`strings.raw` 中的 `\n` 还是两个字符。

## 6. 反射

`Reflect` 提供了一组和对象内部操作对应的方法。很多 `Reflect` 方法和 `Proxy` 的拦截器同名，常用于在代理中转发默认行为。

### Reflect.get

`Reflect.get` 用函数形式读取属性。

```js
const user = {
  name: 'Tom',
}

console.log(Reflect.get(user, 'name')) // Tom
```

第三个参数 `receiver` 可以影响 getter 内部的 `this`。

```js
const user = {
  firstName: 'Tom',
  get fullName() {
    return `${this.firstName} Green`
  },
}

const receiver = {
  firstName: 'Jerry',
}

console.log(Reflect.get(user, 'fullName', receiver))
// Jerry Green
```

### Reflect.set

`Reflect.set` 用函数形式设置属性，并返回布尔值表示是否设置成功。

```js
const user = {
  name: 'Tom',
}

const success = Reflect.set(user, 'name', 'Jerry')

console.log(success) // true
console.log(user.name) // Jerry
```

和直接赋值不同，`Reflect.set` 更适合写成表达式判断。

```js
if (!Reflect.set(user, 'name', 'Jerry')) {
  console.log('设置失败')
}
```

### Reflect.has

`Reflect.has` 对应 `in` 操作符。

```js
const user = {
  name: 'Tom',
}

console.log(Reflect.has(user, 'name')) // true
console.log(Reflect.has(user, 'age')) // false
```

### Reflect.deleteProperty

`Reflect.deleteProperty` 对应 `delete` 操作符。

```js
const user = {
  name: 'Tom',
}

const success = Reflect.deleteProperty(user, 'name')

console.log(success) // true
console.log(user.name) // undefined
```

### Reflect.ownKeys

`Reflect.ownKeys` 可以拿到对象自身的所有属性键，包括字符串键和 Symbol 键，也包括不可枚举属性。

```js
const id = Symbol('id')

const user = {
  name: 'Tom',
  [id]: 1,
}

Object.defineProperty(user, 'password', {
  value: '123456',
  enumerable: false,
})

console.log(Reflect.ownKeys(user))
// ['name', 'password', Symbol(id)]
```

### Reflect.construct

`Reflect.construct` 用函数形式调用构造函数，相当于 `new`。

```js
class User {
  constructor(name) {
    this.name = name
  }
}

const user = Reflect.construct(User, ['Tom'])

console.log(user.name) // Tom
console.log(user instanceof User) // true
```

### Reflect.apply

`Reflect.apply` 用函数形式调用函数，并指定 `this` 和参数列表。

```js
function sum(a, b) {
  return this.base + a + b
}

const result = Reflect.apply(sum, { base: 10 }, [1, 2])

console.log(result) // 13
```

## 7. 代理

`Proxy` 可以创建一个代理对象，拦截外部对目标对象的基本操作。

```js
const target = {
  name: 'Tom',
}

const proxy = new Proxy(target, {
  get(target, key, receiver) {
    console.log('读取属性:', key)
    return Reflect.get(target, key, receiver)
  },
})

console.log(proxy.name)
// 读取属性: name
// Tom
```

`Proxy` 的第一个参数是目标对象，第二个参数是处理器对象。处理器对象里的方法叫 trap，也就是拦截器。

### get

`get` 拦截属性读取。

```js
const user = {
  name: 'Tom',
}

const proxy = new Proxy(user, {
  get(target, key, receiver) {
    if (key === 'displayName') {
      return `User: ${target.name}`
    }

    return Reflect.get(target, key, receiver)
  },
})

console.log(proxy.name) // Tom
console.log(proxy.displayName) // User: Tom
```

### set

`set` 拦截属性写入。它应该返回一个布尔值，表示写入是否成功。

```js
const user = {
  name: 'Tom',
  age: 18,
}

const proxy = new Proxy(user, {
  set(target, key, value, receiver) {
    if (key === 'age' && value < 0) {
      throw new RangeError('age 不能小于 0')
    }

    return Reflect.set(target, key, value, receiver)
  },
})

proxy.age = 20

console.log(proxy.age) // 20

proxy.age = -1
// RangeError: age 不能小于 0
```

### has

`has` 拦截 `in` 操作符。

```js
const user = {
  name: 'Tom',
  password: '123456',
}

const proxy = new Proxy(user, {
  has(target, key) {
    if (key === 'password') {
      return false
    }

    return Reflect.has(target, key)
  },
})

console.log('name' in proxy) // true
console.log('password' in proxy) // false
```

### deleteProperty

`deleteProperty` 拦截删除属性。

```js
const user = {
  id: 1,
  name: 'Tom',
}

const proxy = new Proxy(user, {
  deleteProperty(target, key) {
    if (key === 'id') {
      throw new Error('id 不能删除')
    }

    return Reflect.deleteProperty(target, key)
  },
})

delete proxy.name

console.log(proxy.name) // undefined

delete proxy.id
// Error: id 不能删除
```

### ownKeys

`ownKeys` 拦截 `Object.keys`、`Object.getOwnPropertyNames`、`Reflect.ownKeys` 等读取键的行为。

```js
const user = {
  name: 'Tom',
  password: '123456',
}

const proxy = new Proxy(user, {
  ownKeys(target) {
    return Reflect.ownKeys(target).filter((key) => key !== 'password')
  },
})

console.log(Object.keys(proxy)) // ['name']
console.log(Reflect.ownKeys(proxy)) // ['name']
```

### apply

如果代理目标是函数，可以使用 `apply` 拦截函数调用。

```js
function sum(a, b) {
  return a + b
}

const proxy = new Proxy(sum, {
  apply(target, thisArg, args) {
    console.log('调用参数:', args)
    return Reflect.apply(target, thisArg, args)
  },
})

console.log(proxy(1, 2))
// 调用参数: [1, 2]
// 3
```

### construct

如果代理目标是构造函数，可以使用 `construct` 拦截 `new`。

```js
class User {
  constructor(name) {
    this.name = name
  }
}

const UserProxy = new Proxy(User, {
  construct(target, args, newTarget) {
    console.log('创建用户:', args[0])
    return Reflect.construct(target, args, newTarget)
  },
})

const user = new UserProxy('Tom')

console.log(user.name)
// 创建用户: Tom
// Tom
```

### 用 Proxy 做响应式数据

前端框架中的响应式系统会在读取属性时收集依赖，在写入属性时触发更新。下面是一个简化版示例。

```js
let activeEffect = null

function effect(fn) {
  activeEffect = fn
  fn()
  activeEffect = null
}

const bucket = new WeakMap()

function track(target, key) {
  if (!activeEffect) {
    return
  }

  let depsMap = bucket.get(target)

  if (!depsMap) {
    depsMap = new Map()
    bucket.set(target, depsMap)
  }

  let effects = depsMap.get(key)

  if (!effects) {
    effects = new Set()
    depsMap.set(key, effects)
  }

  effects.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) {
    return
  }

  const effects = depsMap.get(key)

  if (!effects) {
    return
  }

  effects.forEach((fn) => fn())
}

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return result
    },
  })
}

const state = reactive({
  count: 0,
})

effect(() => {
  console.log('count:', state.count)
})

state.count++

// count: 0
// count: 1
```

这个例子体现了 `Proxy` 和 `Reflect` 经常一起使用：

- `Proxy` 负责拦截操作
- `Reflect` 负责保留默认行为
- 拦截器里添加额外逻辑，比如依赖收集、校验、日志、权限控制

## 总结

元编程的核心是改变或介入语言的默认行为。

- 属性描述符：控制属性能否写入、枚举、配置
- 对象扩展能力：控制对象能否新增、删除、修改属性
- prototype：控制对象的继承来源和属性查找链路
- 公认符号：接入 JavaScript 内置协议
- 模板标签：拦截模板字符串求值
- Reflect：用函数形式执行对象内部操作
- Proxy：拦截对象、函数、构造函数的基本操作

实际开发中，元编程适合封装到框架或工具函数里。越底层的能力越强，也越容易制造隐式行为，因此要优先保证代码行为可预测、可调试。
