
# uni-app 常用生命周期

uni-app 里的生命周期可以统一理解成三层：

1. App 生命周期：整个应用的生命周期，写在 `App.vue`
2. 页面生命周期：某个页面的生命周期，写在 `pages/xxx.vue`
3. Vue 生命周期：组件或页面内部 Vue 实例的生命周期

实际开发里，最常用的是 `onLaunch`、`onLoad`、`onShow`、`onReady`、`onUnload`、`created`、`mounted` 这些。

## 1. App 生命周期

App 生命周期写在 `App.vue` 里，只对整个应用生效。

```js
// App.vue
export default {
  onLaunch() {
    // 应用启动，只执行一次
  },

  onShow() {
    // 应用显示，或者从后台切回前台
  },

  onHide() {
    // 应用进入后台
  }
}
```

| 生命周期 | 什么时候执行 | 常用场景 |
| --- | --- | --- |
| `onLaunch` | App 启动时，只执行一次 | 初始化登录状态、读取 token、版本检查 |
| `onShow` | App 显示时 | 从后台回来刷新数据 |
| `onHide` | App 进入后台时 | 暂停任务、保存状态 |

注意：App 生命周期只能写在 `App.vue`，写在普通页面里不会生效。

## 2. 页面生命周期

页面生命周期写在页面 `.vue` 文件里，比如 `pages/index/index.vue`。

```js
export default {
  onLoad(options) {
    // 页面加载，只执行一次
    // options 可以拿到路由参数
  },

  onShow() {
    // 页面显示，每次进入页面都会执行
  },

  onReady() {
    // 页面初次渲染完成
  },

  onHide() {
    // 页面隐藏
  },

  onUnload() {
    // 页面卸载
  }
}
```

| 生命周期 | 什么时候执行 | 常用场景 |
| --- | --- | --- |
| `onLoad` | 页面第一次加载 | 接收参数、首次请求数据 |
| `onShow` | 页面每次显示 | 返回页面后刷新数据 |
| `onReady` | 页面初次渲染完成 | 获取节点信息、操作 canvas |
| `onHide` | 页面被隐藏 | 暂停视频、暂停定时器 |
| `onUnload` | 页面被销毁 | 清除定时器、解绑事件 |
| `onPullDownRefresh` | 用户下拉刷新 | 重新请求列表数据 |
| `onReachBottom` | 页面滚动到底部 | 分页加载更多 |

页面详情页常见写法：

```js
export default {
  data() {
    return {
      id: '',
      detail: null
    }
  },

  onLoad(options) {
    this.id = options.id
    this.getDetail()
  },

  onShow() {
    // 如果每次回到页面都要刷新，可以放这里
  },

  onUnload() {
    // 清理定时器、事件监听
  },

  methods: {
    getDetail() {
      // 请求详情数据
    }
  }
}
```

## 3. Vue 生命周期

Vue 生命周期既可以用于页面，也可以用于组件，但在 uni-app 里更常用于组件内部逻辑。

Vue2 常见写法：

```js
export default {
  beforeCreate() {
    // 实例初始化之前
  },

  created() {
    // 实例创建完成，data 和 methods 已经可用
  },

  mounted() {
    // 组件挂载完成
  },

  beforeDestroy() {
    // 组件销毁前
  },

  destroyed() {
    // 组件销毁后
  }
}
```

Vue3 常见写法：

```js
import { onMounted, onUnmounted } from 'vue'

export default {
  setup() {
    onMounted(() => {
      // 挂载完成
    })

    onUnmounted(() => {
      // 卸载完成
    })
  }
}
```

| Vue 生命周期 | 常用场景 |
| --- | --- |
| `created` | 初始化组件数据、调用不依赖 DOM 的方法 |
| `mounted` | 组件挂载后，获取节点、初始化第三方库 |
| `beforeDestroy` / `beforeUnmount` | 清除定时器、解绑事件 |
| `destroyed` / `unmounted` | 组件销毁完成 |

## created 和 onLoad 的区别

