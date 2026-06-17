# 21 Wasm

WebAssembly，简称 Wasm，是一种可以在浏览器、Node.js 和其他运行时中执行的低级字节码格式。它不是用来替代 JavaScript，而是用来补充 JavaScript：把计算密集、已有原生代码、跨语言复用的部分编译成 Wasm，再由 JavaScript 负责页面、事件、网络和业务编排。

## Wasm 解决什么问题

JavaScript 很适合编写页面交互、业务逻辑和异步流程，但在一些场景里会遇到瓶颈：

- 大量数值计算
- 图片、音频、视频处理
- 压缩、解压缩、加密、哈希
- 游戏、物理模拟、图形渲染
- 复用 C、C++、Rust、Go 等语言已有代码

Wasm 的目标是提供一种接近原生性能、可移植、可沙箱执行的二进制模块格式。浏览器可以像加载 JS 一样加载 Wasm 模块，然后把它实例化为可调用的函数。

```text
C / C++ / Rust / Go
        |
        | 编译
        v
     .wasm 文件
        |
        | JS 加载和实例化
        v
浏览器或 Node.js 执行
```

## Wasm 的核心特点

Wasm 有几个重要特点：

- 二进制格式，体积通常比源码文本更小，解析速度快
- 静态类型，适合数值计算和编译型语言输出
- 沙箱执行，默认不能直接访问 DOM、文件系统或网络
- 跨平台，同一个 `.wasm` 可以在不同运行时中执行
- 可和 JavaScript 双向调用

需要注意，Wasm 不是浏览器插件，也不是新的脚本语言。它更像是一种编译目标。开发者通常不会手写 Wasm，而是用 Rust、C、C++ 等语言编译生成。

## Wasm 模块

浏览器中常见的 Wasm 文件后缀是 `.wasm`。它包含编译后的二进制指令、函数、内存声明、导入项和导出项。

一个 Wasm 模块可以：

- 导出函数给 JavaScript 调用
- 从 JavaScript 导入函数
- 声明线性内存
- 使用表来间接调用函数
- 定义全局变量

从 JavaScript 视角看，Wasm 模块通常会被加载、编译、实例化，然后通过 `instance.exports` 拿到导出的函数。

```js
const response = await fetch('./math.wasm')
const bytes = await response.arrayBuffer()
const { instance } = await WebAssembly.instantiate(bytes)

console.log(instance.exports.add(1, 2))
```

如果服务器正确设置了 `application/wasm` MIME 类型，可以使用 `instantiateStreaming` 边下载边编译：

```js
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('./math.wasm')
)

console.log(instance.exports.add(1, 2))
```

## WAT

WAT，全称 WebAssembly Text Format，是 Wasm 的文本表示形式。它主要用于学习、调试和理解 Wasm 结构。

下面是一个简单的 WAT 模块：

```wat
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add)

  (export "add" (func $add)))
```

它导出了一个 `add` 函数，接收两个 `i32` 参数，返回一个 `i32` 结果。

WAT 可以被工具编译成 `.wasm`，但在真实项目中更常见的是从高级语言直接编译到 `.wasm`。

## 基本数据类型

Wasm 是低级字节码，基础值类型比 JavaScript 少。常见类型包括：

- `i32`：32 位整数
- `i64`：64 位整数
- `f32`：32 位浮点数
- `f64`：64 位浮点数
- `v128`：128 位向量，常用于 SIMD

Wasm 函数参数和返回值通常是这些基础数值类型。字符串、对象、数组这类复杂数据不能像 JS 函数调用一样直接传入。它们通常需要放进 Wasm 的线性内存中，再通过地址和长度传递。

```text
JS 字符串
  |
  | 编码为 UTF-8 字节
  v
Wasm 内存中的一段 bytes
  |
  | 传递 pointer + length
  v
Wasm 函数读取内存
```

## 线性内存

Wasm 使用线性内存来存放数据。线性内存本质上是一段连续的 `ArrayBuffer`，JavaScript 和 Wasm 可以通过不同视图访问这段内存。

