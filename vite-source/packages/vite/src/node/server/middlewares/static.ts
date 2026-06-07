import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { cleanUrl, urlToFile } from '../../utils.js'
import type { ViteDevServer } from '../index.js'
import { contentType, sendStatic } from '../send.js'
import type { Middleware } from './transform.js'

/**
 * 对齐官方 server/middlewares/static.ts。
 *
 * 这里服务“无需插件转换”的真实文件，比如图片二进制。JS/CSS/Vue/JSON
 * 已经在 transformMiddleware 中被拦截，所以不会把源码模块误当静态文件。
 */
export function serveStaticMiddleware(server: ViteDevServer): Middleware {
  return async function viteServeStaticMiddleware(req, res, next) {
    const url = cleanUrl(req.url || '/')
    if (url.endsWith('/') || url.endsWith('.html') || url.startsWith('/@')) {
      return next()
    }

    const file = urlToFile(server.config.root, url)
    if (!isFileInsideRoot(server.config.root, file)) {
      return next()
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return next()
    }

    sendStatic(req, res, await fsp.readFile(file), contentType(file), file)
  }
}

function isFileInsideRoot(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
