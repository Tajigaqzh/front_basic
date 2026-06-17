# 06 类

`class` 是 JavaScript 中定义对象模板的一种语法。它让构造对象、定义方法和实现继承的写法更接近传统面向对象语言。

```js
class User {
  constructor(name, age) {
    this.name = name
    this.age = age
  }

  sayHi() {
    return `Hi, ${this.name}`
  }
}

const user = new User('Tom', 18)

user.name // Tom
user.sayHi() // Hi, Tom
```

需要注意：`class` 本质上仍然基于 JavaScript 的原型机制，它不是一种全新的对象模型。

```js
typeof User // function

Object.getPrototypeOf(user) === User.prototype // true
```

## class 基础

类通常用来描述一类对象的共同结构和行为。

```js
class Person {
  constructor(name) {
    this.name = name
  }

  walk() {
    return `${this.name} is walking`
  }
}

const p1 = new Person('Tom')
const p2 = new Person('Jerry')

p1.walk() // Tom is walking
p2.walk() // Jerry is walking
```

这里：

- `Person` 是类
- `constructor` 是构造方法
- `name` 是实例属性
- `walk` 是实例方法
- `p1`、`p2` 是实例对象

## constructor

`constructor` 是类的构造方法，会在使用 `new` 创建实例时自动执行。

```js
class User {
  constructor(name) {
    this.name = name
  }
}

const user = new User('Tom')

user.name // Tom
```

如果类中没有写 `constructor`，JavaScript 会自动添加一个空的构造方法。

```js
class Empty {}

const obj = new Empty()
```

等价于：

```js
class Empty {
  constructor() {}
}
```

构造方法主要用来初始化实例属性。

```js
class Product {
  constructor(title, price) {
    this.title = title
    this.price = price
  }
}

const book = new Product('JavaScript', 99)
```

## 实例属性

实例属性是每个实例对象自己拥有的属性。

```js
class Counter {
  constructor() {
    this.count = 0
  }

  increment() {
    this.count++
    return this.count
  }
}

const c1 = new Counter()
const c2 = new Counter()

c1.increment() // 1
c1.increment() // 2
c2.increment() // 1
```

`c1` 和 `c2` 各自有自己的 `count`，互不影响。

现代 JavaScript 也支持直接在类中声明实例字段：

```js
class Counter {
  count = 0

  increment() {
    this.count++
    return this.count
  }
}
```

这和在 `constructor` 中写 `this.count = 0` 的效果类似。

## 公有属性

公有属性就是可以在类外部直接访问和修改的属性。

```js
class User {
  name = 'anonymous'

  constructor(age) {
    this.age = age
  }
}

const user = new User(18)

user.name // anonymous
user.age // 18

user.name = 'Tom'
user.age = 20
```

这里的 `name` 和 `age` 都是公有属性。

公有属性有两种常见写法。

写在 `constructor` 中：

```js
class User {
  constructor(name) {
    this.name = name
  }
}
```

写成类字段：

```js
class User {
  name = 'anonymous'
}
```

如果属性的初始值来自创建实例时传入的参数，通常写在 `constructor` 中。

```js
class User {
  constructor(name, age) {
    this.name = name
    this.age = age
  }
}
```

如果属性有固定默认值，可以写成类字段。

```js
class Counter {
  count = 0
}
```

## 实例方法

定义在类中的普通方法会放在类的 `prototype` 上，被所有实例共享。

```js
class User {
  constructor(name) {
    this.name = name
  }

  sayHi() {
    return `Hi, ${this.name}`
  }
}

const user1 = new User('Tom')
const user2 = new User('Jerry')

user1.sayHi === user2.sayHi // true
```

这说明 `sayHi` 不是每个实例各自复制一份，而是通过原型共享。

```js
user1.sayHi === User.prototype.sayHi // true
```

## 静态属性和静态方法

使用 `static` 定义的属性或方法属于类本身，不属于实例。

```js
class MathTool {
  static version = '1.0.0'

  static add(a, b) {
    return a + b
  }
}

MathTool.version // 1.0.0
MathTool.add(1, 2) // 3
```

实例不能直接访问静态方法：

```js
const tool = new MathTool()

// tool.add(1, 2) // TypeError
```

静态方法常用于工具方法、工厂方法或和类整体相关的逻辑。

