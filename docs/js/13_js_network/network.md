# 网络

前端网络编程的核心是：浏览器作为客户端，通过 HTTP 等协议和服务器交换数据。常见任务包括请求接口、上传文件、下载资源、处理跨域、维持实时连接和消费流式响应。

## TCP 连接与三次握手

HTTP、WebSocket 等应用层协议通常都需要依赖底层传输协议完成数据传输。最常见的是 TCP。

TCP 是面向连接的可靠传输协议。它在真正传输数据之前，需要先让客户端和服务器确认彼此都具备发送和接收能力，这个建连过程就是三次握手。

```text
客户端                                      服务器

  | -------- SYN, seq = x ---------------> |
  |                                        |
  | <---- SYN + ACK, seq = y, ack = x + 1 - |
  |                                        |
  | -------- ACK, ack = y + 1 -----------> |
  |                                        |
  |             TCP 连接建立完成             |
```

### 第一次握手

客户端向服务器发送 `SYN` 报文，表示客户端想建立连接。

```text
客户端 -> 服务器：SYN, seq = x
```

这一阶段说明：

- 客户端具备发送能力
- 客户端选择了一个初始序列号 `x`
- 服务器如果收到这个报文，说明服务器具备接收能力

但客户端此时还不知道服务器是否能发送数据，也不知道自己的发送内容是否真的被服务器收到。

### 第二次握手

服务器收到客户端的 `SYN` 后，返回 `SYN + ACK`。

```text
服务器 -> 客户端：SYN, seq = y, ACK, ack = x + 1
```

这一阶段说明：

- 服务器收到了客户端的建连请求
- 服务器确认客户端的序列号，所以返回 `ack = x + 1`
- 服务器也选择了自己的初始序列号 `y`
- 服务器具备发送能力

客户端收到这次响应后，可以确认：

- 自己能发送
- 自己能接收
- 服务器能发送
- 服务器能接收

但服务器还不知道客户端是否收到了自己的 `SYN + ACK`。

### 第三次握手

客户端收到服务器的 `SYN + ACK` 后，再发送一次 `ACK`。

```text
客户端 -> 服务器：ACK, ack = y + 1
```

服务器收到这个 `ACK` 后，可以确认客户端也收到了服务器的响应。至此，双方都确认了彼此的发送和接收能力，TCP 连接正式建立。

### 为什么需要三次握手

三次握手的核心目的不是“多发一次包”，而是让双方都确认下面几件事：

- 客户端能发送，也能接收
- 服务器能发送，也能接收
- 双方都同步了初始序列号
- 旧的、延迟到达的连接请求不会轻易变成有效连接

如果只有两次握手，服务器发送 `SYN + ACK` 后就认为连接建立，但客户端可能没有收到这次响应。服务器会误以为连接可用，从而浪费连接资源。

三次握手还能降低历史报文造成错误连接的风险。例如某个很久以前的 `SYN` 报文因为网络延迟才到达服务器，如果没有第三次确认，服务器可能会错误建立一个客户端并不需要的连接。

### 和 HTTP 请求的关系

一次常见的 HTTP 请求大致会经历这些步骤：

```text
DNS 解析域名
      |
      v
建立 TCP 连接，完成三次握手
      |
      v
如果是 HTTPS，继续完成 TLS 握手
      |
      v
发送 HTTP 请求
      |
      v
接收 HTTP 响应
```

所以浏览器发起一个 HTTPS 接口请求时，底层通常不是直接发送 HTTP 数据，而是先完成 TCP 三次握手，再完成 TLS 握手，最后才发送加密后的 HTTP 请求。

需要注意：HTTP/3 基于 QUIC，QUIC 运行在 UDP 之上，不使用 TCP 三次握手。前端日常说“HTTP 请求需要 TCP 三次握手”，通常指 HTTP/1.1 和 HTTP/2 这类基于 TCP 的场景。

## HTTP 基础

HTTP 是浏览器和服务器之间最常见的通信协议。一次 HTTP 通信通常由请求和响应组成。

```text
客户端发送请求
      |
      v
服务器处理请求
      |
      v
服务器返回响应
      |
      v
客户端处理响应
```

一个请求通常包含：

- 请求方法：例如 `GET`、`POST`
- URL：请求的资源地址
- 请求头：描述请求的元信息
- 请求体：提交给服务器的数据

一个响应通常包含：

- 状态码：表示请求处理结果
- 响应头：描述响应的元信息
- 响应体：服务器返回的数据

