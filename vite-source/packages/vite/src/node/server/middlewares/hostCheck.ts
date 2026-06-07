import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

export function hostCheckMiddleware(server: ViteDevServer): Middleware {
  return function viteHostCheckMiddleware(req, res, next) {
    const allowed = server.config.server.allowedHosts
    if (allowed === true) return next()

    const host = String(req.headers?.host ?? '').split(':')[0]
    const localhost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    const configured = Array.isArray(allowed) && allowed.includes(host)
    if (!host || localhost || configured) return next()

    res.statusCode = 403
    res.end(`Blocked request host: ${host}`)
  }
}