```js
class User {
  constructor(name) {
    this.name = name
  }

  static createAnonymous() {
    return new User('anonymous')
  }
}

const user = User.createAnonymous()

user.name // anonymous
```

### 静态字段

静态字段是定义在类本身上的属性，使用 `static` 声明。

```js
class Config {
  static appName = 'demo'
  static version = '1.0.0'
}

Config.appName // demo
Config.version // 1.0.0
```

静态字段不会出现在实例对象上。

```js
const config = new Config()

config.appName // undefined
```

静态字段适合保存和类整体有关的数据，比如默认配置、版本号、类型标识。

```js
class Role {
  static ADMIN = 'admin'
  static USER = 'user'
}

Role.ADMIN // admin
```

## getter 和 setter

`get` 和 `set` 可以把方法包装成属性访问的形式。

```js
class Rectangle {
  constructor(width, height) {
    this.width = width
    this.height = height
  }

  get area() {
    return this.width * this.height
  }
}

const rect = new Rectangle(10, 20)

rect.area // 200
```

`area` 看起来像属性，但本质上会执行 `get area()`。

`set` 可以拦截属性赋值：

```js
class User {
  constructor(name) {
    this.name = name
  }

  get displayName() {
    return this.name
  }

  set displayName(value) {
    if (!value) {
      throw new Error('name 不能为空')
    }

    this.name = value
  }
}

const user = new User('Tom')

user.displayName // Tom

user.displayName = 'Jerry'
user.name // Jerry
```

## 私有字段和私有方法

类中可以使用 `#` 定义私有成员。私有成员只能在类内部访问。

```js
class BankAccount {
  #balance = 0

  deposit(amount) {
    if (amount <= 0) {
      return
    }

    this.#balance += amount
  }

  getBalance() {
    return this.#balance
  }
}

const account = new BankAccount()

account.deposit(100)
account.getBalance() // 100

// account.#balance // SyntaxError
```

私有方法也可以用 `#`：

```js
class User {
  #formatName(name) {
    return name.trim().toLowerCase()
  }

  setName(name) {
    this.name = this.#formatName(name)
  }
}
```

私有成员适合隐藏内部实现，避免外部代码随意修改对象状态。

### 私有属性

私有属性也是实例属性，但只能在类内部访问。

```js
class User {
  #name

  constructor(name) {
    this.#name = name
  }

  getName() {
    return this.#name
  }
}

const user = new User('Tom')

user.getName() // Tom

// user.#name // SyntaxError
```

私有属性必须先在类中声明，不能像普通属性一样随手添加。

```js
class User {
  #name = 'Tom'

  setName(name) {
    this.#name = name
  }
}
```

下面这种写法是不允许的：

```js
class User {
  setName(name) {
    // this.#name = name // SyntaxError
  }
}
```

私有属性和公有属性的区别：

| 对比点 | 公有属性 | 私有属性 |
|---|---|---|
| 写法 | `this.name` / `name = 'Tom'` | `#name` |
| 访问位置 | 类内部和外部都可以访问 | 只能在类内部访问 |
| 是否能随时新增 | 可以 | 必须先声明 |
| 常见用途 | 暴露给外部使用的数据 | 不希望外部直接修改的内部状态 |

## extends 继承

`extends` 可以让一个类继承另一个类。

```js
class Animal {
  constructor(name) {
    this.name = name
  }

  speak() {
    return `${this.name} makes a sound`
  }
}

class Dog extends Animal {
  bark() {
    return `${this.name} barks`
  }
}

const dog = new Dog('Lucky')

dog.speak() // Lucky makes a sound
dog.bark() // Lucky barks
```

这里 `Dog` 继承了 `Animal`，所以 `dog` 可以访问 `Animal.prototype` 上的 `speak` 方法。

## super

在子类中，`super` 有两个常见作用：

- 调用父类构造方法：`super(...)`
- 调用父类方法：`super.method()`

如果子类写了自己的 `constructor`，必须先调用 `super()`，然后才能使用 `this`。

```js
class Animal {
  constructor(name) {
    this.name = name
  }
}

class Dog extends Animal {
  constructor(name, color) {
    super(name)
    this.color = color
  }
}

const dog = new Dog('Lucky', 'black')

dog.name // Lucky
dog.color // black
```

### 构造函数中使用 super 的注意事项

子类如果没有写 `constructor`，会默认调用父类构造方法。

