# 手写 Promise

这份文档对应项目里的 `promise/index.ts`，目标是解释这版 `MyPromise<T>` 的整体结构、状态流转、链式调用解析和常用静态方法。

## 文件职责

`promise/index.ts` 主要做了这几件事：

1. 定义 Promise 的三种状态
2. 实现构造器里的 `resolve` 和 `reject`
3. 实现 `then / catch / finally`
4. 实现 Promise/A+ 风格的 `resolvePromise`
5. 实现常用静态方法：
   `resolve / reject / all / race / allSettled / any`

## 整体结构图

```text
MyPromise<T>
├─ state                         当前状态：pending / fulfilled / rejected
├─ value                         成功值
├─ reason                        失败原因
├─ onFulfilledCallbacks          成功回调队列
├─ onRejectedCallbacks           失败回调队列
├─ constructor(executor)         初始化并执行 executor
├─ then(...)                     链式调用核心
├─ catch(...)                    then(undefined, onRejected)
├─ finally(...)                  收尾逻辑
├─ resolvePromise(...)           解析 then 返回值
└─ static methods                resolve / reject / all / race / allSettled / any
```

## 状态流转

Promise 的状态只能从 `pending` 走向 `fulfilled` 或 `rejected`，并且只能改一次。

```text
           +-----------+
           |  pending  |
           +-----------+
            /         \
   resolve /           \ reject
          v             v
+---------------+   +--------------+
|   fulfilled   |   |   rejected   |
+---------------+   +--------------+
```

关键点：

- 初始状态一定是 `pending`
- 一旦变成 `fulfilled` 或 `rejected`，后面不能再改
- 所有挂在 `pending` 状态上的回调，会在状态落定后异步执行

## constructor 的执行流程

创建 Promise 时，执行器会立即同步执行。

```text
new MyPromise(executor)
        |
        v
创建内部 resolve / reject
        |
        v
立即执行 executor(resolve, reject)
        |
        +--------------------+
        |                    |
        v                    v
   调用 resolve          调用 reject
        |                    |
        v                    v
 fulfilled + flush      rejected + flush
```

这里的 `resolve` 并不只是“直接成功”，它还会做一件很重要的事：  
如果传入的是 Promise 或 thenable，它会继续跟随那个对象的最终状态。

## resolve 的逻辑图

`resolve` 的核心不是“赋值”，而是“判断要不要继续吸收”。

```text
resolve(value)
   |
   v
当前状态是否还是 pending?
   |
   +-- 否 -> 直接返回
   |
   +-- 是
        |
        v
value === this ?
        |
        +-- 是 -> reject(TypeError)
        |
        +-- 否
             |
             v
是否为对象或函数?
             |
             +-- 否 -> fulfilled(value)
             |
             +-- 是
                  |
                  v
             是否存在 then 方法?
                  |
                  +-- 否 -> fulfilled(value)
                  |
                  +-- 是 -> 调用 then，继续跟随其最终状态
```

这就是为什么 Promise 能处理：

```ts
MyPromise.resolve({
  then(resolve) {
    resolve(123);
  }
});
```

## then 的执行流程

`then` 是整份实现的核心。它做的不是“执行回调”这么简单，而是：

1. 创建一个新的 Promise
2. 在合适的时机执行回调
3. 解析回调返回值
4. 决定新的 Promise 最终状态

```text
当前 Promise.then(onFulfilled, onRejected)
                  |
                  v
         创建新的 promise2
                  |
                  v
      当前状态是 fulfilled / rejected / pending ?
                  |
    +-------------+-------------+
    |                           |
fulfilled / rejected         pending
    |                           |
    v                           v
异步执行对应回调           回调先入队列等待
    |                           |
    v                           v
拿到回调返回值 x           状态落定后再执行回调
    |                           |
    +-------------+-------------+
                  |
                  v
      resolvePromise(promise2, x, ...)
                  |
                  v
      决定 promise2 的最终状态
```

## 为什么需要 resolvePromise

`then` 的回调返回值可能非常复杂：

- 普通值
- 新的 `MyPromise`
- 一个 thenable 对象
- 甚至错误地返回 `promise2` 自己

所以不能简单写成：

