import { CLIENT_PUBLIC_PATH } from '../../constants.js'
import {
  cleanUrl,
  isAssetRequest,
  isCss,
  isExplicitImportRequest,
  isJsLike,
  isJson,
  isVueRequest,
} from '../../utils.js'
import type { ViteDevServer } from '../index.js'
import { send } from '../send.js'

export type NextFunction = (error?: unknown) => void | Promise<void>
export type Middleware = (req: any, res: any, next: NextFunction) => void | Promise<void>

/**
 * 对齐官方 server/middlewares/transform.ts 的职责：
 * 只处理“需要经过插件容器转换后才能给浏览器执行”的请求。
 *
 * 例如：
 * - /@vite/client 虚拟模块
 * - /@id/vue 依赖模块
 * - /src/main.ts 源码模块
 * - /src/App.vue 和 .vue?vue&type=template 子模块
 * - /src/logo.png?import 资源 import 代理模块
 */
export function transformMiddleware(server: ViteDevServer): Middleware {
  return async function viteTransformMiddleware(req, res, next) {
    const rawUrl = req.url || '/'
    const url = cleanUrl(rawUrl)

    if (!isTransformRequest(rawUrl, url)) {
      return next()
    }

    const result = await server.transformRequest(rawUrl)
    if (!result) {
      return next()
    }

    send(res, result.code, 'text/javascript; charset=utf-8')
  }
}

function isTransformRequest(rawUrl: string, url: string): boolean {
  return (
    url === CLIENT_PUBLIC_PATH ||
    url.startsWith('/@id/') ||
    isJsLike(url) ||
    isCss(url) ||
    isJson(url) ||
    isVueRequest(url) ||
    (isExplicitImportRequest(rawUrl) && isAssetRequest(url))
  )
}