```js
class Animal {
  constructor(name) {
    this.name = name
  }
}

class Dog extends Animal {}

const dog = new Dog('Lucky')

dog.name // Lucky
```

上面的 `Dog` 大致等价于：

```js
class Dog extends Animal {
  constructor(...args) {
    super(...args)
  }
}
```

如果子类写了自己的 `constructor`，就必须手动调用 `super()`。

```js
class Dog extends Animal {
  constructor(name) {
    super(name)
  }
}
```

在调用 `super()` 之前，不能使用 `this`。

```js
class Dog extends Animal {
  constructor(name) {
    // this.name = name // ReferenceError

    super(name)

    this.type = 'dog'
  }
}
```

原因是：子类实例需要先由父类构造方法创建和初始化，然后子类才能继续给这个实例添加自己的属性。

`super()` 在子类构造函数中只能调用一次。

```js
class Dog extends Animal {
  constructor(name) {
    super(name)

    // super(name) // ReferenceError
  }
}
```

`super()` 只能在派生类的 `constructor` 中作为函数调用，不能在普通方法中这样调用。

```js
class Dog extends Animal {
  speak() {
    // super() // SyntaxError

    return super.speak()
  }
}
```

如果父类构造函数需要参数，子类要负责把参数传给 `super()`。

```js
class Animal {
  constructor(name, age) {
    this.name = name
    this.age = age
  }
}

class Dog extends Animal {
  constructor(name, age, color) {
    super(name, age)
    this.color = color
  }
}

const dog = new Dog('Lucky', 3, 'black')

dog.name // Lucky
dog.age // 3
dog.color // black
```

如果父类构造函数显式返回一个对象，子类中的 `this` 会指向这个返回对象。

```js
class Parent {
  constructor() {
    return {
      fromParent: true
    }
  }
}

class Child extends Parent {
  constructor() {
    super()
    this.fromChild = true
  }
}

const child = new Child()

child.fromParent // true
child.fromChild // true
child instanceof Child // false
```

实际开发中，构造函数通常不主动返回对象，否则会破坏正常的原型关系。

简单总结：

```js
子类没有 constructor：默认执行 super(...args)
子类有 constructor：必须先执行 super()，再使用 this
super() 只能在子类 constructor 中调用一次
父类需要参数时，子类通过 super(...) 传递
构造函数不要随意 return 对象
```

调用父类方法：

```js
class Animal {
  speak() {
    return 'animal sound'
  }
}

class Dog extends Animal {
  speak() {
    return `${super.speak()} and dog barks`
  }
}

const dog = new Dog()

dog.speak() // animal sound and dog barks
```

## 方法重写

子类中定义和父类同名的方法，会覆盖父类方法。

```js
class Animal {
  speak() {
    return 'animal sound'
  }
}

class Cat extends Animal {
  speak() {
    return 'meow'
  }
}

const cat = new Cat()

cat.speak() // meow
```

这叫方法重写。

如果仍然想复用父类逻辑，可以使用 `super`。

```js
class Cat extends Animal {
  speak() {
    return `${super.speak()} -> meow`
  }
}
```

## this 指向

类方法中的 `this` 通常指向调用这个方法的实例。

```js
class User {
  constructor(name) {
    this.name = name
  }

  sayHi() {
    return this.name
  }
}

const user = new User('Tom')

user.sayHi() // Tom
```

但是如果把方法单独取出来调用，`this` 可能会丢失。

```js
const fn = user.sayHi

// fn() // TypeError，this 是 undefined
```

常见解决方式是使用 `bind`：

```js
const fn = user.sayHi.bind(user)

fn() // Tom
```

也可以使用箭头函数字段，让方法自动捕获实例 `this`：

```js
class User {
  constructor(name) {
    this.name = name
  }

  sayHi = () => {
    return this.name
  }
}

const user = new User('Tom')
const fn = user.sayHi

fn() // Tom
```

不过这种写法会让每个实例都创建一份 `sayHi` 函数，不再通过原型共享。

## class 和原型

`class` 是原型继承的语法糖。

```js
class User {
  constructor(name) {
    this.name = name
  }

  sayHi() {
    return `Hi, ${this.name}`
  }
}
```

大致等价于：

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}
```

类中直接定义的方法，会被放到类的 `prototype` 上。

```js
class User {
  sayHi() {
    return 'hi'
  }
}

User.prototype.sayHi // function
```

通过 `new` 创建出来的实例，会把自己的原型指向这个 `prototype`。

```js
const user = new User()

