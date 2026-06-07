import type { ViteDevServer } from '../index.js'

export function errorMiddleware(server: ViteDevServer) {
  return function viteErrorMiddleware(error: unknown, _req: any, res: any): void {
    server.config.logger.error(error as Error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    }
    res.end(String((error as Error)?.message ?? error))
  }
}