```js
const memory = new WebAssembly.Memory({
  initial: 1
})

console.log(memory.buffer.byteLength) // 65536
```

`initial: 1` 表示初始化 1 页内存。Wasm 内存以 page 为单位，每页大小是 64KB。

JavaScript 可以用 TypedArray 读取和写入 Wasm 内存：

```js
const bytes = new Uint8Array(memory.buffer)

bytes[0] = 65
bytes[1] = 66
bytes[2] = 67

console.log(bytes[0]) // 65
```

如果 Wasm 模块导出了 `memory`，JS 可以通过 `instance.exports.memory` 访问：

```js
const memory = instance.exports.memory
const view = new Uint8Array(memory.buffer)

console.log(view[0])
```

线性内存是理解 JS 和 Wasm 传递复杂数据的关键。传递字符串、数组、图片像素数据时，本质上经常是在传递内存地址和数据长度。

## JS 调用 Wasm

最简单的通信方式是 JavaScript 调用 Wasm 导出的函数。

```js
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('./math.wasm')
)

const { add } = instance.exports

console.log(add(10, 20))
```

这种方式适合参数和返回值都是数字的场景。如果涉及字符串或数组，需要额外处理编码、内存分配和释放。

实际工程中常用封装工具来隐藏这些细节。例如 Rust 生态中的 `wasm-bindgen` 可以生成 JS 胶水代码，让调用方式更接近普通 JS 模块。

```js
import init, { add } from './pkg/demo.js'

await init()

console.log(add(10, 20))
```

这里的 `demo.js` 通常不是业务手写文件，而是工具链生成的加载和转换代码。

## Wasm 调用 JS

Wasm 也可以从宿主环境导入函数，然后在执行过程中调用这些函数。

```js
const imports = {
  env: {
    log(value) {
      console.log('from wasm:', value)
    }
  }
}

const { instance } = await WebAssembly.instantiateStreaming(
  fetch('./demo.wasm'),
  imports
)
```

Wasm 模块内部如果声明了从 `env.log` 导入函数，就可以调用 JS 提供的 `log`。

这类能力常用于：

- 打日志
- 调用浏览器 API
- 获取时间、随机数等宿主能力
- 触发 JS 回调

Wasm 默认不能直接操作 DOM。如果要更新页面，通常需要 Wasm 调用 JS 函数，或者 JS 调用 Wasm 后拿到结果再更新 DOM。

## 编译链路

Wasm 一般由其他语言编译生成。常见链路如下。

Rust：

```text
Rust 源码
  |
  | wasm-pack / wasm-bindgen / cargo
  v
.wasm + JS 胶水代码 + 类型声明
```

C / C++：

```text
C / C++ 源码
  |
  | Emscripten
  v
.wasm + JS 胶水代码
```

AssemblyScript：

```text
TypeScript 风格源码
  |
  | AssemblyScript 编译器
  v
.wasm
```

不同工具链生成物不同，但最终浏览器真正执行的是 `.wasm`，JS 侧通常还会配套一层加载、内存管理和类型转换代码。

## 在前端项目中使用

在 Vite、Webpack 等项目中，常见做法是把 Wasm 当成静态资源或模块资源处理。

简单加载：

```js
const wasmUrl = new URL('./demo.wasm', import.meta.url)

const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl))
```

如果构建工具或服务器没有正确返回 `application/wasm`，`instantiateStreaming` 可能失败，可以退回到 `arrayBuffer`：

```js
const response = await fetch(wasmUrl)
const bytes = await response.arrayBuffer()
const { instance } = await WebAssembly.instantiate(bytes)
```

如果使用工具链生成的 JS 入口，通常直接导入初始化函数即可：

```js
import init, { compress } from './pkg/compress.js'

await init()

const result = compress(input)
```

具体写法取决于构建工具和 Wasm 生成工具。

## Wasm 和 Worker

