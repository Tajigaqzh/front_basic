import type { Plugin, ResolvedConfig } from '../plugin.js'
import { isJsLike, isVueRequest } from '../utils.js'

export const dynamicImportHelperId = '\0vite/dynamic-import-helper.js'

/**
 * 对齐官方 plugins/dynamicImportVars.ts。
 *
 * 官方借助 @rollup/plugin-dynamic-import-vars 把动态 import 转成 glob 映射。
 * 阅读版支持最常见的一层动态片段：
 *
 *   import(`./pages/${name}.js`)
 *   -> __vite_dynamic_import_helper__(import.meta.glob('./pages/*.js'), `./pages/${name}.js`, 3)
 */
export function dynamicImportVarsPlugin(_config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:dynamic-import-vars',
    resolveId(id) {
      if (id === dynamicImportHelperId) return id
      return null
    },
    load(id) {
      if (id !== dynamicImportHelperId) return null
      return `export default function __vite_dynamic_import_helper__(glob, path, segs) {
  const loader = glob[path]
  if (loader) return typeof loader === 'function' ? loader() : Promise.resolve(loader)
  return Promise.reject(new Error('Unknown variable dynamic import: ' + path + (path.split('/').length !== segs ? '. Note that variables only represent file names one level deep.' : '')))
}`
    },
    transform(code, id) {
      if (!code.includes('import(`') || (!isJsLike(id) && !isVueRequest(id))) return null

      let changed = false
      const transformed = code.replace(/import\s*\(\s*(`[^`]*\$\{[^`]+}[^`]*`)\s*\)/g, (_full, rawTemplate: string) => {
        const pattern = templateToGlob(rawTemplate)
        if (!pattern) return _full
        changed = true
        const segmentCount = templateStaticShape(rawTemplate).split('/').length
        return `__vite_dynamic_import_helper__(import.meta.glob(${JSON.stringify(pattern)}), ${rawTemplate}, ${segmentCount})`
      })

      if (!changed) return null
      return `import __vite_dynamic_import_helper__ from ${JSON.stringify(`/@id/${encodeURIComponent(dynamicImportHelperId)}`)};\n${transformed}`
    },
  }
}

function templateToGlob(rawTemplate: string): string | null {
  const content = rawTemplate.slice(1, -1)
  if (!content.startsWith('./') && !content.startsWith('../') && !content.startsWith('/')) return null
  return content.replace(/\$\{[^}]+}/g, '*')
}

function templateStaticShape(rawTemplate: string): string {
  return rawTemplate.slice(1, -1).replace(/\$\{[^}]+}/g, '*')
}