```http
GET /api/users?id=1 HTTP/1.1
Host: example.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"id":1,"name":"Tom"}
```

### URL

URL 用于定位网络资源。

```text
https://example.com:443/api/users?id=1#profile
```

可以拆成几部分：

- `https`：协议
- `example.com`：域名
- `443`：端口
- `/api/users`：路径
- `id=1`：查询参数
- `profile`：片段标识

在前端代码中，可以使用 `URL` 和 `URLSearchParams` 处理地址和参数。

```js
const url = new URL('/api/users', 'https://example.com')

url.searchParams.set('page', '1')
url.searchParams.set('pageSize', '20')

console.log(url.toString())
// https://example.com/api/users?page=1&pageSize=20
```

### 请求头和响应头

请求头和响应头用来传递元信息。

常见请求头：

- `Accept`：客户端期望接收的数据类型
- `Content-Type`：请求体的数据类型
- `Authorization`：身份认证信息
- `Cookie`：浏览器自动携带的 Cookie

常见响应头：

- `Content-Type`：响应体的数据类型
- `Set-Cookie`：服务器写入 Cookie
- `Cache-Control`：缓存策略
- `Access-Control-Allow-Origin`：跨域资源共享配置

## 请求方法

HTTP 方法表示这次请求想对资源做什么。

### GET

`GET` 用于获取资源，参数通常放在 URL 查询字符串里。

```js
fetch('/api/users?page=1&pageSize=20')
```

`GET` 请求一般不应该修改服务器数据。

### POST

`POST` 常用于创建资源或提交复杂数据。

```js
fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Tom'
  })
})
```

### PUT 和 PATCH

`PUT` 通常表示整体替换资源，`PATCH` 通常表示局部更新资源。

```js
fetch('/api/users/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Jerry'
  })
})
```

### DELETE

`DELETE` 用于删除资源。

```js
fetch('/api/users/1', {
  method: 'DELETE'
})
```

## 状态码

状态码用于表示服务器处理请求的结果。

### 2xx 成功

- `200 OK`：请求成功
- `201 Created`：资源创建成功
- `204 No Content`：请求成功，但没有响应体

### 3xx 重定向

- `301 Moved Permanently`：永久重定向
- `302 Found`：临时重定向
- `304 Not Modified`：资源未修改，可以使用缓存

### 4xx 客户端错误

- `400 Bad Request`：请求参数错误
- `401 Unauthorized`：未认证
- `403 Forbidden`：已认证但无权限
- `404 Not Found`：资源不存在
- `409 Conflict`：资源冲突
- `422 Unprocessable Content`：请求格式正确，但业务校验失败

### 5xx 服务端错误

- `500 Internal Server Error`：服务器内部错误
- `502 Bad Gateway`：网关收到无效响应
- `503 Service Unavailable`：服务暂时不可用
- `504 Gateway Timeout`：网关超时

前端处理接口时，不能只判断请求是否发出成功，还要判断状态码和业务状态。

```js
const response = await fetch('/api/users')

if (!response.ok) {
  throw new Error(`HTTP Error: ${response.status}`)
}

const data = await response.json()
```

## fetch

`fetch` 是浏览器原生提供的网络请求 API。它返回 Promise，适合配合 `async / await` 使用。

```js
async function getUsers() {
  const response = await fetch('/api/users')

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`)
  }

  return response.json()
}
```

### 发送 JSON

```js
async function createUser(user) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  })

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`)
  }

  return response.json()
}
```

### 读取不同响应类型

```js
const response = await fetch('/api/data')

const json = await response.json()
const text = await response.text()
const blob = await response.blob()
const buffer = await response.arrayBuffer()
```

响应体只能被读取一次。读取过 `json()` 后，不能再读取 `text()`。

### 请求取消

可以使用 `AbortController` 取消 `fetch` 请求。

```js
const controller = new AbortController()

fetch('/api/users', {
  signal: controller.signal
}).catch((error) => {
  if (error.name === 'AbortError') {
    console.log('请求已取消')
  }
})

controller.abort()
```

### 超时控制

`fetch` 没有内置超时参数，可以用 `AbortController` 包装。

```js
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}
```

### fetch 的常见特点

- 只有网络错误或请求被取消时，Promise 才会 rejected
- HTTP `404`、`500` 不会让 Promise rejected，需要手动判断 `response.ok`
- 默认不携带跨域 Cookie
- 响应体是流，只能消费一次

## XMLHttpRequest

