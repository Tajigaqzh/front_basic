# 09 Generator 与 Iterator

这个目录用于整理 JavaScript 中的迭代器协议、可迭代协议、生成器函数，以及它们在实际开发中的使用方式。

## 1. 核心关系

Iterator 和 Generator 主要解决两个问题：

- 用统一方式逐个读取集合中的值
- 用可暂停、可恢复的函数描述一段惰性执行流程

三者关系如下：

- Iterator：一个带有 `next()` 方法的对象
- Iterable：一个实现了 `[Symbol.iterator]()` 方法的对象
- Generator：一种可以自动生成 Iterator 的函数

```js
const iterator = {
  next() {
    return {
      value: 1,
      done: false,
    };
  },
};
```

`next()` 每次返回一个对象：

- `value`：本次迭代产出的值
- `done`：是否已经迭代结束

当 `done` 为 `true` 时，表示后续不再产生有效值。

## 2. Iterator 协议

一个对象只要有符合规则的 `next()` 方法，就可以称为迭代器。

```js
function createArrayIterator(list) {
  let index = 0;

  return {
    next() {
      if (index < list.length) {
        return {
          value: list[index++],
          done: false,
        };
      }

      return {
        value: undefined,
        done: true,
      };
    },
  };
}

const iterator = createArrayIterator(["html", "css", "js"]);

console.log(iterator.next()); // { value: "html", done: false }
console.log(iterator.next()); // { value: "css", done: false }
console.log(iterator.next()); // { value: "js", done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

迭代器的重点不是数组，而是“按顺序取下一个值”这个能力。只要能不断调用 `next()`，就可以把数据源隐藏在统一接口后面。

## 3. Iterable 协议

可迭代对象必须实现 `[Symbol.iterator]()` 方法，并且这个方法要返回一个 Iterator。

```js
const userList = {
  users: ["Alice", "Bob", "Cindy"],

  [Symbol.iterator]() {
    let index = 0;
    const users = this.users;

    return {
      next() {
        if (index < users.length) {
          return {
            value: users[index++],
            done: false,
          };
        }

        return {
          value: undefined,
          done: true,
        };
      },
    };
  },
};

for (const user of userList) {
  console.log(user);
}
```

常见内置可迭代对象：

- `Array`
- `String`
- `Map`
- `Set`
- `arguments`
- `NodeList`
- `TypedArray`

普通对象默认不可迭代：

```js
const user = {
  name: "Alice",
  age: 18,
};

// TypeError: user is not iterable
// for (const item of user) {}
```

如果要遍历普通对象，可以使用 `Object.keys()`、`Object.values()`、`Object.entries()`：

```js
const user = {
  name: "Alice",
  age: 18,
};

for (const [key, value] of Object.entries(user)) {
  console.log(key, value);
}
```

## 4. `for...of`

`for...of` 用来遍历可迭代对象，它内部会自动调用对象的 `[Symbol.iterator]()` 方法。

```js
const list = [10, 20, 30];

for (const item of list) {
  console.log(item);
}
```

等价于手动执行：

```js
const list = [10, 20, 30];
const iterator = list[Symbol.iterator]();

let result = iterator.next();

while (!result.done) {
  console.log(result.value);
  result = iterator.next();
}
```

`for...of` 和 `for...in` 的区别：

| 语法 | 遍历内容 | 典型用途 |
| --- | --- | --- |
| `for...of` | 可迭代对象产出的值 | 数组、字符串、Map、Set |
| `for...in` | 对象可枚举属性名 | 普通对象属性遍历 |

```js
const list = ["a", "b"];

for (const key in list) {
  console.log(key); // "0" "1"
}

for (const value of list) {
  console.log(value); // "a" "b"
}
```

## 5. 展开语法、解构与可迭代对象

很多语法都会读取 Iterable：

- `for...of`
- 展开语法 `...`
- 数组解构
- `Array.from()`
- `new Map(iterable)`
- `new Set(iterable)`
- `Promise.all(iterable)`

```js
const set = new Set(["a", "b", "c"]);

console.log([...set]); // ["a", "b", "c"]

const [first, second] = set;

console.log(first); // "a"
console.log(second); // "b"
```

这类语法依赖的是 `[Symbol.iterator]()`，而不是对象是不是数组。

## 6. Generator 基础

生成器函数使用 `function*` 声明，函数内部可以使用 `yield` 暂停执行。

```js
function* createIdGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

const generator = createIdGenerator();

console.log(generator.next()); // { value: 1, done: false }
console.log(generator.next()); // { value: 2, done: false }
console.log(generator.next()); // { value: 3, done: false }
console.log(generator.next()); // { value: undefined, done: true }
```

调用生成器函数时，函数体不会立即执行，而是返回一个生成器对象。这个对象同时是 Iterator，也是 Iterable。

```js
function* createList() {
  yield "a";
  yield "b";
}

