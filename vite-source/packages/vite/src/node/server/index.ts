import fs from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { resolveConfig, type InlineConfig, type ResolvedConfig } from '../config.js'
import { DEFAULT_DEV_PORT } from '../constants.js'
import { ModuleGraph } from './moduleGraph.js'
import { createPluginContainer, type PluginContainer } from './pluginContainer.js'
import { transformRequest } from './transformRequest.js'
import { createWebSocketServer, type WebSocketServer } from './ws.js'
import { optimizeDeps, type DepsOptimizer } from '../optimizer/index.js'
import { handleHMRUpdate } from './hmr.js'
import { baseMiddleware } from './middlewares/base.js'
import { corsMiddleware } from './middlewares/cors.js'
import { errorMiddleware } from './middlewares/error.js'
import { htmlFallbackMiddleware } from './middlewares/htmlFallback.js'
import { hostCheckMiddleware } from './middlewares/hostCheck.js'
import { indexHtmlMiddleware } from './middlewares/indexHtml.js'
import { notFoundMiddleware } from './middlewares/notFound.js'
import { proxyMiddleware } from './middlewares/proxy.js'
import { servePublicMiddleware } from './middlewares/public.js'
import { serveStaticMiddleware } from './middlewares/static.js'
import { timeMiddleware } from './middlewares/time.js'
import { transformMiddleware, type Middleware, type NextFunction } from './middlewares/transform.js'

export interface ViteDevServer {
  config: ResolvedConfig
  pluginContainer: PluginContainer
  moduleGraph: ModuleGraph
  depsOptimizer: DepsOptimizer
  ws: WebSocketServer
  watcher: DevServerWatcher
  httpServer: any
  listen(port?: number): Promise<ViteDevServer>
  transformRequest(url: string): Promise<{ code: string; map?: unknown } | null>
  transformIndexHtml(url: string, html: string): Promise<string>
  printUrls(): void
  close(): Promise<void>
}

/**
 * 创建服务器
 * @param inlineConfig
 */
export function createServer(inlineConfig: InlineConfig = {}): Promise<ViteDevServer> {
  return _createServer(inlineConfig)
}