| 生命周期 | 类型 | 适用位置 | 主要用途 |
| --- | --- | --- | --- |
| `created` | Vue 生命周期 | 页面、组件都可以用 | 初始化实例内部数据，不接收页面参数 |
| `onLoad` | uni-app 页面生命周期 | 只用于页面 | 接收页面跳转参数、页面首次加载时请求数据 |

示例：

```js
export default {
  data() {
    return {
      id: '',
      list: []
    }
  },

  created() {
    // 适合做不依赖页面参数的初始化
  },

  onLoad(options) {
    // options 是上个页面传来的参数
    this.id = options.id
    this.getDetail(options.id)
  },

  methods: {
    getDetail(id) {
      // 根据 id 请求数据
    }
  }
}
```

关键点：

- `onLoad(options)` 可以拿到页面参数，比如 `uni.navigateTo({ url: '/pages/detail/detail?id=1' })` 里的 `id`。
- `created` 拿不到 `onLoad` 的 `options` 参数。
- 组件里没有页面级 `onLoad`，组件初始化一般用 `created` 或 `mounted`。
- 如果请求数据依赖页面参数，放在 `onLoad`。
- 如果只是组件内部初始化，放在 `created`。

## 常见执行顺序

页面第一次打开时，大致可以这样记：

```text
Vue created
页面 onLoad
页面 onShow
Vue mounted
页面 onReady
```

不同平台、Vue2/Vue3、页面结构可能有细节差异。实际开发不用死背顺序，重点记住每个生命周期适合做什么。

## 实用选择规则

| 你要做什么 | 放哪里 |
| --- | --- |
| App 启动时初始化登录状态 | `App.vue` 的 `onLaunch` |
| 页面接收参数 | 页面 `onLoad(options)` |
| 页面首次请求数据 | 页面 `onLoad` |
| 页面每次回来都刷新 | 页面 `onShow` |
| 组件内部初始化 | `created` |
| 需要等视图渲染完成 | `mounted` 或页面 `onReady` |
| 清除定时器 | 页面 `onUnload` 或组件 `beforeDestroy` / `beforeUnmount` |
| 下拉刷新 | `onPullDownRefresh` |
| 滚动到底部加载更多 | `onReachBottom` |

最常见的页面写法：

```js
export default {
  data() {
    return {
      list: [],
      timer: null
    }
  },

  created() {
    // 不依赖页面参数的初始化可以放这里
  },

  onLoad(options) {
    // 接收参数、首次请求
    this.getList()
  },

  onShow() {
    // 页面显示，适合返回页面后刷新
  },

  mounted() {
    // 组件挂载完成，适合需要节点的操作
  },

  onPullDownRefresh() {
    // 下拉刷新
    this.getList()
  },

  onReachBottom() {
    // 触底加载更多
    this.loadMore()
  },

  onUnload() {
    // 页面卸载
    clearInterval(this.timer)
  },

  methods: {
    getList() {},
    loadMore() {}
  }
}
```

一句话总结：

页面相关逻辑用 `onLoad`、`onShow`、`onUnload`；组件内部逻辑用 `created`、`mounted`、`beforeDestroy`；整个 App 初始化用 `onLaunch`。

## uni-app 常见面试题

### 1. uni-app 是什么？

uni-app 是一个使用 Vue 语法开发跨端应用的框架，一套代码可以发布到 H5、小程序、App 等多个平台。

常见回答：

- 开发语法主要基于 Vue。
- 页面结构类似小程序，包含 `pages.json`、`App.vue`、页面 `.vue` 文件。
- 可以调用 `uni.xxx` API 实现跨端能力，比如请求、跳转、存储、弹窗。
- 不同平台存在兼容差异，需要用条件编译处理。

### 2. uni-app 和 Vue 有什么区别？

uni-app 使用 Vue 语法，但它不是纯 Vue Web 项目。