`XMLHttpRequest` 是更早的浏览器请求 API。现在新代码通常优先使用 `fetch`，但上传进度、旧项目兼容和部分库内部仍会用到它。

```js
const xhr = new XMLHttpRequest()

xhr.open('GET', '/api/users')

xhr.onload = () => {
  if (xhr.status >= 200 && xhr.status < 300) {
    console.log(JSON.parse(xhr.responseText))
  } else {
    console.log('请求失败', xhr.status)
  }
}

xhr.onerror = () => {
  console.log('网络错误')
}

xhr.send()
```

### 上传进度

`XMLHttpRequest` 可以通过 `xhr.upload.onprogress` 监听上传进度。

```js
const file = document.querySelector('input[type="file"]').files[0]
const formData = new FormData()

formData.append('file', file)

const xhr = new XMLHttpRequest()

xhr.open('POST', '/api/upload')

xhr.upload.onprogress = (event) => {
  if (!event.lengthComputable) {
    return
  }

  const percent = Math.round((event.loaded / event.total) * 100)

  console.log(percent)
}

xhr.send(formData)
```

### 取消请求

```js
const xhr = new XMLHttpRequest()

xhr.open('GET', '/api/users')
xhr.send()

xhr.abort()
```

## axios

`axios` 是常见的第三方请求库。它可以同时在浏览器和 Node.js 中使用，常用于业务项目中的接口封装。

```js
import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 5000
})

const response = await http.get('/users')

console.log(response.data)
```

### 请求和响应拦截器

拦截器适合统一处理 token、错误提示、响应数据拆包等逻辑。

```js
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

http.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    return Promise.reject(error)
  }
)
```

### axios 和 fetch 的常见差异

- `axios` 默认会把 JSON 响应解析到 `response.data`
- `axios` 遇到非 2xx 状态码会进入 rejected
- `axios` 支持请求和响应拦截器
- `axios` 内置超时配置
- `fetch` 是浏览器原生 API，不需要额外依赖

## CORS 跨域

浏览器有同源策略限制。协议、域名、端口只要有一个不同，就属于不同源。

```text
https://example.com:443
协议: https
域名: example.com
端口: 443
```

跨域请求不是服务器不能收到，而是浏览器会根据 CORS 响应头决定是否允许前端代码读取响应。

### 简单请求

满足一定条件的请求属于简单请求，浏览器会直接发送真实请求。

常见简单请求条件：

- 方法是 `GET`、`POST` 或 `HEAD`
- 没有自定义请求头
- `Content-Type` 是 `text/plain`、`application/x-www-form-urlencoded` 或 `multipart/form-data`

### 预检请求

不满足简单请求条件时，浏览器会先发送 `OPTIONS` 预检请求。

```http
OPTIONS /api/users HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

服务器需要返回允许跨域的响应头。

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 携带 Cookie

跨域携带 Cookie 时，前端和服务端都要配置。

```js
fetch('https://api.example.com/user', {
  credentials: 'include'
})
```

服务端响应头不能把 `Access-Control-Allow-Origin` 设置成 `*`，必须是明确的源。

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

## Cookie 与凭证

Cookie 是浏览器保存并自动随请求发送的小段数据，常用于会话身份识别。

常见 Cookie 属性：

- `Expires / Max-Age`：过期时间
- `Domain`：允许携带 Cookie 的域
- `Path`：允许携带 Cookie 的路径
- `HttpOnly`：禁止 JavaScript 读取
- `Secure`：只在 HTTPS 下发送
- `SameSite`：限制跨站请求携带 Cookie

```http
Set-Cookie: sid=abc; HttpOnly; Secure; SameSite=Lax
```

前端不能读取 `HttpOnly` Cookie，但浏览器会在符合条件的请求中自动携带它。

## 文件上传

文件上传通常使用 `FormData`。

```js
const input = document.querySelector('input[type="file"]')
const file = input.files[0]
const formData = new FormData()

formData.append('file', file)
formData.append('name', file.name)

