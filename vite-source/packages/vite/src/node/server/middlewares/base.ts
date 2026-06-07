import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

/**
 * 对齐官方 server/middlewares/base.ts 的核心概念：
 * 当 config.base 不是 / 时，请求 URL 先剥离 base，后续 middleware 仍然
 * 可以按根路径 /src/main.ts、/index.html 的形式工作。
 */
export function baseMiddleware(server: ViteDevServer): Middleware {
  return function viteBaseMiddleware(req, _res, next) {
    const base = server.config.base
    if (base !== '/' && typeof req.url === 'string' && req.url.startsWith(base)) {
      req.url = req.url.slice(base.length - 1) || '/'
    }
    next()
  }
}
