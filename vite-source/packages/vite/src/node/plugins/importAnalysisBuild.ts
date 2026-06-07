import type { Plugin, ResolvedConfig } from '../plugin.js'

export const isModernFlag = '__VITE_IS_MODERN__'
export const preloadMethod = '__vitePreload'
export const preloadMarker = '__VITE_PRELOAD__'
export const preloadHelperId = '\0vite/preload-helper.js'

/**
 * 对齐官方 plugins/importAnalysisBuild.ts。
 *
 * 官方 build 插件会给动态 import 注入 modulepreload helper，并在 renderChunk
 * 阶段替换 preload marker。阅读版 build graph 还没跑 Rollup hook，因此这里
 * 保留 helper 虚拟模块和入口函数，后续 build.ts 可以继续接入。
 */
export function buildImportAnalysisPlugin(_config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:build-import-analysis',
    resolveId(id) {
      if (id === preloadHelperId) return { id }
      return null
    },
    load(id) {
      if (id !== preloadHelperId) return null
      return [
        `export function ${preloadMethod}(baseModule, deps) {`,
        `  if (deps) for (const dep of deps) {`,
        `    const link = document.createElement('link');`,
        `    link.rel = dep.endsWith('.css') ? 'stylesheet' : 'modulepreload';`,
        `    link.href = dep;`,
        `    document.head.appendChild(link);`,
        `  }`,
        `  return baseModule();`,
        `}`,
      ].join('\n')
    },
  }
}
