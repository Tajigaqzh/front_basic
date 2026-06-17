#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { VERSION } from './constants.js'
import { build } from './build.js'
import { createServer } from './server/index.js'
import { preview } from './preview.js'
import type { InlineConfig } from './config.js'

interface ParsedCli {
  command: 'serve' | 'build' | 'preview'
  root?: string
  options: Record<string, string | boolean | number>
}

/**
 * CLI 是整个 Vite 执行链路的最薄入口。
 *
 * 官方 Vite 也遵循这个原则：命令行只负责把 argv 转成 InlineConfig，
 * 真正的配置解析、插件链、dev server、build、preview 都走公共 API。
 * 这样 JS API 调用 createServer/build 时，和命令行使用的是同一套核心逻辑。
 */
async function main(): Promise<void> {
  const started = performance.now()
  // 解析参数
  const parsed = parseCli(process.argv.slice(2))
  //   初始化配置
  const inlineConfig = toInlineConfig(parsed)

  if (parsed.options.version) {
    process.stdout.write(`vite-source/${VERSION}\n`)
    return
  }

  if (parsed.options.help) {
    printHelp()
    return
  }

  if (parsed.command === 'build') {
    /**
     * build 入口不会创建 dev server，也不会启动 HMR/WebSocket。
     * 它进入 build.ts 后会 resolveConfig(command='build')，再把 Vite 插件容器
     * 适配给 Rollup，让 Rollup 负责 bundle、tree-shaking 和 chunk graph。
     */
    await build(inlineConfig)
    return
  }

  if (parsed.command === 'preview') {
    /**
     * preview 不是重新构建，也不经过 transformRequest。
     * 它只读取 build.outDir/preview.outDir 里的静态产物，用于本地验证生产包。
     */
    const server = await preview(inlineConfig)
    server.printUrls()
    return
  }

  /**
   * 默认命令是 serve：创建开发服务器，但 createServer 本身还不监听端口。
   * 这和官方 API 保持一致，调用者可以在 listen 前继续接入自定义逻辑。
   */
  const server = await createServer(inlineConfig)
  await server.listen()
  server.config.logger.info(`\n  VITE-SOURCE v${VERSION} ready in ${Math.ceil(performance.now() - started)} ms`)
  server.printUrls()
}

function parseCli(args: string[]): ParsedCli {
  /**
   * 这个阅读版只实现长参数的最小解析器：
   * - 第一个参数是 build/preview 时作为 command。
   * - 其它非 - 开头参数作为 root。
   * - --port 5173 这类数字值会转成 number，方便后续直接进入 server.port。
   *
   * 官方 Vite 使用更完整的 CLI 解析，支持短参数、布尔取反、环境提示等。
   */
  const command = normalizeCommand(args[0])
  const rest = command === 'serve' ? args : args.slice(1)
  const options: ParsedCli['options'] = {}
  let root: string | undefined

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('-')) {
      root = arg
      continue
    }

    const key = arg.replace(/^--?/, '')
    const next = rest[i + 1]
    if (!next || next.startsWith('-')) {
      options[key] = true
    } else {
      options[key] = /^\d+$/.test(next) ? Number(next) : next
      i++
    }
  }

  return { command, root, options }
}

function normalizeCommand(command?: string): ParsedCli['command'] {
  // Vite 的默认命令就是 dev server，所以未知命令在阅读版里统一落到 serve。
  if (command === 'build' || command === 'preview') return command
  return 'serve'
}

function toInlineConfig(parsed: ParsedCli): InlineConfig {
  const options = parsed.options
  /**
   * InlineConfig 是 CLI 和 JS API 的边界对象。
   * 后续 resolveConfig 会把它和 vite.config.*、插件 config 钩子返回值合并，
   * 所以这里不补默认值，只把用户显式输入转换成结构化配置。
   */
  return {
    root: parsed.root,
    base: typeof options.base === 'string' ? options.base : undefined,
    mode: typeof options.mode === 'string' ? options.mode : undefined,
    configFile: typeof options.config === 'string' ? options.config : undefined,
    server: {
      port: typeof options.port === 'number' ? options.port : undefined,
      host: typeof options.host === 'string' ? options.host : undefined,
      strictPort: Boolean(options.strictPort),
      open: readOpenOption(options.open),
    },
    build: {
      outDir: typeof options.outDir === 'string' ? options.outDir : undefined,
      emptyOutDir: options.emptyOutDir === false ? false : undefined,
    },
    preview: {
      port: typeof options.port === 'number' ? options.port : undefined,
      host: typeof options.host === 'string' ? options.host : undefined,
      outDir: typeof options.outDir === 'string' ? options.outDir : undefined,
      open: readOpenOption(options.open),
    },
  }
}

function readOpenOption(value: string | boolean | number | undefined): string | boolean | undefined {
  return typeof value === 'string' || typeof value === 'boolean' ? value : undefined
}

function printHelp(): void {
  process.stdout.write(`
vite-source/${VERSION}

Usage:
  vite-source [root] [--port 5173]
  vite-source build [root] [--outDir dist]
  vite-source preview [root] [--port 4173]

This is a source-reading clone focused on Vite's core execution flow.
`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exit(1)
})
