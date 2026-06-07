import type { Middleware } from './transform.js'

export function notFoundMiddleware(): Middleware {
  return function vite404Middleware(req, res) {
    res.statusCode = 404
    res.end(`Not found: ${req.url || '/'}`)
  }
}
