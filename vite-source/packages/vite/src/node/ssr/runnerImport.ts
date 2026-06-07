import type { ViteDevServer } from '../server/index.js'
import { ssrLoadModule, type SsrModule } from './ssrModuleLoader.js'

/**
 * 对齐官方 ssr/runnerImport.ts。
 *
 * 官方 runnerImport 会创建 module runner 并处理 import.meta、source map、
 * HMR runner 等协议。阅读版把它作为 ssrLoadModule 的公开包装层，保持
 * 文件职责和调用入口一致。
 */
export async function runnerImport(
  server: ViteDevServer,
  url: string,
): Promise<SsrModule> {
  return ssrLoadModule(server, url)
}
