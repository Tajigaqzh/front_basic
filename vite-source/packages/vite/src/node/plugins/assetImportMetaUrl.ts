import path from 'node:path'
import type { Plugin, ResolvedConfig } from '../plugin.js'
import { isAssetRequest, isJsLike, isVueRequest, pathToUrl } from '../utils.js'

/**
 * 对齐官方 plugins/assetImportMetaUrl.ts。
 *
 * 开发阶段把：
 *   new URL('./logo.png', import.meta.url)
 * 转成：
 *   new URL('/src/logo.png', import.meta.url)
 *
 * 这样浏览器会继续向 dev server 请求真实图片文件。官方实现还支持构建产物
 * hash、publicDir、动态模板字符串转 glob、以及 /* @vite-ignore *\/。
 */
export function assetImportMetaUrlPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:asset-import-meta-url',
    transform(code, id) {
      if (!code.includes('new URL') || !code.includes('import.meta.url')) return null
      if (!isJsLike(id) && !isVueRequest(id)) return null

      let changed = false
      const importer = path.dirname(id.split('?')[0])
      const transformed = code.replace(
        /\bnew\s+URL\s*\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g,
        (full, quote: string, rawUrl: string) => {
          if (!rawUrl.startsWith('.') || !isAssetRequest(rawUrl)) return full
          const file = path.resolve(importer, rawUrl)
          changed = true
          return `new URL(${quote}${pathToUrl(config.root, file)}${quote}, import.meta.url)`
        },
      )

      return changed ? transformed : null
    },
  }
}
