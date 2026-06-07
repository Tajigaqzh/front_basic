import fsp from 'node:fs/promises'
import path from 'node:path'
import { cleanUrl, urlToFile } from '../../utils.js'
import type { ViteDevServer } from '../index.js'
import { send } from '../send.js'
import type { Middleware } from './transform.js'

/**
 * 对齐官方 server/middlewares/indexHtml.ts。
 *
 * HTML 不是普通静态文件：它需要经过 transformIndexHtml 钩子，让插件可以
 * 注入 /@vite/client、改写资源 URL、追加 preload 等。阅读版目前保留
 * “读取 HTML -> 执行 transformIndexHtml -> 返回 text/html” 的主链路。
 */
export function indexHtmlMiddleware(server: ViteDevServer): Middleware {
  return async function viteIndexHtmlMiddleware(req, res, next) {
    const url = cleanUrl(req.url || '/')
    if (url !== '/' && !url.endsWith('.html')) {
      return next()
    }

    const file = url === '/'
      ? path.join(server.config.root, 'index.html')
      : urlToFile(server.config.root, url)

    try {
      const html = await fsp.readFile(file, 'utf-8')
      send(res, await server.transformIndexHtml(url, html), 'text/html; charset=utf-8')
    } catch {
      next()
    }
  }
}
