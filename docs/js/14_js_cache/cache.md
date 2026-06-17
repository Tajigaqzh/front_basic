# 缓存

缓存的目标是把已经获取或计算过的数据保存起来，后续再次使用时减少网络请求、降低计算成本、提升页面响应速度。前端常见缓存包括 HTTP 缓存、内存缓存、浏览器本地存储、离线缓存和业务层数据缓存。

## 缓存解决什么问题

缓存主要解决三类问题：

- 性能：减少重复请求和重复计算
- 可用性：弱网或离线时仍能展示部分内容
- 成本：降低服务器压力和带宽消耗

缓存也会带来新的问题：

- 数据可能过期
- 多端数据可能不一致
- 缓存占用空间需要清理
- 敏感数据不能随意保存

设计缓存时要同时考虑“读得快”和“更新正确”。

## HTTP 缓存

HTTP 缓存由浏览器和服务器通过响应头协作完成。浏览器第一次请求资源后，可以根据缓存头决定下一次是否直接使用本地副本。

常见缓存响应头：

- `Cache-Control`
- `Expires`
- `ETag`
- `Last-Modified`

## 强缓存

强缓存指浏览器在缓存未过期时，直接使用本地缓存，不向服务器发送请求。

```http
Cache-Control: max-age=31536000
```

`max-age` 表示缓存有效时间，单位是秒。

```http
Cache-Control: public, max-age=86400
```

常见指令：

- `max-age`：缓存有效秒数
- `public`：允许浏览器和中间代理缓存
- `private`：只允许浏览器私有缓存
- `no-cache`：可以缓存，但每次使用前都要向服务器验证
- `no-store`：不允许缓存
- `must-revalidate`：过期后必须重新验证

`Expires` 是 HTTP/1.0 的缓存头，使用绝对时间。

```http
Expires: Wed, 21 Oct 2026 07:28:00 GMT
```

如果同时存在 `Cache-Control` 和 `Expires`，现代浏览器优先使用 `Cache-Control`。

### 静态资源强缓存

带 hash 的静态资源适合使用长期强缓存。

```http
Cache-Control: public, max-age=31536000, immutable
```

例如：

```text
/assets/index.a1b2c3.js
/assets/style.d4e5f6.css
```

文件内容变化后，构建工具会生成新的文件名，因此旧缓存不会影响新版本发布。

HTML 文件通常不适合长期强缓存，因为它负责引用最新的 JS 和 CSS。

## 协商缓存

协商缓存指浏览器先向服务器询问资源是否变化。如果没有变化，服务器返回 `304 Not Modified`，浏览器继续使用本地缓存。

```text
浏览器请求资源
      |
      v
携带缓存标识请求服务器
      |
      v
服务器判断资源是否变化
      |
      +-- 未变化 -> 304，使用本地缓存
      |
      +-- 已变化 -> 200，返回新资源
```

### Last-Modified 和 If-Modified-Since

服务器第一次响应时返回资源最后修改时间。

```http
Last-Modified: Mon, 15 Jun 2026 10:00:00 GMT
```

浏览器再次请求时带上：

```http
If-Modified-Since: Mon, 15 Jun 2026 10:00:00 GMT
```

如果服务器判断资源没有变化，就返回：

```http
HTTP/1.1 304 Not Modified
```

### ETag 和 If-None-Match

`ETag` 是资源内容的标识，通常比 `Last-Modified` 更准确。

```http
ETag: "a1b2c3"
```

浏览器再次请求时带上：

```http
If-None-Match: "a1b2c3"
```

如果资源没有变化，服务器返回 `304`。如果资源变化，服务器返回新的 `200` 响应和新的资源内容。

### 强缓存和协商缓存的关系

通常流程是：

1. 先判断强缓存是否命中
2. 强缓存命中，直接使用本地缓存
3. 强缓存未命中，再走协商缓存
4. 协商缓存命中，返回 `304`
5. 协商缓存未命中，返回新资源

## 内存缓存

内存缓存把数据保存在 JavaScript 运行时内存中。它速度快，但页面刷新后会丢失。

```js
const cache = new Map()

async function getUser(id) {
  if (cache.has(id)) {
    return cache.get(id)
  }

  const response = await fetch(`/api/users/${id}`)
  const user = await response.json()

  cache.set(id, user)

  return user
}
```

内存缓存适合：

- 当前页面生命周期内重复使用的数据
- 计算成本较高的结果
- 接口请求的短期复用
- 组件或模块内部状态缓存

内存缓存需要注意：

- 页面刷新后失效
- 长时间不清理可能造成内存占用过高
- 缓存对象如果被外部修改，可能影响后续读取

## LRU 算法

LRU 的全称是 Least Recently Used，表示“最近最少使用”。当缓存容量满了，优先淘汰最久没有被访问的数据。

