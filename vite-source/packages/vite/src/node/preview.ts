import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createServer as createHttpServer } from 'node:http'
import { resolveConfig, type InlineConfig } from './config.js'

export async function preview(inlineConfig: InlineConfig = {}) {
  const config = await resolveConfig(inlineConfig, 'serve')
  const outDir = path.resolve(config.root, inlineConfig.preview?.outDir ?? config.preview.outDir)

  const httpServer = createHttpServer(async (req: any, res: any) => {
    const url = req.url === '/' ? '/index.html' : req.url
    const file = path.join(outDir, String(url).replace(/^\//, ''))
    if (!fs.existsSync(file)) {
      res.statusCode = 404
      res.end(`Not found: ${url}`)
      return
    }
    res.statusCode = 200
    res.end(await fsp.readFile(file))
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(config.preview.port, config.preview.host || '0.0.0.0', resolve)
  })

  return {
    httpServer,
    printUrls() {
      config.logger.info(`  Preview: http://localhost:${config.preview.port}${config.base}`)
    },
    close() {
      return new Promise<void>((resolve) => httpServer.close(() => resolve()))
    },
  }
}