const generator = createList();

console.log(generator === generator[Symbol.iterator]()); // true
```

因此生成器可以直接用于 `for...of`：

```js
function* createList() {
  yield "a";
  yield "b";
}

for (const item of createList()) {
  console.log(item);
}
```

## 7. `yield` 执行流程

`yield` 有两个方向的数据流：

- 向外产出值：`yield value`
- 向内接收值：下一次 `next(value)` 传入的参数会成为上一次 `yield` 表达式的结果

```js
function* createTask() {
  const first = yield "step 1";
  console.log(first);

  const second = yield "step 2";
  console.log(second);

  return "done";
}

const task = createTask();

console.log(task.next()); // { value: "step 1", done: false }
console.log(task.next("input 1")); // 输出 input 1，然后返回 { value: "step 2", done: false }
console.log(task.next("input 2")); // 输出 input 2，然后返回 { value: "done", done: true }
```

注意：第一次调用 `next()` 传参没有意义，因为此时函数还没有暂停在任何一个 `yield` 表达式上。

```js
function* demo() {
  const value = yield "start";
  console.log(value);
}

const generator = demo();

generator.next("ignored"); // 第一次传入的参数会被忽略
generator.next("received"); // received
```

## 8. `return()` 与 `throw()`

生成器对象除了 `next()`，还可以使用 `return()` 和 `throw()` 控制执行。

### `return()`

`return()` 用来提前结束生成器。

```js
function* createList() {
  yield 1;
  yield 2;
  yield 3;
}

const generator = createList();

console.log(generator.next()); // { value: 1, done: false }
console.log(generator.return("stop")); // { value: "stop", done: true }
console.log(generator.next()); // { value: undefined, done: true }
```

### `throw()`

`throw()` 会在生成器暂停的位置抛出异常。

```js
function* createTask() {
  try {
    yield "loading";
  } catch (error) {
    console.log("catch:", error.message);
  }

  yield "retry";
}

const task = createTask();

console.log(task.next()); // { value: "loading", done: false }
console.log(task.throw(new Error("fail"))); // catch: fail，然后返回 { value: "retry", done: false }
```

## 9. `yield*`

`yield*` 用来委托另一个可迭代对象。

```js
function* createNumbers() {
  yield 1;
  yield* [2, 3, 4];
  yield 5;
}

console.log([...createNumbers()]); // [1, 2, 3, 4, 5]
```

它可以让多个生成器组合在一起：

```js
function* createHeader() {
  yield "name";
  yield "age";
}

function* createRows() {
  yield "Alice,18";
  yield "Bob,20";
}

function* createCsv() {
  yield* createHeader();
  yield* createRows();
}

console.log([...createCsv()]);
```

`yield*` 表达式的结果是被委托生成器的 `return` 值：

```js
function* child() {
  yield 1;
  return 2;
}

function* parent() {
  const result = yield* child();
  yield result;
}

console.log([...parent()]); // [1, 2]
```

## 10. 用 Generator 简化自定义迭代器

手写 Iterator 容易出现状态管理代码，生成器可以把这部分逻辑简化掉。

```js
const tree = {
  value: "root",
  children: [
    {
      value: "left",
      children: [],
    },
    {
      value: "right",
      children: [
        {
          value: "right-left",
          children: [],
        },
      ],
    },
  ],
};

function* walkTree(node) {
  yield node.value;

  for (const child of node.children) {
    yield* walkTree(child);
  }
}

console.log([...walkTree(tree)]); // ["root", "left", "right", "right-left"]
```

也可以让业务对象本身变成可迭代对象：

```js
const range = {
  start: 1,
  end: 5,

  *[Symbol.iterator]() {
    for (let value = this.start; value <= this.end; value++) {
      yield value;
    }
  },
};

console.log([...range]); // [1, 2, 3, 4, 5]
```

## 11. 惰性计算

生成器不会一次性把所有结果都算出来，而是在调用 `next()` 时才继续执行。

```js
function* createInfiniteId() {
  let id = 1;

  while (true) {
    yield id++;
  }
}

const ids = createInfiniteId();

console.log(ids.next().value); // 1
console.log(ids.next().value); // 2
console.log(ids.next().value); // 3
```

惰性计算适合：

- 大数据分页读取
- 无限序列
- 按需生成任务
- 逐步解析文本
- 遍历树、图等结构

## 12. 常见应用场景

### 分页数据逐页消费

```js
async function* fetchUsersByPage(fetchPage) {
  let page = 1;

  while (true) {
    const result = await fetchPage(page);

    if (result.list.length === 0) {
      return;
    }

    yield result.list;
    page++;
  }
}