JavaScript 中可以用 `Map` 实现一个简单 LRU。`Map` 会按插入顺序保存键。

```js
class LRUCache {
  constructor(limit) {
    this.limit = limit
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined
    }

    const value = this.cache.get(key)

    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    this.cache.set(key, value)

    if (this.cache.size > this.limit) {
      const oldestKey = this.cache.keys().next().value

      this.cache.delete(oldestKey)
    }
  }
}

const lru = new LRUCache(2)

lru.set('a', 1)
lru.set('b', 2)
lru.get('a')
lru.set('c', 3)

console.log(lru.get('b')) // undefined
```

LRU 适合限制缓存数量，例如图片预览缓存、接口结果缓存、搜索结果缓存。

## localStorage

`localStorage` 是浏览器提供的持久化键值存储。页面关闭后数据仍然存在，除非主动清除。

```js
localStorage.setItem('theme', 'dark')

const theme = localStorage.getItem('theme')

localStorage.removeItem('theme')
localStorage.clear()
```

特点：

- 同源下共享
- 只能保存字符串
- 同步 API，读写大数据可能阻塞主线程
- 容量有限，通常约几 MB
- 不适合保存敏感信息

保存对象时需要手动序列化。

```js
const user = {
  id: 1,
  name: 'Tom'
}

localStorage.setItem('user', JSON.stringify(user))

const cachedUser = JSON.parse(localStorage.getItem('user'))
```

### 带过期时间的 localStorage

`localStorage` 本身没有过期机制，可以在写入时保存过期时间。

```js
function setStorage(key, value, ttl) {
  const item = {
    value,
    expireAt: Date.now() + ttl
  }

  localStorage.setItem(key, JSON.stringify(item))
}

function getStorage(key) {
  const raw = localStorage.getItem(key)

  if (!raw) {
    return null
  }

  const item = JSON.parse(raw)

  if (Date.now() > item.expireAt) {
    localStorage.removeItem(key)
    return null
  }

  return item.value
}
```

## sessionStorage

`sessionStorage` 和 `localStorage` 类似，也是键值存储，但生命周期只在当前页面会话内。

```js
sessionStorage.setItem('draft', 'hello')

const draft = sessionStorage.getItem('draft')

sessionStorage.removeItem('draft')
```

特点：

- 页面会话结束后清除
- 同一个标签页内可用
- 新标签页通常不会共享已有的 `sessionStorage`
- 适合保存临时表单、当前页面状态、一次性流程数据

## cookies

Cookie 是浏览器保存并自动随请求发送给服务器的小段数据，常用于登录态和服务端会话。

```http
Set-Cookie: sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax
```

常见属性：

- `Expires / Max-Age`：过期时间
- `Domain`：允许携带 Cookie 的域
- `Path`：允许携带 Cookie 的路径
- `HttpOnly`：禁止 JavaScript 读取
- `Secure`：只在 HTTPS 下发送
- `SameSite`：限制跨站请求携带 Cookie

前端可以通过 `document.cookie` 读写非 `HttpOnly` Cookie。

```js
document.cookie = 'theme=dark; Max-Age=86400; Path=/'

console.log(document.cookie)
```

Cookie 的注意点：

- 每次符合条件的请求都会自动携带 Cookie
- Cookie 容量很小，不适合存大数据
- 登录态 Cookie 应尽量使用 `HttpOnly`、`Secure`、`SameSite`
- 不要在 Cookie 里保存明文敏感信息

## Cache

Cache API 用于保存 Request 和 Response 对象，常和 Service Worker 搭配实现离线缓存。

```js
async function saveToCache() {
  const cache = await caches.open('app-cache-v1')

  await cache.add('/index.html')
  await cache.add('/assets/app.js')
}
```

也可以手动写入响应。

```js
async function cacheResponse(request) {
  const cache = await caches.open('api-cache-v1')
  const response = await fetch(request)

  cache.put(request, response.clone())

  return response
}
```

读取缓存：

```js
async function readCache(request) {
  const cache = await caches.open('api-cache-v1')
  const response = await cache.match(request)

  if (response) {
    return response
  }

  return fetch(request)
}
```

删除旧缓存：

```js
async function deleteOldCaches() {
  const keys = await caches.keys()

  await Promise.all(
    keys
      .filter((key) => key !== 'app-cache-v2')
      .map((key) => caches.delete(key))
  )
}
```

Cache API 适合缓存静态资源、离线页面、接口响应副本。需要注意缓存版本更新和空间清理。

## indexDB

IndexedDB 是浏览器提供的客户端数据库，适合保存结构化、大量、需要索引查询的数据。

适合场景：

- 离线应用数据
- 大量列表数据
- 文件元信息
- 富文本草稿
- 客户端任务队列

