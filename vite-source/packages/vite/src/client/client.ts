/**
 * hotModulesMap 是浏览器端的 HMR 注册表。
 *
 * key 是模块自己的浏览器 URL，例如 /src/App.vue；
 * value 保存这个模块通过 import.meta.hot.accept/dispose 注册的回调。
 */
const hotModulesMap = new Map<string, HotModule>()

type HotCallback = (mod: unknown) => void

interface HotModule {
  /** 一个模块可以多次 accept，不同回调可以监听不同依赖。 */
  callbacks: Array<{ deps: string[]; callback?: HotCallback }>
  /** dispose 在旧模块被替换前执行，常用来清理副作用。 */
  dispose?: () => void
}

function normalizeHmrUrl(dep: string, ownerPath: string): string {
  // accept('./foo') 这类相对路径要转成和服务端 ModuleGraph 一致的绝对 URL。
  if (dep[0] === '.') return new URL(dep, location.origin + ownerPath).pathname
  // 裸路径或绝对路径已经是可比较的 HMR path，直接返回。
  return dep
}

export function createHotContext(ownerPath: string) {
  /**
   * 每个被 import-analysis 注入 HMR 代码的模块都会调用 createHotContext。
   * 如果这个模块之前已经注册过回调，复用旧对象可以保留 accept/dispose 信息。
   */
  const mod: HotModule = hotModulesMap.get(ownerPath) || { callbacks: [] }
  hotModulesMap.set(ownerPath, mod)
  return {
    accept(deps?: string | string[] | HotCallback, callback?: HotCallback) {
      /**
       * accept 有三种常见写法：
       * - accept()：模块自己能处理自己的更新。
       * - accept(callback)：模块自己更新后执行回调。
       * - accept('./dep', callback)：当前模块接受某个依赖的更新。
       */
      if (typeof deps === 'function') {
        // accept(callback) 等价于监听 ownerPath 自己。
        callback = deps
        deps = [ownerPath]
      } else if (typeof deps === 'string') {
        // accept('./dep', callback) 统一转成数组，后面逻辑只处理一种结构。
        deps = [deps]
      } else if (!Array.isArray(deps)) {
        // accept() 没有传 deps，也代表 self-accept。
        deps = [ownerPath]
      }
      mod.callbacks.push({
        // 这里保存归一化后的路径，后续收到 server 的 acceptedPath 时才能匹配。
        deps: deps.map((dep) => normalizeHmrUrl(dep, ownerPath)),
        callback,
      })
    },
    dispose(callback: () => void) {
      // 真实 Vite 还支持 data 对象；阅读版保留最关键的“替换前清理”语义。
      mod.dispose = callback
    },
    invalidate() {
      // 模块发现自己无法安全热替换时，可以主动退化成整页刷新。
      location.reload()
    },
  }
}

// dev server 的 htmlPlugin 会把 /@vite/client 注入到 index.html，连接从这里建立。
const socket = new WebSocket(`ws://${location.host}/@vite/ws`)

socket.addEventListener('message', async (event) => {
  // 服务端发送的消息都是 JSON，例如 connected、update、full-reload。
  const payload = JSON.parse(event.data)
  if (payload.type === 'connected') {
    console.debug('[vite-source] websocket connected')
  }
  if (payload.type === 'full-reload') {
    // 没找到 HMR 边界，或者插件要求整页刷新时，直接 reload。
    location.reload()
  }
  if (payload.type === 'update') {
    for (const update of payload.updates) {
      /**
       * update.path 是需要执行回调的边界模块。
       * update.acceptedPath 是真正变化的模块路径。
       */
      const mod = hotModulesMap.get(update.path)
      // 先清理旧模块副作用，再 import 新版本。
      mod?.dispose?.()
      /**
       * 加 ?t=timestamp 的目的是绕开浏览器 HTTP/module cache。
       * 这次动态 import 会重新请求 dev server，触发 transformRequest 生成新代码。
       */
      const next = await import(`${update.path}?t=${update.timestamp || Date.now()}`)
      for (const cb of mod?.callbacks || []) {
        // 只有 accept 的 deps 命中本次更新路径时，才执行对应回调。
        if (cb.deps.includes(update.acceptedPath) || cb.deps.includes(update.path)) {
          cb.callback?.(next)
        }
      }
    }
  }
})
