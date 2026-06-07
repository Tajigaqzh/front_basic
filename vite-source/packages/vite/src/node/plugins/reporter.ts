import type { BuildChunk } from '../build.js'
import type { ResolvedConfig } from '../plugin.js'

/**
 * 对齐官方 plugins/reporter.ts。
 *
 * 官方 reporter 插件在 generateBundle/writeBundle 阶段打印 gzip/brotli 等信息。
 * 阅读版 build.ts 直接调用这个函数打印 chunk 列表，保留“构建结果汇总”
 * 这个职责。
 */
export function reportBuildResult(config: ResolvedConfig, chunks: BuildChunk[]): void {
  for (const chunk of chunks) {
    config.logger.info(`[build] ${chunk.fileName} (${chunk.modules.length} modules)`)
  }
}
