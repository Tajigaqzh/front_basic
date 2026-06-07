import http from 'node:http'
import https from 'node:https'
import type { ServerOptions } from '../../plugin.js'
import type { ViteDevServer } from '../index.js'
import type { Middleware } from './transform.js'

type ProxyOptions = NonNullable<ServerOptions['proxy']>[string]

export function proxyMiddleware(server: ViteDevServer): Middleware {
  const entries = Object.entries(server.config.server.proxy ?? {})

  return function viteProxyMiddleware(req, res, next) {
    const rawUrl = req.url || '/'
    const matched = entries.find(([context]) => rawUrl.startsWith(context))
    if (!matched) return next()

    const [context, rawOptions] = matched
    const options = normalizeProxyOptions(rawOptions)
    const target = new URL(options.target)
    const rewritten = (options.rewrite?.(rawUrl) ?? rawUrl.replace(context, '')) || '/'
    const requestImpl = target.protocol === 'https:' ? https.request : http.request

    const proxyReq = requestImpl({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: `${target.pathname.replace(/\/$/, '')}${rewritten}`,
      headers: {
        ...req.headers,
        host: options.changeOrigin ? target.host : req.headers.host,
      },
    }, (proxyRes: any) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (error: Error) => next(error))
    req.pipe(proxyReq)
  }
}

function normalizeProxyOptions(options: ProxyOptions): Exclude<ProxyOptions, string> {
  return typeof options === 'string' ? { target: options } : options
}