await fetch('/api/upload', {
  method: 'POST',
  body: formData
})
```

使用 `FormData` 时，不要手动设置 `Content-Type`。浏览器会自动添加正确的 `multipart/form-data` 和边界信息。

## 文件下载

下载二进制文件时，可以把响应转成 `Blob`，再创建临时链接。

```js
async function downloadFile() {
  const response = await fetch('/api/export')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'export.xlsx'
  link.click()

  URL.revokeObjectURL(url)
}
```

## 长连接与流式响应

普通 HTTP 请求通常是“一次请求，一次响应”。长连接和流式响应适合服务端持续推送数据，或者客户端逐步消费数据。

常见方案：

- 轮询：客户端定时请求
- 长轮询：服务端等待有数据后再响应
- SSE：服务器单向推送文本事件
- WebSocket：客户端和服务器双向通信
- HTTP Stream：客户端逐块读取响应体

### 读取流式响应

`fetch` 的响应体是 `ReadableStream`，可以逐块读取。

```js
async function readStream() {
  const response = await fetch('/api/stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { value, done } = await reader.read()

    if (done) {
      break
    }

    console.log(decoder.decode(value, { stream: true }))
  }
}
```

流式响应适合 AI 对话、日志输出、进度推送等场景。

## sse

SSE 的全称是 Server-Sent Events，用于服务器向浏览器单向推送文本消息。

```js
const eventSource = new EventSource('/api/events')

eventSource.onmessage = (event) => {
  console.log(event.data)
}

eventSource.onerror = () => {
  console.log('连接异常')
}
```

服务端返回的数据格式通常是：

```text
data: hello

data: world

```

SSE 的特点：

- 基于 HTTP
- 服务器到客户端单向推送
- 浏览器会自动重连
- 消息格式是文本
- 适合通知、日志、AI 流式文本等场景

如果需要客户端和服务端双向高频通信，通常使用 WebSocket。

## websocket

WebSocket 用于浏览器和服务器之间建立持久的双向通信连接。

```js
const socket = new WebSocket('wss://example.com/socket')

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    type: 'join',
    roomId: 'room-1'
  }))
})

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)

  console.log(message)
})

socket.addEventListener('close', () => {
  console.log('连接关闭')
})

socket.addEventListener('error', () => {
  console.log('连接错误')
})
```

WebSocket 的特点：

- 建立连接后可以双向发送消息
- 比轮询更适合高频实时数据
- 需要自己处理心跳、重连、鉴权和消息格式
- 常用于聊天、协同编辑、实时行情、游戏状态同步

### WebSocket 升级过程

WebSocket 一开始不是直接发送业务消息，而是先通过一次 HTTP 请求发起协议升级。浏览器会向服务器发送带有 `Upgrade` 头的请求。

```http
GET /socket HTTP/1.1
Host: example.com
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://example.com
```

关键请求头含义：

- `Connection: Upgrade`：表示希望升级当前连接
- `Upgrade: websocket`：表示要升级到 WebSocket 协议
- `Sec-WebSocket-Key`：浏览器生成的随机值，用于让服务器计算校验结果
- `Sec-WebSocket-Version: 13`：WebSocket 协议版本
- `Origin`：当前页面来源，服务端可以用它做来源校验

如果服务器同意升级，会返回 `101 Switching Protocols`。

```http
HTTP/1.1 101 Switching Protocols
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

`Sec-WebSocket-Accept` 不是随便返回的字符串，而是服务器根据客户端传来的 `Sec-WebSocket-Key` 按 WebSocket 规范计算出来的结果。浏览器会校验它，确认服务器真的理解 WebSocket 协议。

升级成功后，这条 TCP 连接就不再按普通 HTTP 的“一次请求，一次响应”模式工作，而是改用 WebSocket 帧格式进行双向通信。

```text
建立 TCP 连接
      |
      v
发送 HTTP Upgrade 请求
      |
      v
服务器返回 101 Switching Protocols
      |
      v
后续在同一条连接上收发 WebSocket 帧
```

如果使用 `wss://`，流程是在 TCP 三次握手后先完成 TLS 握手，然后再发送加密的 HTTP Upgrade 请求。

```text
TCP 三次握手
      |
      v
TLS 握手
      |
      v
HTTP Upgrade
      |
      v
WebSocket 双向通信
```

需要注意：

- WebSocket 建连依赖 HTTP Upgrade，但升级成功后就不是普通 HTTP 请求了
- WebSocket 不适用普通 HTTP 状态码来表示每一条业务消息的结果
- 浏览器会发送 `Origin`，但 WebSocket 不走标准 CORS 预检流程，服务端要自己校验来源
- 反向代理需要显式支持 `Upgrade` 和长连接，否则 WebSocket 可能建立失败
- HTTP/2、HTTP/3 下也有对应的 WebSocket 承载方式，但理解时可以先掌握最常见的 HTTP/1.1 Upgrade 模型

### 页面级别监听与销毁

在真实业务里，WebSocket 通常不应该直接散落在每个页面组件中。更常见的做法是封装一个连接管理器，让页面只负责注册自己关心的消息，并在页面卸载时取消注册。

