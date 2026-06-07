import { performance } from 'node:perf_hooks'
import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

export function timeMiddleware(server: ViteDevServer): Middleware {
  return async function viteTimeMiddleware(req, res, next) {
    const start = performance.now()
    const end = res.end
    res.end = function patchedEnd(...args: any[]) {
      const elapsed = Math.ceil(performance.now() - start)
      if (elapsed > 100) {
        server.config.logger.info(`[time] ${req.url || '/'} ${elapsed}ms`)
      }
      return end.apply(this, args)
    }
    await next()
  }
}
