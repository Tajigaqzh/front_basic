import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

export function corsMiddleware(server: ViteDevServer): Middleware {
  return function viteCorsMiddleware(_req, res, next) {
    if (server.config.server.cors !== false) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    next()
  }
}