| 对比项 | Vue | uni-app |
| --- | --- | --- |
| 运行环境 | 主要是浏览器 | H5、小程序、App 等多端 |
| 路由 | Vue Router | `pages.json` + `uni.navigateTo` 等 API |
| 标签 | HTML 标签，如 `div`、`span` | 小程序风格标签，如 `view`、`text` |
| API | 浏览器 API、第三方库 | `uni.xxx` 跨端 API |
| 生命周期 | Vue 生命周期 | Vue 生命周期 + App 生命周期 + 页面生命周期 |

面试回答可以说：

uni-app 保留了 Vue 的开发方式，但页面管理、路由跳转、生命周期、组件标签和平台 API 更接近小程序。

### 3. uni-app 的目录结构有哪些？

常见目录和文件：

| 文件或目录 | 作用 |
| --- | --- |
| `App.vue` | 应用入口，写全局生命周期和全局样式 |
| `main.js` | 项目入口，初始化 Vue 实例 |
| `pages.json` | 页面路由、导航栏、tabBar 等配置 |
| `manifest.json` | 应用配置，比如 App、小程序、H5 配置 |
| `uni.scss` | 全局 scss 变量 |
| `pages/` | 页面目录 |
| `components/` | 公共组件目录 |
| `static/` | 静态资源目录 |

### 4. pages.json 有什么作用？

`pages.json` 是 uni-app 的页面和窗口配置文件。

常见作用：

- 配置页面路径。
- 配置导航栏标题、颜色。
- 配置 tabBar。
- 配置下拉刷新。
- 配置页面滚动、窗口样式。

示例：

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "首页"
      }
    }
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页"
      }
    ]
  }
}
```

### 5. uni-app 怎么进行页面跳转？

常用跳转 API：

| API | 作用 |
| --- | --- |
| `uni.navigateTo` | 保留当前页面，跳转到普通页面 |
| `uni.redirectTo` | 关闭当前页面，跳转到普通页面 |
| `uni.reLaunch` | 关闭所有页面，打开某个页面 |
| `uni.switchTab` | 跳转到 tabBar 页面 |
| `uni.navigateBack` | 返回上一页 |

示例：

```js
uni.navigateTo({
  url: '/pages/detail/detail?id=1'
})
```

接收参数：

```js
export default {
  onLoad(options) {
    console.log(options.id)
  }
}
```

注意：

- 跳转到 tabBar 页面必须用 `uni.switchTab`。
- `switchTab` 不能直接带 query 参数。
- 普通页面之间跳转常用 `navigateTo`。

### 6. navigateTo 和 redirectTo 有什么区别？

| API | 是否保留当前页面 | 是否能返回 |
| --- | --- | --- |
| `navigateTo` | 保留 | 可以返回 |
| `redirectTo` | 不保留 | 不能返回当前页 |

举例：

- 从列表页进入详情页，用 `navigateTo`。
- 登录成功后进入首页，不希望返回登录页，可以用 `redirectTo` 或 `reLaunch`。

### 7. switchTab 为什么不能跳转到普通页面？

`switchTab` 只能跳转到 `pages.json` 中配置过的 tabBar 页面。

如果目标页面不是 tabBar 页面，需要使用：

```js
uni.navigateTo({
  url: '/pages/detail/detail'
})
```

如果目标页面是 tabBar 页面，需要使用：

```js
uni.switchTab({
  url: '/pages/index/index'
})
```

### 8. uni-app 页面之间怎么传参？

常见方式：

1. URL query 参数。
2. 本地缓存。
3. 全局状态管理。
4. 事件通信。

URL 传参：

```js
uni.navigateTo({
  url: '/pages/detail/detail?id=1&name=tom'
})
```

接收：

```js
export default {
  onLoad(options) {
    console.log(options.id)
    console.log(options.name)
  }
}
```

复杂对象不建议直接拼接到 URL，可以使用缓存或状态管理。

### 9. uni-app 组件之间怎么通信？

常见方式：

| 场景 | 方式 |
| --- | --- |
| 父传子 | `props` |
| 子传父 | `$emit` |
| 兄弟组件 | 父组件中转、全局状态、事件总线 |
| 跨页面共享 | Vuex、Pinia、本地缓存 |

父传子：

```vue
<user-card :user="userInfo" />
```

子传父：

```js
this.$emit('change', value)
```

父组件监听：

```vue
<user-card @change="handleChange" />
```

### 10. uni-app 怎么发送网络请求？

使用 `uni.request`。

```js
uni.request({
  url: 'https://example.com/api/list',
  method: 'GET',
  success: (res) => {
    console.log(res.data)
  },
  fail: (err) => {
    console.log(err)
  }
})
```

实际项目中一般会封装请求：

```js
function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: 'https://example.com' + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        token: uni.getStorageSync('token') || ''
      },
      success: (res) => {
        resolve(res.data)
      },
      fail: reject
    })
  })
}
```

### 11. uni-app 怎么做本地存储？

常用 API：

| API | 作用 |
| --- | --- |
| `uni.setStorageSync` | 同步存储 |
| `uni.getStorageSync` | 同步读取 |
| `uni.removeStorageSync` | 同步删除 |
| `uni.clearStorageSync` | 同步清空 |
| `uni.setStorage` | 异步存储 |
| `uni.getStorage` | 异步读取 |

示例：

```js
uni.setStorageSync('token', 'abc123')

