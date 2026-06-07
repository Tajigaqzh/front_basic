import type { BuildChunk } from '../build.js'

export type SsrManifest = Record<string, string[]>

/**
 * 对齐官方 ssr/ssrManifestPlugin.ts。
 *
 * 官方在 build SSR 时记录模块到 preload 资源的映射。阅读版基于 BuildChunk
 * 生成同样形态的数据，供文档和后续 SSR build 流程对照。
 */
export function createSsrManifest(chunks: BuildChunk[]): SsrManifest {
  const manifest: SsrManifest = {}
  for (const chunk of chunks) {
    for (const mod of chunk.modules) {
      manifest[mod.url] ??= []
      manifest[mod.url].push(chunk.fileName)
    }
  }
  return manifest
}