export async function _createServer(inlineConfig: InlineConfig = {}): Promise<ViteDevServer> {
  const start = performance.now()
  /**
   * createServer 的组装顺序非常重要：
   *
   * 1. resolveConfig 先确定 root/base/mode/插件链/默认 server 配置。
   * 2. createPluginContainer 把 Vite/Rollup 风格插件钩子包装成统一调用入口。
   * 3. ModuleGraph 记录 URL、resolved id、依赖关系、HMR 边界和 transform 缓存。
   * 4. optimizeDeps 预扫描 node_modules 依赖，让 dev 请求可以走缓存产物。
   *
   * 这四个对象随后被挂到 ViteDevServer 上，所有 middleware 和插件都共享它们。
   */
  const config = await resolveConfig(inlineConfig, 'serve')

  // 插件容器
  const pluginContainer = await createPluginContainer(config)

  // URL依赖关系
  const moduleGraph = new ModuleGraph()

  //  依赖预构件
  const depsOptimizer = await optimizeDeps(config)
  ;(globalThis as any).__vite_source_current_deps_optimizer = depsOptimizer

  const pendingRequests = new Map()

  let server!: ViteDevServer
  let handleRequest!: (req: any, res: any) => Promise<void>

  /**
   * Node http server 只负责收请求；真正的处理逻辑晚一点才赋值给 handleRequest。
   * 这样 server 对象可以先创建出来，并传给 configureServer/middleware 闭包使用。
   */
  const httpServer = createHttpServer(async (req: any, res: any) => {
    await handleRequest(req, res)
  })
  //   ws
  const ws = createWebSocketServer(httpServer)
  //   观察器
  const watcher = new DevServerWatcher()

  server = {
    config,
    pluginContainer,
    moduleGraph,
    depsOptimizer,
    ws,
    watcher,
    httpServer,
    async listen(port = config.server.port ?? DEFAULT_DEV_PORT) {
      /**
       * listen 之后才开始 watchRoot，是因为只有服务真正可用时，HMR 事件
       * 才有意义。官方 Vite 使用 chokidar，这里用 fs.watch 保留核心模型。
       */
      await new Promise<void>((resolve) => {
        httpServer.listen(port, config.server.host || '0.0.0.0', resolve)
      })
      watchRoot(server, watcher)
      config.logger.info(`[server] ready in ${Math.ceil(performance.now() - start)} ms`)
      return server
    },
    transformRequest(url) {
      /**
       * server.transformRequest 是插件和 SSR 也会用到的公共能力。
       * 它把 request URL 交给 transformRequest.ts，后者会执行
       * resolveId -> load -> transform -> update ModuleGraph。
       */
      return transformRequest({ config, pluginContainer, moduleGraph, depsOptimizer, pendingRequests }, url)
    },
    transformIndexHtml(url, html) {
      // HTML 转换走独立钩子，因为 HTML 既是入口文档，也是注入 dev client 的位置。
      return pluginContainer.transformIndexHtml(html, { path: url, server })
    },
    printUrls() {
      const address = httpServer.address()
      const port = typeof address === 'object' && address ? address.port : config.server.port
      config.logger.info(`  Local: http://localhost:${port}${config.base}`)
    },
    async close() {
      ws.close()
      await pluginContainer.close()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    },
  }

  for (const plugin of config.plugins) {
    /**
     * configureServer 允许插件在中间件栈创建前拿到 server。
     * 官方插件常在这里注册自定义 middleware、WebSocket 事件或保存 server 引用。
     */
    await plugin.configureServer?.(server)
  }

  /**
   * 中间件顺序就是 dev server 请求生命周期：
   * host/cors/time/base/proxy 先处理协议层问题；
   * transform 尝试把 JS/CSS/资源请求交给插件链；
   * public/static 兜底静态文件；
   * htmlFallback/indexHtml 处理 SPA 和 HTML 入口；
   * notFound 最后返回 404。
   */
  handleRequest = createMiddlewareRunner(server, [
    hostCheckMiddleware(server),
    corsMiddleware(server),
    timeMiddleware(server),
    baseMiddleware(server),
    proxyMiddleware(server),
    transformMiddleware(server),
    servePublicMiddleware(server),
    serveStaticMiddleware(server),
    htmlFallbackMiddleware(server),
    indexHtmlMiddleware(server),
    notFoundMiddleware(),
  ])

  return server
}

/**
 * 观察
 * @param server
 * @param watcher
 */
function watchRoot(server: ViteDevServer, watcher: DevServerWatcher): void {
  try {
    fs.watch(server.config.root, { recursive: true }, (_event: string, filename?: string) => {
      if (!filename) return
      const file = path.join(server.config.root, filename)
      watcher.emit('change', file)
      /**
       * 文件变化进入 HMR 后不会直接通知浏览器“文件变了”。
       * handleHMRUpdate 会先查 ModuleGraph，运行插件 handleHotUpdate，
       * 再决定发送 js-update/css-update 还是 full-reload。
       */
      handleHMRUpdate(server, file).catch((error) => server.config.logger.error(error))
    })
  } catch {
    server.config.logger.warn('fs.watch recursive is unavailable on this platform; HMR watching is disabled.')
  }
}

/**
 * 创建中间件
 * @param server
 * @param middlewares
 */
function createMiddlewareRunner(server: ViteDevServer, middlewares: Middleware[]): (req: any, res: any) => Promise<void> {
  const handleError = errorMiddleware(server)

  return async function runMiddlewares(req, res) {
    let index = -1

    const dispatch: NextFunction = async (error?: unknown) => {
      if (error) {
        handleError(error, req, res)
        return
      }

      index += 1
      const middleware = middlewares[index]
      if (!middleware) return

      try {
        /**
         * 这是一个最小版 connect/koa 洋葱模型。
         * 每个 middleware 可以选择处理响应并停止，也可以 await next()
         * 把请求交给后续 middleware。
         */
        await middleware(req, res, dispatch)
      } catch (caught) {
        handleError(caught, req, res)
      }
    }

    await dispatch()
  }
}

export class DevServerWatcher {
  private readonly listeners = new Map<string, Set<(file: string) => void>>()

  on(event: string, listener: (file: string) => void): this {
    // 阅读版 watcher 只保留插件最常用的 on/off/emit 事件模型。
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener)
    this.listeners.set(event, set)
    return this
  }

  off(event: string, listener: (file: string) => void): this {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string, file: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener(file)
  }
}