const token = uni.getStorageSync('token')
```

常见用途：

- 保存 token。
- 保存用户信息。
- 保存搜索历史。
- 保存临时配置。

### 12. uni-app 怎么做登录状态管理？

常见思路：

1. 登录成功后保存 token。
2. 请求接口时在 header 中携带 token。
3. App 启动时读取 token。
4. token 失效时清除缓存并跳转登录页。

示例：

```js
// 登录成功
uni.setStorageSync('token', res.token)

// 请求时携带
uni.request({
  url: '/api/user',
  header: {
    token: uni.getStorageSync('token')
  }
})
```

### 13. uni-app 条件编译是什么？

条件编译用于处理不同平台的差异代码。

示例：

```js
// #ifdef H5
console.log('只在 H5 平台执行')
// #endif

// #ifdef MP-WEIXIN
console.log('只在微信小程序执行')
// #endif

// #ifdef APP-PLUS
console.log('只在 App 平台执行')
// #endif
```

常见平台标识：

| 标识 | 平台 |
| --- | --- |
| `H5` | H5 |
| `MP-WEIXIN` | 微信小程序 |
| `MP-ALIPAY` | 支付宝小程序 |
| `APP-PLUS` | App |

面试回答：

当某些 API、样式或业务逻辑只在特定平台生效时，可以用条件编译隔离平台差异。

### 14. uni-app 如何处理跨端兼容？

常见做法：

- 优先使用 `uni.xxx` 跨端 API。
- 不直接依赖浏览器 DOM 和 `window`。
- 用条件编译处理平台差异。
- 样式使用 `rpx` 适配不同屏幕。
- 真机测试目标平台，不只看 H5。

例如：

```js
// #ifdef H5
// H5 特有逻辑
// #endif

