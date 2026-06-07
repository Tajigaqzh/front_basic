import type { PluginContainer } from './pluginContainer.js'

/**
 * 阅读定位：
 * transformRequest 是 dev server 的核心热路径。浏览器每请求一个模块，
 * 这里都会按 cache -> resolve -> load -> transform -> ModuleGraph 的顺序处理。
 * 理解它，就能理解 Vite dev 为什么“不先打包”，而是按请求即时转换模块。
 */
import type { ModuleGraph } from './moduleGraph.js'
import type { ResolvedConfig, TransformResult } from '../plugin.js'
import type { DepsOptimizer } from '../optimizer/index.js'
import { removeTimestampQuery } from '../utils.js'

export interface TransformRequestContext {
  config: ResolvedConfig
  pluginContainer: PluginContainer
  moduleGraph: ModuleGraph
  depsOptimizer: DepsOptimizer
  pendingRequests: Map<string, Promise<TransformResult | null>>
}

/**
 * transformRequest 对应官方 server/transformRequest.ts。
 *
 * 参数 url 是浏览器请求路径，例如 /src/main.ts?t=123。
 * 返回值是最终发送给浏览器的 JS/CSS-as-JS/JSON-as-JS 代码。
 *
 * 执行顺序：
 * 1. 清理时间戳查询参数，避免同一模块因为 ?t= 生成多个缓存键。
 * 2. 如果已有同 URL 的转换在进行，复用 pending promise。
 * 3. resolveId 把 URL 解析成插件可处理的 id。
 * 4. load 读取源码或虚拟模块。
 * 5. transform 顺序执行插件转换。
 * 6. 写入 ModuleGraph 缓存和依赖关系。
 */
export async function transformRequest(
  ctx: TransformRequestContext,
  url: string,
): Promise<TransformResult | null> {
  const cacheKey = removeTimestampQuery(url)
  const pending = ctx.pendingRequests.get(cacheKey)
  if (pending) return pending

  const request = doTransform(ctx, cacheKey).finally(() => {
    ctx.pendingRequests.delete(cacheKey)
  })

  ctx.pendingRequests.set(cacheKey, request)
  return request
}

async function doTransform(
  ctx: TransformRequestContext,
  url: string,
): Promise<TransformResult | null> {
  const cachedModule = ctx.moduleGraph.getModuleByUrl(url)
  if (cachedModule?.transformResult) {
    ctx.config.logger.info(`[transform] cache hit ${url}`)
    return cachedModule.transformResult
  }

  const resolved = await ctx.pluginContainer.resolveId(url)
  const id = resolved?.id ?? url
  const optimizedId = ctx.depsOptimizer.getOptimizedDepId(id)
  if (optimizedId) {
    const optimized = await ctx.pluginContainer.load(optimizedId)
    if (optimized) {
      const mod = ctx.moduleGraph.ensureEntryFromUrl(url, optimizedId)
      mod.transformResult = optimized
      return optimized
    }
  }

  if (resolved?.external) {
    return { code: `export default await import(${JSON.stringify(id)});` }
  }

  const loaded = await ctx.pluginContainer.load(id)
  if (!loaded) return null

  const transformed = await ctx.pluginContainer.transform(loaded.code, id)
  const mod = ctx.moduleGraph.ensureEntryFromUrl(url, id)
  mod.transformResult = transformed
  await ctx.moduleGraph.updateModuleInfo(mod, transformed.code)

  ctx.config.logger.info(`[transform] ${url} -> ${id}`)
  return transformed
}
