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

export function createServer(inlineConfig: InlineConfig = {}): Promise<ViteDevServer> {
  return _createServer(inlineConfig)
}

export async function _createServer(inlineConfig: InlineConfig = {}): Promise<ViteDevServer> {
  const start = performance.now()
  const config = await resolveConfig(inlineConfig, 'serve')
  const pluginContainer = await createPluginContainer(config)
  const moduleGraph = new ModuleGraph()
  const depsOptimizer = await optimizeDeps(config)
  ;(globalThis as any).__vite_source_current_deps_optimizer = depsOptimizer
  const pendingRequests = new Map()

  let server!: ViteDevServer
  let handleRequest!: (req: any, res: any) => Promise<void>

  const httpServer = createHttpServer(async (req: any, res: any) => {
    await handleRequest(req, res)
  })

  const ws = createWebSocketServer(httpServer)
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
      await new Promise<void>((resolve) => {
        httpServer.listen(port, config.server.host || '0.0.0.0', resolve)
      })
      watchRoot(server, watcher)
      config.logger.info(`[server] ready in ${Math.ceil(performance.now() - start)} ms`)
      return server
    },
    transformRequest(url) {
      return transformRequest({ config, pluginContainer, moduleGraph, depsOptimizer, pendingRequests }, url)
    },
    transformIndexHtml(url, html) {
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
    await plugin.configureServer?.(server)
  }

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

function watchRoot(server: ViteDevServer, watcher: DevServerWatcher): void {
  try {
    fs.watch(server.config.root, { recursive: true }, (_event: string, filename?: string) => {
      if (!filename) return
      const file = path.join(server.config.root, filename)
      watcher.emit('change', file)
      handleHMRUpdate(server, file).catch((error) => server.config.logger.error(error))
    })
  } catch {
    server.config.logger.warn('fs.watch recursive is unavailable on this platform; HMR watching is disabled.')
  }
}

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
