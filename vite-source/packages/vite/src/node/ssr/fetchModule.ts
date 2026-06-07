import type { ViteDevServer } from '../server/index.js'
import { ssrTransform } from './ssrTransform.js'

export interface FetchModuleResult {
  id: string
  code: string
  file: string
  map?: unknown
}

/**
 * 对齐官方 ssr/fetchModule.ts。
 *
 * 官方 module runner 会通过这个层向 dev server 拉取 SSR 可执行模块。
 * 阅读版保留同样边界：resolve/load/transform/ssrTransform 都在这里完成，
 * ssrModuleLoader 只负责执行和缓存。
 */
export async function fetchModule(
  server: ViteDevServer,
  url: string,
): Promise<FetchModuleResult> {
  const resolved = await server.pluginContainer.resolveId(url)
  const id = resolved?.id ?? url
  const loaded = await server.pluginContainer.load(id)
  if (!loaded) throw new Error(`[ssr] failed to load ${url}`)

  const transformed = await server.pluginContainer.transform(loaded.code, id)
  const pluginResult = await server.pluginContainer.ssrTransform(transformed.code, id)
  const finalResult = pluginResult ?? (await ssrTransform(server.config, transformed.code, id))

  return {
    id,
    file: id,
    code: finalResult.code,
    map: finalResult.map,
  }
}