Object.getPrototypeOf(user) === User.prototype // true
```

所以实例可以访问类原型上的方法。

```js
user.sayHi() // hi
```

这背后的查找过程是：

```js
user 自身没有 sayHi
-> 去 User.prototype 上找
-> 找到 User.prototype.sayHi
```

如果方法定义在 `constructor` 里，它会成为每个实例自己的方法。

```js
class User {
  constructor() {
    this.sayHi = function () {
      return 'hi'
    }
  }
}

const u1 = new User()
const u2 = new User()

u1.sayHi === u2.sayHi // false
```

如果方法定义在类体中，它会被放到原型上，所有实例共享。

```js
class User {
  sayHi() {
    return 'hi'
  }
}

const u1 = new User()
const u2 = new User()

u1.sayHi === u2.sayHi // true
```

所以通常推荐把公共方法写在类体中，而不是写在 `constructor` 里。

## 为已有类添加方法

因为类方法本质上在 `prototype` 上，所以可以在类定义之后，继续给类的原型添加方法。

```js
class User {
  constructor(name) {
    this.name = name
  }
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const user = new User('Tom')

user.sayHi() // Hi, Tom
```

这种方式不仅影响之后创建的实例，也会影响已经创建出来的实例。

```js
class User {}

const user = new User()

User.prototype.sayHi = function () {
  return 'hi'
}

user.sayHi() // hi
```

原因是实例访问方法时会沿着原型链查找，而不是在创建实例时复制一份原型方法。

也可以给内置类添加方法，但实际开发中不推荐随意修改内置对象的原型。

```js
Array.prototype.first = function () {
  return this[0]
}

[1, 2, 3].first() // 1
```

不推荐这样做的原因：

- 可能和未来标准方法重名
- 可能影响第三方库
- 所有数组实例都会受到影响

更稳妥的做法是写工具函数。

```js
function first(list) {
  return list[0]
}

first([1, 2, 3]) // 1
```

区别是 `class` 有一些更严格的规则：

- 类必须使用 `new` 调用
- 类声明不会像函数声明一样被提前调用
- 类内部默认是严格模式
- 类方法默认不可枚举

```js
class User {}

// User() // TypeError: Class constructor User cannot be invoked without 'new'
```

## class 和构造函数

在 ES6 之前，通常用普通函数作为构造函数来创建对象。

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const user = new User('Tom')

user.sayHi() // Hi, Tom
```

ES6 之后，可以用 `class` 写成更清晰的形式。

```js
class User {
  constructor(name) {
    this.name = name
  }

  sayHi() {
    return `Hi, ${this.name}`
  }
}

const user = new User('Tom')

user.sayHi() // Hi, Tom
```

这两种写法创建出来的对象都依赖原型链。

```js
Object.getPrototypeOf(user) === User.prototype // true
```

但 `class` 和普通构造函数有几个重要区别。

| 对比点 | 普通构造函数 | class |
|---|---|---|
| 调用方式 | 可以直接调用，也可以 `new` 调用 | 必须使用 `new` 调用 |
| 方法位置 | 通常手动挂到 `prototype` 上 | 类体中的方法自动放到 `prototype` 上 |
| 严格模式 | 取决于代码环境 | 类内部默认严格模式 |
| 提升 | 函数声明可以提前调用 | 类声明不能提前使用 |
| 可枚举性 | 手动挂载的方法默认可枚举 | 类方法默认不可枚举 |

普通构造函数如果忘记使用 `new`，可能会出现问题。

```js
function User(name) {
  this.name = name
}

// User('Tom')
```

在非严格模式下，直接调用构造函数时，`this` 可能指向全局对象，导致意外修改全局变量。

`class` 可以避免这种误用。

```js
class User {
  constructor(name) {
    this.name = name
  }
}

// User('Tom') // TypeError
```

所以可以这样理解：

```js
构造函数：JavaScript 早期创建对象模板的方式
class：基于构造函数和原型机制提供的更规范语法
```

## 构造函数和 new.target

`new.target` 可以用来判断函数或类是不是通过 `new` 调用的。

在普通函数中：

```js
function User(name) {
  console.log(new.target)
  this.name = name
}

User('Tom') // undefined
new User('Tom') // function User
```

当函数直接调用时，`new.target` 是 `undefined`。

当函数通过 `new` 调用时，`new.target` 指向被 `new` 调用的构造函数。

可以用它防止构造函数被普通调用。

```js
function User(name) {
  if (!new.target) {
    throw new Error('User 必须使用 new 调用')
  }

  this.name = name
}

// User('Tom') // Error

const user = new User('Tom')
```

在类中，`constructor` 里的 `new.target` 通常指向当前被实例化的类。

```js
class User {
  constructor(name) {
    console.log(new.target === User)
    this.name = name
  }
}

new User('Tom') // true
```

在继承中，如果通过子类创建实例，父类构造方法里的 `new.target` 指向子类。

```js
class Animal {
  constructor() {
    console.log(new.target.name)
  }
}

class Dog extends Animal {}

new Animal() // Animal
new Dog() // Dog
```

这个特性可以用来模拟抽象类：父类只提供公共逻辑，不允许直接实例化。

```js
class Animal {
  constructor(name) {
    if (new.target === Animal) {
      throw new Error('Animal 不能直接实例化')
    }

    this.name = name
  }
}

class Dog extends Animal {}

// new Animal('animal') // Error

const dog = new Dog('Lucky')

dog.name // Lucky
```

简单总结：

```js
new.target === undefined：函数不是通过 new 调用
new.target === 当前构造函数：直接 new 当前构造函数
new.target === 子类：通过子类触发父类 constructor
```

## class 的提升

类声明会创建绑定，但不能在声明之前使用。

```js
// const user = new User() // ReferenceError

class User {}
```

这一点和函数声明不同。

```js
sayHi() // hi

function sayHi() {
  return 'hi'
}
```

实际开发中，通常先定义类，再创建实例。

## instanceof

`instanceof` 可以判断一个对象是否来自某个构造函数或类的原型链。

```js
class User {}

const user = new User()

user instanceof User // true
user instanceof Object // true
```

继承场景：

```js
class Animal {}
class Dog extends Animal {}

const dog = new Dog()

dog instanceof Dog // true
dog instanceof Animal // true
dog instanceof Object // true
```

`instanceof` 判断的是原型链，不是对象自身是否直接由某个类创建。

## 类表达式

类也可以像函数一样作为表达式赋值给变量。

```js
const User = class {
  constructor(name) {
    this.name = name
  }
}

const user = new User('Tom')
```

类表达式也可以有名字：

```js
const User = class Person {
  constructor(name) {
    this.name = name
  }
}
```

这个名字主要在类内部或调试信息中使用。

## 继承内置类

类可以继承内置对象，比如 `Array`、`Error`。

```js
class MyArray extends Array {
  first() {
    return this[0]
  }
}

const list = new MyArray(1, 2, 3)

list.length // 3
list.first() // 1
list instanceof Array // true
```

自定义错误类：

```js
class AppError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
    this.name = 'AppError'
  }
}

throw new AppError('请求失败', 'NETWORK_ERROR')
```

## 组合优先于继承

继承适合表达稳定的“是一种”关系。

```js
class Dog extends Animal {}
```

可以理解为：狗是一种动物。

但如果只是复用能力，组合通常更灵活。

```js
const canFly = {
  fly() {
    return 'flying'
  }
}

class Bird {
  constructor(name) {
    this.name = name
  }
}

Object.assign(Bird.prototype, canFly)

const bird = new Bird('Sparrow')

bird.fly() // flying
```

实际开发中不要为了复用一两个方法就设计很深的继承层级。继承层级越深，代码关系越难理解。

## 总结

```js
class：定义对象模板
constructor：初始化实例
公有属性：类外部可以直接访问和修改
私有属性：使用 # 声明，只能在类内部访问
实例属性：属于每个实例
实例方法：通常放在 prototype 上共享
static：属于类本身
静态字段：使用 static 声明的类级别属性
get / set：用属性形式访问方法逻辑
# 私有成员：只能在类内部访问
extends：继承父类
super：在 constructor 中调用父类构造方法，在普通方法中调用父类方法
instanceof：判断原型链关系
class 和原型：类方法默认放在 prototype 上
为已有类添加方法：可以修改类的 prototype
class 和构造函数：class 是更规范的构造函数语法
new.target：判断是否通过 new 调用，以及当前真正被实例化的类
```

一句话：

```js
class 是 JavaScript 基于原型继承提供的一层更清晰的面向对象语法。
```

## 导航

- 返回 [JavaScript 模块](../index.md)
