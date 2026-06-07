import fs from 'node:fs'
import path from 'node:path'
import { cleanUrl } from '../../utils.js'
import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

/**
 * 对齐官方 server/middlewares/htmlFallback.ts 的最小实现。
 *
 * 当浏览器访问 /foo 这类没有扩展名的路径时，SPA dev server 通常应回退到
 * /index.html，然后继续交给 indexHtmlMiddleware 做 HTML transform。
 */
export function htmlFallbackMiddleware(server: ViteDevServer): Middleware {
  return function viteHtmlFallbackMiddleware(req, _res, next) {
    const url = cleanUrl(req.url || '/')
    if (url === '/' || url.endsWith('.html') || path.extname(url)) {
      return next()
    }

    if (fs.existsSync(path.join(server.config.root, 'index.html'))) {
      req.url = '/index.html'
    }
    next()
  }
}