```text
WebSocket 连接管理器
      |
      | 负责连接、重连、心跳、消息分发
      v
页面 A 注册 message 监听
页面 B 注册 message 监听
页面 C 注册 message 监听
```

页面级别使用时要注意：

- 页面进入时注册监听
- 页面离开时移除监听
- 不要在每个页面重复创建连接，除非业务确实需要多个连接
- 组件销毁时要清理定时器和事件监听
- 用户退出登录时要主动关闭连接并清空状态

一个简单的订阅模型：

```js
class SocketManager {
  constructor(url) {
    this.url = url
    this.socket = null
    this.listeners = new Set()
  }

  connect() {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    this.socket = new WebSocket(this.url)

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      this.listeners.forEach((listener) => {
        listener(message)
      })
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false
    }

    this.socket.send(JSON.stringify(message))
    return true
  }

  close() {
    this.listeners.clear()
    this.socket?.close()
    this.socket = null
  }
}
```

页面使用：

```js
const socketManager = new SocketManager('wss://example.com/socket')

socketManager.connect()

const unsubscribe = socketManager.subscribe((message) => {
  if (message.type === 'notice') {
    console.log(message.payload)
  }
})

// 页面卸载时执行
unsubscribe()
```

如果是 React，可以在 `useEffect` 中注册和销毁：

```jsx
useEffect(() => {
  const unsubscribe = socketManager.subscribe((message) => {
    if (message.type === 'notice') {
      setNotice(message.payload)
    }
  })

  return () => {
    unsubscribe()
  }
}, [])
```

如果是 Vue，可以在 `onMounted` 和 `onUnmounted` 中处理：

```js
let unsubscribe = null

onMounted(() => {
  unsubscribe = socketManager.subscribe((message) => {
    if (message.type === 'notice') {
      notice.value = message.payload
    }
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
```

### WebSocket 心跳

WebSocket 建立后，如果中间网络断开、代理断开、服务端异常退出，浏览器不一定能立刻触发 `close`。心跳的作用是主动探测连接是否还可用。

常见心跳流程：

```text
客户端定时发送 ping
      |
      v
服务端收到后返回 pong
      |
      v
客户端在规定时间内收到 pong，认为连接正常
      |
      v
如果超时未收到 pong，主动关闭连接并触发重连
```

基础实现：

```js
class HeartbeatSocket {
  constructor(url) {
    this.url = url
    this.socket = null
    this.pingTimer = null
    this.pongTimer = null
  }

  connect() {
    this.socket = new WebSocket(this.url)

    this.socket.addEventListener('open', () => {
      this.startHeartbeat()
    })

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'pong') {
        this.clearPongTimeout()
        return
      }

      this.handleMessage(message)
    })

    this.socket.addEventListener('close', () => {
      this.stopHeartbeat()
    })
  }

  startHeartbeat() {
    this.stopHeartbeat()

    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return
      }

      this.socket.send(JSON.stringify({ type: 'ping', time: Date.now() }))

      this.pongTimer = setTimeout(() => {
        this.socket?.close()
      }, 10000)
    }, 30000)
  }

  clearPongTimeout() {
    clearTimeout(this.pongTimer)
    this.pongTimer = null
  }

  stopHeartbeat() {
    clearInterval(this.pingTimer)
    this.clearPongTimeout()
    this.pingTimer = null
  }

  handleMessage(message) {
    console.log(message)
  }
}
```

心跳设计要注意：

- 心跳间隔不能太短，否则会增加服务器压力
- 心跳超时时间要比正常网络波动宽松一些
- 收到服务端任意业务消息时，也可以视为连接仍然活跃
- 页面进入后台后，浏览器可能降低定时器执行频率
- 心跳失败后通常不要一直阻塞等待，要主动关闭并交给重连逻辑处理

### WebSocket 重连

WebSocket 连接可能因为网络切换、服务端发布、代理超时、用户电脑休眠等原因断开。重连逻辑通常放在连接管理器里，而不是散落在页面里。

重连要区分“异常断开”和“主动关闭”：

- 异常断开：网络错误、服务端断开、心跳超时，通常需要重连
- 主动关闭：用户退出登录、页面不再需要连接，通常不应该重连

基础重连流程：

```text
连接断开
      |
      v
判断是否主动关闭
      |
      v
不是主动关闭，则等待一段时间
      |
      v
重新创建 WebSocket
      |
      v
连接成功后恢复心跳和必要的业务订阅
```

