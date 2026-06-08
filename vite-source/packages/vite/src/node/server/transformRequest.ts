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
  /**
   * 浏览器 HMR 或并发 import 可能在同一时刻请求同一个 URL。
   * pendingRequests 用 Promise 级别去重，避免同一个模块重复执行
   * resolve/load/transform，也避免多个结果互相覆盖 ModuleGraph 缓存。
   */
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
  /**
   * transformResult 缓存在 ModuleGraph 的 ModuleNode 上。
   * HMR invalidateModule 会清掉相关节点缓存；没失效的请求可以直接返回，
   * 这就是 dev server 重复刷新仍然很快的原因之一。
   */
  const cachedModule = ctx.moduleGraph.getModuleByUrl(url)
  if (cachedModule?.transformResult) {
    ctx.config.logger.info(`[transform] cache hit ${url}`)
    return cachedModule.transformResult
  }

  /**
   * resolveId 把浏览器 URL/specifier 解析成内部 id。
   * 例如 /src/main.ts 会成为绝对文件路径，react 可能会成为优化缓存文件，
   * Vue 子请求可能带上 ?vue&type=template 这类 query。
   */
  const resolved = await ctx.pluginContainer.resolveId(url)
  const id = resolved?.id ?? url

  /**
   * 依赖优化发生在普通 load/transform 之前。
   * 如果 optimizer 已经为裸模块生成缓存文件，dev 请求直接加载缓存产物，
   * 避免每次都深入 node_modules 做大量转换。
   */
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
    // external 模块不进入 Vite 插件转换，浏览器运行时再交给原生 dynamic import。
    return { code: `export default await import(${JSON.stringify(id)});` }
  }

  /**
   * load 先把 id 变成源码，transform 再串行运行所有转换插件。
   * 只有 transform 之后的最终 JS 才适合写入 ModuleGraph，因为 import-analysis
   * 可能已经注入 HMR 代码并改写了依赖路径。
   */
  const loaded = await ctx.pluginContainer.load(id)
  if (!loaded) return null

  const transformed = await ctx.pluginContainer.transform(loaded.code, id)
  const mod = ctx.moduleGraph.ensureEntryFromUrl(url, id)
  mod.transformResult = transformed
  /**
   * updateModuleInfo 会重新解析当前模块最终代码里的 import/import.meta.hot.accept。
   * 这一步把“字符串源码”转换成 HMR 可遍历的图结构。
   */
  await ctx.moduleGraph.updateModuleInfo(mod, transformed.code)

  ctx.config.logger.info(`[transform] ${url} -> ${id}`)
  return transformed
}
