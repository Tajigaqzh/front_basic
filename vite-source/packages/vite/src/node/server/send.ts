import { shortHash } from '../utils.js'

export function send(res: any, body: string | Uint8Array, type: string): void {
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.end(body)
}

export function sendStatic(
  req: any,
  res: any,
  body: string | Uint8Array,
  type: string,
  file: string,
): void {
  const etag = `W/"${shortHash(`${file}:${typeof body === 'string' ? body : body.toString()}`)}"`
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', file.includes('/node_modules/') ? 'max-age=31536000, immutable' : 'no-cache')
  if (req.headers?.['if-none-match'] === etag) {
    res.statusCode = 304
    res.end()
    return
  }
  send(res, body, type)
}

export function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg'
  if (file.endsWith('.gif')) return 'image/gif'
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.avif')) return 'image/avif'
  if (file.endsWith('.ico')) return 'image/x-icon'
  return 'application/octet-stream'
}
