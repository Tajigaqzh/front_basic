import type { ResolvedConfig } from './plugin.js'
import { tryNodeResolve } from './plugins/resolve.js'

export interface NodeResolveWithViteOptions {
  root: string
  isRequire?: boolean
}

/**
 * 对齐官方 nodeResolve.ts：给 SSR/module-runner 等非插件场景提供一个
 * “使用 Vite 解析规则的 Node resolve”。
 */
export function nodeResolveWithVite(
  id: string,
  importer: string | undefined,
  options: NodeResolveWithViteOptions & { config?: ResolvedConfig },
): string | undefined {
  const config = options.config
  if (!config) return undefined
  return tryNodeResolve(id, importer, {
    config,
    isRequire: options.isRequire,
    tryIndex: true,
    preferRelative: false,
  })?.id
}
