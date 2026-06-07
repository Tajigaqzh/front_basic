import type { Plugin, ResolvedConfig } from '../plugin.js'
import { isJsLike, isVueRequest } from '../utils.js'

/**
 * 对齐官方 plugins/define.ts 的核心位置。
 *
 * Vue runtime 的 bundler 版本会保留 __VUE_OPTIONS_API__、
 * process.env.NODE_ENV 等编译期常量。真实 Vite 用 esbuild define
 * 做词法级替换；阅读版用保守的字符串替换展示这条链路。
 */
export function definePlugin(config: ResolvedConfig): Plugin {
  const entries = Object.entries(config.define)
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)] as const)
    .sort((a, b) => b[0].length - a[0].length)

  return {
    name: 'vite-source:define',
    transform(code, id) {
      if (!entries.length || (!isJsLike(id) && !isVueRequest(id))) return null

      let transformed = code
      for (const [key, value] of entries) {
        transformed = transformed.replace(new RegExp(escapeRegExp(key), 'g'), value)
      }
      return transformed === code ? null : transformed
    },
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