```ts
resolve(onFulfilled(value))
```

必须经过统一解析。

### resolvePromise 流程图

```text
resolvePromise(promise2, x)
        |
        v
x === promise2 ?
        |
        +-- 是 -> reject(TypeError)
        |
        +-- 否
             |
             v
x 是否为对象或函数?
             |
             +-- 否 -> resolve(x)
             |
             +-- 是
                  |
                  v
             读取 then
                  |
                  +-- 不是函数 -> resolve(x)
                  |
                  +-- 是函数
                       |
                       v
                  调用 then(resolveLike, rejectLike)
                       |
                       v
                  递归解析返回的新值 y
```

它的作用可以概括成一句话：  
`then` 回调返回什么，`promise2` 就尽量“变成什么”。

## 回调队列为什么存在

如果 Promise 还在 `pending`，这时调用：

```ts
promise.then(...)
```

回调还不能立刻执行，因为结果还没出来。  
所以需要先缓存起来：

```text
pending Promise
   |
   +-- then(success1, fail1) -> push 到回调队列
   +-- then(success2, fail2) -> push 到回调队列
   +-- then(success3, fail3) -> push 到回调队列
   |
状态落定后
   |
   +-- flushFulfilledCallbacks()
   或
   +-- flushRejectedCallbacks()
```

而且这些回调不是同步直接跑，而是放到微任务里执行，尽量贴近原生 Promise 的行为。

## catch 和 finally

### catch

`catch` 没有额外魔法，本质就是：

```ts
then(undefined, onRejected)
```

### finally

`finally` 的特点是：

- 不管成功还是失败都会执行
- 不会吞掉原本的成功值或失败原因

流程上可以理解成：

```text
Promise settled
    |
    v
执行 onFinally()
    |
    v
onFinally 完成
    |
    +-- 原来成功 -> 继续把原 value 往后传
    |
    +-- 原来失败 -> 继续把原 reason 往后抛
```

## 静态方法说明

### `MyPromise.resolve`

- 普通值：返回成功 Promise
- Promise / thenable：跟随其最终状态

### `MyPromise.reject`

- 直接返回失败 Promise
- 不会展开传入值

### `MyPromise.all`

- 全部成功才成功
- 任意一个失败就整体失败
- 返回结果顺序和输入顺序一致

```text
[p1, p2, p3]
  |
  +-- p1 fulfilled
  +-- p2 fulfilled
  +-- p3 fulfilled
  |
  v
resolve([v1, v2, v3])
```

### `MyPromise.race`

- 谁先 settle，就跟随谁

### `MyPromise.allSettled`

- 等全部结束
- 不管成功失败，最终都 resolve

### `MyPromise.any`

- 只要有一个成功就成功
- 只有全部失败才 reject `AggregateError`

## 类型设计

这版实现已经做成了泛型：

```ts
MyPromise<T>
```

它的意义是：

- `value` 不再只是 `unknown`
- `then` 的返回值可以继续推导
- `all` / `race` / `allSettled` / `any` 的结果类型更接近原生 Promise

例如：

```ts
const p = new MyPromise<number>((resolve) => resolve(1));

const next = p.then((value) => value + 1);
// next 的类型会是 MyPromise<number>
```

## 测试用例与预期输出

这一节不是测试框架代码，而是用最典型的例子验证这版 `MyPromise` 的核心行为。  
你可以直接把这些片段放到调试文件里逐个运行。

### 1. 基础 resolve + then

```ts
new MyPromise<number>((resolve) => {
  resolve(1);
}).then((value) => {
  console.log("then:", value);
});
```

预期输出：

```text
then: 1
```

说明：

- `executor` 会同步执行
- `then` 回调会异步进入微任务
- 最终拿到成功值 `1`

### 2. 链式 then

```ts
new MyPromise<number>((resolve) => {
  resolve(1);
})
  .then((value) => value + 1)
  .then((value) => value * 10)
  .then((value) => {
    console.log("chain:", value);
  });
```

预期输出：

```text
chain: 20
```

说明：

- 第一个 `then` 返回 `2`
- 第二个 `then` 接着拿到 `2`，返回 `20`
- 最后一个 `then` 打印最终结果