// #ifdef MP-WEIXIN
// 微信小程序特有逻辑
// #endif
```

### 15. rpx、px、upx 有什么区别？

| 单位 | 说明 |
| --- | --- |
| `px` | 固定像素单位 |
| `rpx` | 响应式单位，会根据屏幕宽度换算 |
| `upx` | 早期单位，基本等同于 `rpx` |

uni-app 中常用 `rpx` 做移动端适配。

例如：

```css
.box {
  width: 750rpx;
}
```

在设计稿宽度为 750px 的情况下，`750rpx` 通常表示屏幕宽度。

### 16. uni-app 中 view 和 div 有什么区别？

uni-app 推荐使用跨端组件标签：

| uni-app 标签 | 类似 HTML |
| --- | --- |
| `view` | `div` |
| `text` | `span` |
| `image` | `img` |
| `scroll-view` | 可滚动容器 |
| `swiper` | 轮播图 |

原因：

- `view`、`text` 等标签能更好地跨端编译。
- 小程序端不支持普通 HTML 标签的完整能力。
- 写跨端项目时应优先使用 uni-app 内置组件。

### 17. v-if 和 v-show 在 uni-app 中怎么选择？

| 指令 | 特点 | 适合场景 |
| --- | --- | --- |
| `v-if` | 条件为 false 时不渲染节点 | 切换不频繁 |
| `v-show` | 通过显示隐藏控制 | 切换频繁 |

常见选择：

- 弹窗频繁显示隐藏，可以用 `v-show`。
- 权限控制、一次性展示，可以用 `v-if`。

注意：不同小程序平台对部分 Vue 能力支持可能有差异，复杂场景要以实际编译结果为准。

### 18. uni-app 如何实现下拉刷新？

先在 `pages.json` 中开启：

```json
{
  "path": "pages/list/list",
  "style": {
    "enablePullDownRefresh": true
  }
}
```

页面中监听：

```js
export default {
  onPullDownRefresh() {
    this.getList()
  },

  methods: {
    getList() {
      // 请求完成后停止刷新
      uni.stopPullDownRefresh()
    }
  }
}
```

### 19. uni-app 如何实现上拉加载更多？

使用页面生命周期 `onReachBottom`。

```js
export default {
  data() {
    return {
      page: 1,
      list: []
    }
  },

  onReachBottom() {
    this.page++
    this.getList()
  },

  methods: {
    getList() {
      // 请求分页数据
    }
  }
}
```

实际项目里要注意：

- 防止重复请求。
- 判断是否还有更多数据。
- 请求失败时处理页码回退。

### 20. uni-app 如何优化性能？

常见优化点：

- 列表数据分页加载，避免一次性渲染太多节点。
- 长列表使用分页、虚拟列表或合理拆分组件。
- 减少频繁 `setData` 或大量响应式数据更新。
- 图片压缩、懒加载、使用合适尺寸。
- 避免在 `onPageScroll` 中写复杂逻辑。
- 公共组件不要过度嵌套。
- 请求接口做节流、防抖和缓存。
- 分包加载，减少首包体积。

### 21. uni-app 如何做分包？

分包可以减少小程序首包体积，提高首次打开速度。

在 `pages.json` 中配置：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    }
  ],
  "subPackages": [
    {
      "root": "pagesA",
      "pages": [
        {
          "path": "detail/detail"
        }
      ]
    }
  ]
}
```

访问分包页面：

```js
uni.navigateTo({
  url: '/pagesA/detail/detail'
})
```

### 22. uni-app 中如何使用全局变量？

常见方式：

- Vuex 或 Pinia。
- `globalData`。
- 本地缓存。
- 挂载到 Vue 原型或 `app.config.globalProperties`。

`globalData` 示例：

```js
// App.vue
export default {
  globalData: {
    userInfo: null
  }
}
```

页面中获取：

```js
const app = getApp()
console.log(app.globalData.userInfo)
```

大型项目更推荐使用 Vuex 或 Pinia 管理状态。

### 23. uni-app 中如何配置 tabBar？

在 `pages.json` 中配置：

```json
{
  "tabBar": {
    "color": "#666666",
    "selectedColor": "#007aff",
    "backgroundColor": "#ffffff",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "static/tab-home.png",
        "selectedIconPath": "static/tab-home-active.png"
      },
      {
        "pagePath": "pages/user/user",
        "text": "我的",
        "iconPath": "static/tab-user.png",
        "selectedIconPath": "static/tab-user-active.png"
      }
    ]
  }
}
```

注意：

- tabBar 页面必须先在 `pages` 中注册。
- 跳转 tabBar 页面要用 `uni.switchTab`。

### 24. uni-app 中如何获取节点信息？

可以使用 `uni.createSelectorQuery()`，一般放在 `onReady` 或 `mounted` 后。

```js
export default {
  onReady() {
    const query = uni.createSelectorQuery().in(this)
    query.select('.box').boundingClientRect((rect) => {
      console.log(rect)
    }).exec()
  }
}
```

不要在 `onLoad` 里获取节点，因为此时页面还没有完成渲染。

### 25. uni-app 中为什么不建议直接操作 DOM？