Wasm 常和 Web Worker 搭配使用。Wasm 可以提升计算效率，但如果在主线程执行大量同步计算，仍然可能阻塞页面交互。Worker 可以把 Wasm 计算放到后台线程中。

```text
主线程
  |
  | postMessage 传递任务
  v
Worker 加载 Wasm 并执行计算
  |
  | postMessage 返回结果
  v
主线程更新 UI
```

这种组合适合：

- 图片压缩和滤镜
- 音视频编码、解码
- 大文件解析
- 加密、哈希、压缩
- 游戏和图形计算

如果传递大数据，应该结合 `ArrayBuffer` 的 Transferable Objects，减少线程间复制成本。

## 性能注意点

Wasm 不等于所有代码都会更快。它适合计算密集型逻辑，但不适合把普通业务代码全部迁移过去。

常见性能注意点：

- JS 和 Wasm 频繁跨边界调用有成本
- 小函数、高频调用不一定划算
- 字符串、对象、数组转换有额外成本
- 大数据传输要关注复制、转移和内存复用
- Wasm 计算放在主线程仍然可能阻塞 UI
- 首次加载有下载、编译、实例化成本

比较合理的方式是把大块、连续、计算密集的逻辑放进 Wasm，而不是把零散业务判断拆成大量 Wasm 调用。

```text
适合：
JS 调一次 Wasm -> Wasm 内部处理大量数据 -> JS 拿结果

不适合：
JS 高频循环 -> 每次只调用一个很小的 Wasm 函数
```

## 适合和不适合的场景

适合使用 Wasm：

- 已有 C、C++、Rust 代码需要在 Web 中复用
- 图像、音视频、压缩、加密等计算密集任务
- 游戏引擎、物理引擎、CAD、GIS、科学计算
- 需要稳定性能的底层算法
- 和 Worker、SIMD、SharedArrayBuffer 等能力组合优化性能

不适合使用 Wasm：

- 普通页面交互
- DOM 操作和组件渲染
- 主要瓶颈在网络请求或后端响应
- 主要逻辑是字符串拼接、表单处理、状态管理
- 体积和初始化成本比计算收益更大的小功能

## 常见误区

误区一：Wasm 会替代 JavaScript。

实际不会。Wasm 更适合底层计算，JavaScript 仍然负责页面、DOM、事件、网络、框架和业务组织。

误区二：用了 Wasm 一定更快。

不一定。性能收益取决于任务类型、数据规模、边界调用次数和内存转换成本。

误区三：Wasm 可以直接访问浏览器所有 API。

不能。Wasm 运行在沙箱中，需要通过宿主环境导入函数，再间接使用浏览器能力。

误区四：Wasm 可以直接传 JS 对象。

基础 Wasm ABI 主要处理数值。复杂对象需要序列化、内存映射或工具链生成胶水代码。

## 学习路线

建议按下面顺序理解 Wasm：

1. 先理解 Wasm 是编译目标，不是 JS 替代品。
2. 理解 `.wasm`、WAT、Module、Instance、Export、Import。
3. 掌握 JS 如何加载和实例化 Wasm。
4. 理解基础数值类型和线性内存。
5. 理解字符串、数组通过 pointer + length 传递。
6. 学习 Rust `wasm-bindgen` 或 C/C++ Emscripten。
7. 在 Worker 中运行 Wasm，处理真实计算任务。
8. 用性能分析工具判断是否真的带来收益。

## 小结

Wasm 的价值不在于替换前端技术栈，而在于给前端补上一块高性能、跨语言、可复用的底层计算能力。它适合处理大块计算和已有原生代码复用，不适合承载普通 UI 和业务逻辑。

在前端项目中，比较典型的架构是：

```text
JavaScript / 框架
  |
  | 负责 UI、状态、事件、网络
  v
Worker
  |
  | 负责后台任务和线程隔离
  v
WebAssembly
  |
  | 负责计算密集逻辑
  v
返回结果给页面
```

## 导航

- 返回 [JavaScript 模块](../index.md)