IndexedDB 是异步 API，原生写法比较繁琐。

```js
const request = indexedDB.open('app-db', 1)

request.onupgradeneeded = () => {
  const db = request.result

  if (!db.objectStoreNames.contains('users')) {
    db.createObjectStore('users', {
      keyPath: 'id'
    })
  }
}

request.onsuccess = () => {
  const db = request.result
  const transaction = db.transaction('users', 'readwrite')
  const store = transaction.objectStore('users')

  store.put({
    id: 1,
    name: 'Tom'
  })
}
```

实际项目中常使用封装库来简化操作，例如 `idb`、Dexie。

## FileSystemFileHandle

`FileSystemFileHandle` 来自 File System Access API，可以让网页在用户授权后读写本地文件。

选择文件：

```js
async function openFile() {
  const [fileHandle] = await window.showOpenFilePicker()
  const file = await fileHandle.getFile()
  const text = await file.text()

  console.log(text)
}
```

保存文件：

```js
async function saveFile(fileHandle, content) {
  const writable = await fileHandle.createWritable()

  await writable.write(content)
  await writable.close()
}
```

特点：

- 必须由用户主动授权
- 可以读写本地文件
- 适合编辑器、设计工具、离线文档类应用
- 浏览器兼容性需要单独评估

## Service Worker 离线缓存

Service Worker 是运行在浏览器后台的脚本，可以拦截网络请求并返回缓存内容。

注册 Service Worker：

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

在 `sw.js` 中缓存静态资源：

```js
const CACHE_NAME = 'app-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/assets/app.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS)
    })
  )
})
```

拦截请求：

```js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})
```

Service Worker 常见缓存策略：

- Cache First：优先缓存，适合静态资源
- Network First：优先网络，适合接口和 HTML
- Stale While Revalidate：先用旧缓存，同时后台更新
- Cache Only：只使用缓存
- Network Only：只走网络

## 业务缓存策略

业务缓存不能只考虑“有没有缓存”，还要考虑数据什么时候失效。

常见策略：

- 固定过期时间：例如 5 分钟后失效
- 版本号失效：版本变化后丢弃旧缓存
- 主动清理：用户退出登录时清理用户相关缓存
- 写后更新：修改数据成功后同步更新缓存
- 写后失效：修改数据成功后删除相关缓存，下次重新请求
- 后台刷新：先展示缓存，再异步请求最新数据

示例：先读缓存，再后台刷新。

```js
async function getDataWithCache(key, request) {
  const cached = getStorage(key)

  if (cached) {
    request().then((freshData) => {
      setStorage(key, freshData, 5 * 60 * 1000)
    })

    return cached
  }

  const data = await request()

  setStorage(key, data, 5 * 60 * 1000)

  return data
}
```

## 安全注意事项

前端缓存可能被用户查看或清理，不适合保存高敏感数据。

建议：

- Token 不要随意放在 `localStorage`
- 登录态优先使用带 `HttpOnly`、`Secure`、`SameSite` 的 Cookie
- 退出登录时清理用户相关缓存
- 不缓存身份证号、银行卡号、明文密码等敏感信息
- 缓存接口数据时注意用户隔离，避免账号切换后展示旧数据

## 常见问题

### localStorage、sessionStorage、Cookie 的区别

`localStorage` 持久保存，适合非敏感偏好设置。`sessionStorage` 只在当前页面会话内保存，适合临时状态。Cookie 会自动随请求发送，适合服务端识别会话。

### no-cache 是不缓存吗

不是。`no-cache` 表示可以缓存，但使用前必须向服务器重新验证。完全不缓存应该使用 `no-store`。

### 为什么静态资源要带 hash

带 hash 的文件名可以配合长期强缓存。内容变化后文件名变化，浏览器会请求新资源；内容不变时可以长期使用本地缓存。

### IndexedDB 和 localStorage 怎么选

少量字符串配置用 `localStorage`。大量结构化数据、离线数据、需要索引查询的数据用 IndexedDB。

## 小结

- HTTP 缓存分为强缓存和协商缓存，静态资源常用 hash 文件名配合长期强缓存
- 内存缓存速度最快，但页面刷新后会丢失
- LRU 用于限制缓存容量，淘汰最近最少使用的数据
- `localStorage` 适合持久化少量非敏感数据，`sessionStorage` 适合页面会话内临时数据
- Cookie 会自动随请求发送，登录态 Cookie 应注意 `HttpOnly`、`Secure`、`SameSite`
- Cache API 和 Service Worker 可以实现静态资源缓存和离线访问
- IndexedDB 适合大量结构化数据，File System Access API 适合需要用户授权的本地文件读写

## 导航

- 返回 [14 缓存](./index.md)
