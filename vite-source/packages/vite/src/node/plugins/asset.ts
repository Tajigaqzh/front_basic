import fs from 'node:fs'
import type { Plugin, ResolvedConfig } from '../plugin.js'
import { cleanUrl, isAssetRequest, pathToUrl } from '../utils.js'

export function assetPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:asset',
    load(id) {
      const file = cleanUrl(id)
      if (!isAssetRequest(file) || !fs.existsSync(file)) return null

      /**
       * JS 中 import logo from './logo.png' 时，浏览器实际需要拿到的是
       * 一个 JS 模块，而不是图片二进制。这个模块默认导出最终资源 URL；
       * 真正的图片请求仍然走 server 的静态文件分支。
       */
      return `export default ${JSON.stringify(pathToUrl(config.root, file))};`
    },
  }
}