一个带心跳和重连的简化封装：

```js
class ReconnectSocket {
  constructor(url, options = {}) {
    this.url = url
    this.socket = null
    this.listeners = new Set()
    this.manualClose = false
    this.reconnectTimer = null
    this.reconnectCount = 0
    this.maxReconnectCount = options.maxReconnectCount ?? 10
    this.heartbeatInterval = options.heartbeatInterval ?? 30000
    this.heartbeatTimeout = options.heartbeatTimeout ?? 10000
    this.pingTimer = null
    this.pongTimer = null
  }

  connect() {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    this.manualClose = false
    this.socket = new WebSocket(this.url)

    this.socket.addEventListener('open', () => {
      this.reconnectCount = 0
      this.startHeartbeat()
    })

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'pong') {
        this.clearPongTimeout()
        return
      }

      this.listeners.forEach((listener) => {
        listener(message)
      })
    })

    this.socket.addEventListener('close', () => {
      this.stopHeartbeat()
      this.socket = null

      if (!this.manualClose) {
        this.reconnect()
      }
    })

    this.socket.addEventListener('error', () => {
      this.socket?.close()
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false
    }

    this.socket.send(JSON.stringify(message))
    return true
  }

  startHeartbeat() {
    this.stopHeartbeat()

    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return
      }

      this.socket.send(JSON.stringify({ type: 'ping' }))

      this.pongTimer = setTimeout(() => {
        this.socket?.close()
      }, this.heartbeatTimeout)
    }, this.heartbeatInterval)
  }

  clearPongTimeout() {
    clearTimeout(this.pongTimer)
    this.pongTimer = null
  }

  stopHeartbeat() {
    clearInterval(this.pingTimer)
    this.clearPongTimeout()
    this.pingTimer = null
  }

  reconnect() {
    if (this.reconnectCount >= this.maxReconnectCount) {
      return
    }

    clearTimeout(this.reconnectTimer)

    const delay = Math.min(1000 * 2 ** this.reconnectCount, 30000)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectCount += 1
      this.connect()
    }, delay)
  }

  close() {
    this.manualClose = true
    clearTimeout(this.reconnectTimer)
    this.stopHeartbeat()
    this.listeners.clear()
    this.socket?.close()
    this.socket = null
  }
}
```

使用方式：

```js
const socket = new ReconnectSocket('wss://example.com/socket')

socket.connect()

const unsubscribe = socket.subscribe((message) => {
  console.log(message)
})

socket.send({
  type: 'join',
  roomId: 'room-1'
})

// 页面销毁时只取消本页面监听
unsubscribe()

// 用户退出登录或整个应用不再需要连接时，才关闭连接
socket.close()
```

重连设计要注意：

- 使用指数退避，避免服务恢复时大量客户端同时重连
- 设置最大重连次数或最终失败状态
- 重连成功后恢复心跳
- 如果业务需要订阅房间、频道、用户状态，重连成功后要重新发送订阅消息
- 如果消息不能丢，需要结合消息 id、服务端补偿接口或 ACK 机制
- 用户主动退出、token 失效、权限错误时不要无限重连

## webRTC

WebRTC 用于浏览器之间的实时音视频、数据通道通信。它通常不直接依赖 HTTP 传输媒体数据，而是通过信令服务器交换连接信息，再尝试建立点对点连接。

WebRTC 常见概念：

- `RTCPeerConnection`：点对点连接对象
- `MediaStream`：音视频媒体流
- `RTCDataChannel`：点对点数据通道
- SDP：描述媒体能力和连接信息
- ICE Candidate：候选网络地址

典型流程：

1. A 创建 `offer`
2. A 通过信令服务器发送 `offer` 给 B
3. B 创建 `answer`
4. B 通过信令服务器发送 `answer` 给 A
5. 双方交换 ICE Candidate
6. 建立连接后传输音视频或数据

更完整的 WebRTC 内容可以放在 [WebRTC](../16_webRTC/index.md) 章节中继续展开。

## WebTransport

WebTransport 是基于 HTTP/3 的新一代实时传输能力，适合低延迟、双向、多路复用的数据通信。

它可以提供：

- 双向流
- 单向流
- 不可靠数据报
- 低延迟传输

示例结构：

```js
async function connect() {
  const transport = new WebTransport('https://example.com/transport')

  await transport.ready

  const writer = transport.datagrams.writable.getWriter()
  const encoder = new TextEncoder()

  await writer.write(encoder.encode('hello'))
}
```

