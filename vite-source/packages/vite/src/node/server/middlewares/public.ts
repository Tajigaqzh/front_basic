import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { cleanUrl } from '../../utils.js'
import type { ViteDevServer } from '../index.js'
import { contentType, sendStatic } from '../send.js'
import type { Middleware } from './transform.js'

export function servePublicMiddleware(server: ViteDevServer): Middleware {
  const publicDir = path.join(server.config.root, 'public')

  return async function viteServePublicMiddleware(req, res, next) {
    if (!fs.existsSync(publicDir)) return next()

    const url = cleanUrl(req.url || '/')
    if (url.endsWith('/') || url.startsWith('/@')) return next()

    const file = path.resolve(publicDir, url.replace(/^\//, ''))
    if (!isFileInsideRoot(publicDir, file)) return next()
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()

    sendStatic(req, res, await fsp.readFile(file), contentType(file), file)
  }
}

function isFileInsideRoot(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