for await (const users of fetchUsersByPage(fetchPage)) {
  console.log(users);
}
```

这里用到了异步生成器，适合和接口分页、流式数据、异步任务队列配合。

### 任务队列

```js
function* createSteps() {
  yield () => console.log("validate");
  yield () => console.log("submit");
  yield () => console.log("notify");
}

for (const runStep of createSteps()) {
  runStep();
}
```

### 生成状态机

```js
function* createTrafficLight() {
  while (true) {
    yield "red";
    yield "green";
    yield "yellow";
  }
}

const light = createTrafficLight();

console.log(light.next().value); // red
console.log(light.next().value); // green
console.log(light.next().value); // yellow
console.log(light.next().value); // red
```

## 13. Generator 和 async/await 的关系

`async/await` 可以理解为更高层的异步流程语法。早期社区中常用 Generator 配合自动执行器来写异步代码。

```js
function run(generatorFunction) {
  const generator = generatorFunction();

  function next(data) {
    const result = generator.next(data);

    if (result.done) {
      return Promise.resolve(result.value);
    }

    return Promise.resolve(result.value).then(next);
  }

  return next();
}

run(function* () {
  const user = yield fetchUser();
  const orders = yield fetchOrders(user.id);

  return orders;
});
```

现在实际业务中更推荐直接使用 `async/await`：

```js
async function loadOrders() {
  const user = await fetchUser();
  const orders = await fetchOrders(user.id);

  return orders;
}
```

Generator 更适合表达“可暂停的迭代过程”，而不是替代 `async/await`。

## 14. 易错点

### 生成器只能消费一次

```js
function* createList() {
  yield 1;
  yield 2;
}

const list = createList();

console.log([...list]); // [1, 2]
console.log([...list]); // []
```

生成器对象本身是一个有内部状态的 Iterator，被消费完之后不会自动回到起点。要重新遍历，需要重新调用生成器函数。

```js
console.log([...createList()]); // [1, 2]
console.log([...createList()]); // [1, 2]
```

### `yield` 只能在生成器函数内部使用

```js
function* createList() {
  yield 1;
}

// 普通函数中不能使用 yield
// function demo() {
//   yield 1;
// }
```

### 箭头函数不能声明为生成器

```js
// 语法错误
// const createList = *() => {};

function* createList() {
  yield 1;
}
```

### `for...of` 不会拿到最终 `return` 值

```js
function* createList() {
  yield 1;
  return 2;
}

console.log([...createList()]); // [1]

const generator = createList();

console.log(generator.next()); // { value: 1, done: false }
console.log(generator.next()); // { value: 2, done: true }
```

当 `done` 为 `true` 时，`for...of` 会结束遍历，不会把最终 `return` 值当作遍历结果。

## 15. 面试常见问题

### Iterator 和 Iterable 有什么区别？

Iterator 是“取值器”，核心是 `next()`。Iterable 是“可被迭代的对象”，核心是 `[Symbol.iterator]()`。

Iterable 调用 `[Symbol.iterator]()` 后返回 Iterator，`for...of`、展开语法、数组解构等语法依赖的是 Iterable。

### Generator 为什么可以配合 `for...of`？

因为生成器函数执行后返回的生成器对象同时满足两个协议：

- 有 `next()` 方法，所以是 Iterator
- 有 `[Symbol.iterator]()` 方法，并且返回它自己，所以也是 Iterable

### `yield` 和 `return` 有什么区别？

`yield` 会暂停函数执行，并返回 `{ value, done: false }`。后续调用 `next()` 可以从暂停位置继续。

`return` 会结束生成器，并返回 `{ value, done: true }`。结束后继续调用 `next()`，只会得到 `{ value: undefined, done: true }`。

### 为什么普通对象不能直接 `for...of`？

因为普通对象默认没有实现 `[Symbol.iterator]()`。对象属性遍历可以使用 `for...in`、`Object.keys()`、`Object.values()`、`Object.entries()`。

## 16. 小结

- Iterator 负责定义“如何取下一个值”
- Iterable 负责定义“这个对象可以被迭代”
- `for...of`、展开语法、解构、`Array.from()` 等语法都依赖 Iterable
- Generator 是创建 Iterator 的语法糖，适合表达可暂停、可恢复、惰性执行的流程
- `yield` 暂停并产出值，`next(value)` 可以把值传回生成器内部
- `yield*` 可以把迭代过程委托给另一个可迭代对象
- 生成器对象有状态，通常只能完整消费一次

## 导航

- 返回 [JavaScript 模块](../index.md)