WebTransport 的生态和兼容性还不如 WebSocket 成熟。生产项目中通常要先评估浏览器支持、服务端能力和降级方案。

## 数据埋点与 sendBeacon

数据埋点用于记录用户行为、页面性能、错误信息和业务转化路径。前端常见埋点包括：

- PV：页面访问
- UV：独立用户访问
- 点击事件：按钮、菜单、卡片、广告位
- 曝光事件：元素进入可视区域
- 停留时长：页面进入到离开的时间
- 错误日志：JavaScript 错误、资源加载失败、接口失败
- 性能指标：首屏、接口耗时、资源加载耗时

埋点代码要尽量满足几个原则：

- 不影响主业务流程
- 不阻塞页面跳转和关闭
- 上报失败不能打断用户操作
- 数据结构稳定，字段命名统一
- 控制数据大小，避免一次上报过大
- 注意隐私，不采集密码、身份证、手机号等敏感明文

### 埋点数据结构

一个埋点事件通常包含事件名、时间、页面、用户、设备和业务上下文。

```js
function createTrackEvent(type, payload = {}) {
  return {
    type,
    payload,
    version: '1.0.0',
    page: location.pathname,
    url: location.href,
    referrer: document.referrer,
    title: document.title,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  }
}
```

点击埋点示例：

```js
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-track]')

  if (!target) return

  track('click', {
    name: target.dataset.track,
    text: target.textContent?.trim()
  })
})
```

页面里可以通过 `data-track` 声明需要采集的元素：

```html
<button data-track="submit-order">提交订单</button>
```

### sendBeacon

`navigator.sendBeacon` 用于异步发送少量数据，常见于埋点和日志上报。它不会阻塞页面关闭或跳转，浏览器会在合适的时机把数据发出去。

```js
function track(type, payload) {
  const event = createTrackEvent(type, payload)
  const data = JSON.stringify(event)

  navigator.sendBeacon('/api/track', data)
}
```

`sendBeacon` 的特点：

- 使用 HTTP `POST`
- 异步发送，不阻塞页面卸载
- 适合分析数据、诊断日志、离开页面时的上报
- 返回值只表示浏览器是否成功把数据加入发送队列
- 不能读取服务器响应
- 已排队数据总大小有限，通常按小数据上报设计

`sendBeacon` 支持的数据类型包括字符串、`Blob`、`FormData`、`URLSearchParams`、`ArrayBuffer`、TypedArray、`DataView` 等。

如果要明确指定 JSON 类型，可以使用 `Blob`：

```js
function sendTrack(event) {
  const blob = new Blob([JSON.stringify(event)], {
    type: 'application/json'
  })

  return navigator.sendBeacon('/api/track', blob)
}
```

### 页面离开时上报

离开页面、切换标签页、关闭浏览器、移动端切到后台时，埋点最容易丢失。更推荐监听 `visibilitychange`，在页面变成 `hidden` 时上报。

```js
const startTime = Date.now()

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') {
    return
  }

  const event = createTrackEvent('page_leave', {
    stayTime: Date.now() - startTime
  })

  sendTrack(event)
})
```

`beforeunload` 和 `unload` 不适合作为主要埋点时机。它们在移动端和浏览器页面生命周期中并不总是可靠，而且容易影响页面性能。

### fetch keepalive

如果需要使用 `POST` 以外的方法、设置更多请求选项，或者读取服务器响应，可以考虑 `fetch` 的 `keepalive`。

```js
fetch('/api/track', {
  method: 'POST',
  keepalive: true,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(createTrackEvent('page_leave'))
})
```

`keepalive` 表示即使页面正在卸载，浏览器也可以继续尝试完成这个请求。它比 `sendBeacon` 更灵活，但仍然适合小数据上报，不适合大文件或大量日志。

### 1px 图片埋点

早期埋点常用 1px 图片，也就是创建一个 `Image`，把数据拼到查询参数里。

```js
function trackByImage(type, payload = {}) {
  const params = new URLSearchParams({
    type,
    payload: JSON.stringify(payload),
    time: String(Date.now())
  })

  const image = new Image()
  image.src = `/api/track.gif?${params.toString()}`
}
```

这种方式的优点是兼容性好、实现简单、不会受普通 Ajax 响应解析影响。缺点也明显：

- 通常只能用 `GET`
- 数据长度受 URL 限制
- 不适合复杂结构和大数据
- 容易被缓存影响，需要加时间戳或随机数
- 很难获得可靠的服务端响应

