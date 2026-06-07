import path from 'node:path'
import type { ResolvedConfig } from '../plugin.js'

/**
 * 对齐官方 optimizer/resolve.ts：集中处理 optimizeDeps.include 展开、
 * 优化产物路径、缓存文件命名。官方还会支持 glob include 和插件转换。
 */
export function createOptimizeDepsIncludeResolver(config: ResolvedConfig): () => string[] {
  return () => [...config.optimizeDeps.include]
}

export function getOptimizedDepPath(config: ResolvedConfig, id: string): string {
  return path.join(getDepsCacheDir(config), `${flattenId(id)}.js`)
}

export function getDepsCacheDir(config: ResolvedConfig): string {
  return path.join(config.root, 'node_modules', '.vite-source', 'deps')
}

export function flattenId(id: string): string {
  return id.replace(/[^\w.-]/g, '_')
}