### 3. catch 捕获 reject

```ts
new MyPromise((_, reject) => {
  reject("boom");
}).catch((reason) => {
  console.log("catch:", reason);
});
```

预期输出：

```text
catch: boom
```

说明：

- `catch` 本质是 `then(undefined, onRejected)`
- 拒绝原因会传给失败回调

### 4. finally 不吞值

```ts
MyPromise.resolve(100)
  .finally(() => {
    console.log("finally run");
  })
  .then((value) => {
    console.log("value:", value);
  });
```

预期输出：

```text
finally run
value: 100
```

说明：

- `finally` 一定执行
- 执行完以后，原本的成功值 `100` 仍然会继续往后传

### 5. finally 不吞错误

```ts
MyPromise.reject("failed")
  .finally(() => {
    console.log("finally run");
  })
  .catch((reason) => {
    console.log("reason:", reason);
  });
```

预期输出：

```text
finally run
reason: failed
```

说明：

- `finally` 只负责收尾
- 原本的错误不会被吞掉

### 6. resolve 吸收 thenable

```ts
MyPromise.resolve({
  then(resolve: (value: number) => void) {
    resolve(123);
  }
}).then((value) => {
  console.log("thenable:", value);
});
```

预期输出：

```text
thenable: 123
```

说明：

- 这里传入的不是 `MyPromise`
- 但因为它有 `then`，所以会被当成 thenable 吸收

### 7. all

```ts
MyPromise.all([
  MyPromise.resolve(1),
  2,
  MyPromise.resolve(3)
] as const).then((values) => {
  console.log("all:", values);
});
```

预期输出：

```text
all: [1, 2, 3]
```

说明：

- `all` 会等待所有项都成功
- 即使有普通值，也会先通过 `MyPromise.resolve` 统一处理
- 返回顺序按输入顺序保持不变

### 8. race

```ts
const slow = new MyPromise<number>((resolve) => {
  setTimeout(() => resolve(2), 50);
});

const fast = new MyPromise<number>((resolve) => {
  setTimeout(() => resolve(1), 10);
});

MyPromise.race([slow, fast] as const).then((value) => {
  console.log("race:", value);
});
```

预期输出：

```text
race: 1
```

说明：

- 谁先 settle，就跟随谁
- 这里 `fast` 更早成功，所以最终值是 `1`

### 9. allSettled

```ts
MyPromise.allSettled([
  MyPromise.resolve("ok"),
  MyPromise.reject("err")
] as const).then((results) => {
  console.log("allSettled:", results);
});
```

预期输出：

```text
allSettled: [
  { status: "fulfilled", value: "ok" },
  { status: "rejected", reason: "err" }
]
```

说明：

- 不管单项成功还是失败，`allSettled` 都会等全部结束
- 最终一定进入成功分支，返回每一项的状态

### 10. any

```ts
MyPromise.any([
  MyPromise.reject("a"),
  MyPromise.resolve("b"),
  MyPromise.reject("c")
] as const).then((value) => {
  console.log("any:", value);
});
```

预期输出：

```text
any: b
```

说明：

- 只要有一个成功，`any` 就整体成功
- 只有全部失败时才会抛 `AggregateError`

## 调试顺序图

如果你要从现象上验证实现，建议按这个顺序跑：

```text
基础 resolve/then
      |
      v
链式 then
      |
      v
catch / finally
      |
      v
resolve thenable
      |
      v
all / race
      |
      v
allSettled / any
```

这样比较容易定位问题：

- 前三步主要验证实例方法
- 中间一步验证 thenable 吸收
- 最后两步验证静态方法聚合逻辑

## 建议怎么读代码

如果你想按理解顺序读 `promise/index.ts`，建议这样看：

1. `MyPromiseState`
2. `constructor`
3. `resolve / reject`
4. 回调队列和 `flush...`
5. `then`
6. `resolvePromise`
7. `catch / finally`
8. `resolve / reject / all / race / allSettled / any`

## 对照关系

- 代码文件：`promise/index.ts`
- 文档入口：[项目首页](../../index.md)
- 相关目录：
  - `promise/`：手写 Promise 代码
  - `docs/`：当前说明文档