因为 uni-app 是跨端框架，不同平台并不都是真实浏览器 DOM。

例如：

- H5 运行在浏览器中，有 DOM。
- 小程序运行在小程序环境中，没有完整浏览器 DOM。
- App 端也不是普通浏览器页面。

所以跨端项目应优先使用：

- 数据驱动视图。
- uni-app 内置组件。
- `uni.xxx` API。
- 条件编译处理特殊平台逻辑。

### 26. uni-app 中怎么处理图片？

常见方式：

- 本地静态图片放在 `static/` 目录。
- 网络图片直接使用 URL。
- 上传图片用 `uni.chooseImage` 和 `uni.uploadFile`。

选择图片：

```js
uni.chooseImage({
  count: 1,
  success: (res) => {
    console.log(res.tempFilePaths)
  }
})
```

上传图片：

```js
uni.uploadFile({
  url: 'https://example.com/upload',
  filePath: filePath,
  name: 'file',
  success: (res) => {
    console.log(res)
  }
})
```

### 27. uni-app 中如何封装公共组件？

一般放在 `components/` 目录。

示例：

```vue
<!-- components/user-card/user-card.vue -->
<template>
  <view class="user-card">
    <text>{{ name }}</text>
  </view>
</template>

<script>
export default {
  props: {
    name: {
      type: String,
      default: ''
    }
  }
}
</script>
```

使用：

```vue
<user-card name="Tom" />
```

uni-app 支持 easycom，符合目录和命名规范时可以自动引入组件。

### 28. easycom 是什么？

easycom 是 uni-app 的自动组件引入机制。

符合规范的组件可以不用手动 `import` 和 `components` 注册，直接在页面中使用。

例如组件路径：

```text
components/user-card/user-card.vue
```

页面中可以直接写：

```vue
<user-card />
```

优点：

- 减少重复导入代码。
- 组件使用更方便。
- 适合公共组件较多的项目。

### 29. uni-app 中怎么处理权限？

常见权限包括定位、相机、相册、通知等。

处理思路：

1. 调用相关 API。
2. 如果失败，判断是否权限问题。
3. 提示用户授权。
4. 必要时引导用户打开设置页。

例如微信小程序中可以使用：

```js
uni.openSetting()
```

实际项目要注意不同平台权限机制不一样，需要结合条件编译处理。

### 30. uni-app 面试中怎么回答跨端原理？

可以这样回答：

uni-app 使用 Vue 语法开发，编译时会根据目标平台生成对应平台的代码。比如发布到微信小程序时会生成小程序能识别的页面结构和逻辑，发布到 H5 时会生成 Web 应用，发布到 App 时会运行在 App 对应容器中。

重点：

- 写法统一，但最终运行环境不同。
- 跨端不是所有平台完全一致。
- 平台差异需要用条件编译和兼容处理。

### 31. uni-app 项目中常见问题有哪些？

常见问题：

- 页面跳转 API 用错，比如用 `navigateTo` 跳 tabBar 页面。
- 在 `onLoad` 中操作节点。
- 小程序端使用了 H5 才有的 DOM 或 `window`。
- 请求没有统一封装，token 和错误处理分散。
- 列表一次性渲染太多数据，导致卡顿。
- 忘记停止下拉刷新。
- 条件编译写错平台标识。
- 页面参数传复杂对象导致 URL 过长或解析异常。

### 32. uni-app 面试回答模板

如果面试官问“你对 uni-app 熟吗”，可以这样回答：

我用 uni-app 做过跨端页面开发，主要使用 Vue 语法和 uni-app 的页面生命周期。页面初始化一般放在 `onLoad`，页面回显刷新放在 `onShow`，组件内部初始化用 `created` 或 `mounted`。路由通过 `pages.json` 配置，跳转使用 `uni.navigateTo`、`uni.redirectTo`、`uni.switchTab` 等 API。请求一般会封装 `uni.request`，统一处理 baseURL、token、错误提示。跨端兼容方面，会优先使用 `uni.xxx` API，遇到 H5、小程序、App 差异时使用条件编译处理。