现代项目优先使用 `sendBeacon` 或 `fetch keepalive`，图片埋点更多用于兼容兜底。

### 批量上报

高频事件不应该每次都立刻请求服务端，可以先放入队列，按数量或时间批量发送。

```js
const queue = []
let timer = null

function enqueueTrack(type, payload) {
  queue.push(createTrackEvent(type, payload))

  if (queue.length >= 10) {
    flushTrack()
    return
  }

  if (!timer) {
    timer = setTimeout(flushTrack, 5000)
  }
}

function flushTrack() {
  clearTimeout(timer)
  timer = null

  if (queue.length === 0) return

  const events = queue.splice(0, queue.length)
  const blob = new Blob([JSON.stringify(events)], {
    type: 'application/json'
  })

  const queued = navigator.sendBeacon('/api/track/batch', blob)

  if (!queued) {
    queue.unshift(...events)
  }
}
```

批量上报要注意：

- 队列不能无限增长
- 失败后是否重试要有上限
- 页面隐藏时要立即 flush
- 高频事件要节流或采样
- 服务端要能处理重复事件，最好有事件 id

### 错误埋点

常见错误来源包括同步脚本错误、Promise 未处理错误和资源加载错误。

```js
window.addEventListener('error', (event) => {
  track('js_error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  })
})

window.addEventListener('unhandledrejection', (event) => {
  track('promise_error', {
    reason: String(event.reason),
    stack: event.reason?.stack
  })
})
```

资源加载失败也会触发 `error`，但需要在捕获阶段监听。

```js
window.addEventListener(
  'error',
  (event) => {
    const target = event.target

    if (target instanceof HTMLScriptElement || target instanceof HTMLImageElement) {
      track('resource_error', {
        tagName: target.tagName,
        url: target.src
      })
    }
  },
  true
)
```

### 常见注意点

- `sendBeacon` 适合小数据，不适合大批量日志
- `sendBeacon` 只能确认“加入发送队列”，不能确认服务端一定处理成功
- 需要响应结果时不要依赖 `sendBeacon`，可以根据场景改用普通 `fetch`
- 页面退出时优先监听 `visibilitychange`
- 对点击、滚动、曝光这类高频事件要节流、采样或批量上报
- 埋点字段要有版本号，方便后续兼容
- 前端不要采集敏感明文数据
- 服务端要考虑重复上报、乱序上报和延迟上报

## 常见问题

### GET 和 POST 的区别是什么

`GET` 通常用于获取数据，参数放在 URL 中。`POST` 通常用于提交数据，请求体可以放更复杂的数据。真正的语义应该由接口设计和服务端行为保证。

### 404 会进入 fetch 的 catch 吗

不会。`fetch` 只有网络错误、CORS 阻止、请求取消等情况才会 rejected。`404`、`500` 这类 HTTP 状态码需要通过 `response.ok` 或 `response.status` 手动判断。

### 为什么跨域请求已经到服务器了，浏览器还报错

CORS 是浏览器的安全策略。请求可能已经被服务器处理，但如果响应头不满足 CORS 规则，浏览器会阻止前端 JavaScript 读取响应。

### 为什么 FormData 不要手动设置 Content-Type

`multipart/form-data` 需要带上边界字符串。使用 `FormData` 时浏览器会自动生成正确的 `Content-Type`，手动设置反而容易漏掉边界导致服务端解析失败。

## 小结

- 基于 TCP 的 HTTP 通信通常先建立 TCP 连接，三次握手用于确认双方收发能力并同步初始序列号
- HTTP 通信由请求和响应组成，前端要关注方法、状态码、请求头、响应头和响应体
- `fetch` 是原生 Promise 风格 API，`XMLHttpRequest` 更适合需要上传进度和旧项目兼容的场景
- `axios` 常用于业务项目里的请求封装、拦截器和统一错误处理
- CORS 是浏览器同源策略下的跨域读取控制，需要前后端共同配置
- SSE 适合服务端单向推送，WebSocket 通过 HTTP Upgrade 建立双向实时通信
- WebSocket 在页面中要统一管理连接，页面只注册和销毁自己的监听
- WebSocket 心跳用于探测连接是否可用，重连用于处理异常断开
- WebRTC 面向实时音视频和点对点通信，WebTransport 面向更低延迟的新传输能力
- 数据埋点要控制字段、批量和隐私，页面离开时可用 `sendBeacon` 或 `fetch keepalive` 上报少量数据

## 导航

- 返回 [13 网络](./index.md)
