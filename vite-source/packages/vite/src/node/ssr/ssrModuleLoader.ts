import path from 'node:path'
import type { ViteDevServer } from '../server/index.js'
import { isBareImport } from '../utils.js'
import { fetchModule } from './fetchModule.js'
import { ssrFixStacktrace } from './ssrStacktrace.js'

export interface SsrModule {
  [key: string]: unknown
}

const ssrModuleCache = new WeakMap<ViteDevServer, Map<string, Promise<SsrModule>>>()

/**
 * ssrLoadModule 对应官方 Vite 的服务端模块加载能力。
 *
 * 它复用 dev server 的插件容器，所以 SSR 中的 TS、CSS、JSON、虚拟模块
 * 与浏览器开发模式走同一套 resolve/load/transform 逻辑。区别在最后一步：
 * 浏览器拿到 ESM 字符串，SSR 则把它包装进 AsyncFunction 在 Node 中执行。
 */
export async function ssrLoadModule(server: ViteDevServer, url: string): Promise<SsrModule> {
  let cache = ssrModuleCache.get(server)
  if (!cache) {
    cache = new Map()
    ssrModuleCache.set(server, cache)
  }

  const cacheKey = url
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const request = doSsrLoadModule(server, url)
  cache.set(cacheKey, request)
  return request
}

async function doSsrLoadModule(server: ViteDevServer, url: string): Promise<SsrModule> {
  if (isBareImport(url)) {
    return import(url) as Promise<SsrModule>
  }

  const fetched = await fetchModule(server, path.isAbsolute(url) ? url : url)

  const exports: SsrModule = {}
  const importer = (specifier: string) => ssrLoadModule(server, specifier)
  const fn = new Function(
    '__vite_ssr_exports__',
    '__vite_ssr_import__',
    `return (async () => {\n${fetched.code}\n;return __vite_ssr_exports__;\n})()`,
  )

  try {
    return (await fn(exports, importer)) as SsrModule
  } catch (error) {
    ssrFixStacktrace(error as Error)
    throw error
  }
}
