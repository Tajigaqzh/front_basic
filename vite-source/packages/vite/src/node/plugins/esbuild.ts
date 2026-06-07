import path from 'node:path'
import type { Plugin, ResolvedConfig, TransformResult } from '../plugin.js'
import { cleanUrl, isJsLike, isVueRequest } from '../utils.js'

export interface ESBuildOptions {
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  jsxInject?: string
  jsxFactory?: string
  jsxFragment?: string
  jsxImportSource?: string
  jsx?: 'transform' | 'preserve' | 'automatic'
  target?: string
  tsconfigRaw?: string | Record<string, unknown>
}

export interface ESBuildTransformResult extends TransformResult {
  warnings?: unknown[]
}

type EsbuildLoader = 'js' | 'jsx' | 'ts' | 'tsx'

/**
 * 对齐官方 plugins/esbuild.ts。
 *
 * 官方实现会读取 tsconfig、合并 source map、生成 code frame，并在 build 阶段
 * 负责更多 target/minify 逻辑。阅读版保留最关键的 dev transform：
 * - .ts/.mts/.cts 去除 TypeScript 类型语法。
 * - .jsx/.tsx 编译 JSX。
 * - Vue SFC 转换后的代码如果来自 <script setup lang="ts">，也可继续走这里。
 */
export function esbuildPlugin(config: ResolvedConfig): Plugin {
  const options = config.esbuild === false ? {} : (config.esbuild ?? {})

  return {
    name: 'vite-source:esbuild',
    enforce: 'post',
    async transform(code, id) {
      if (!shouldTransform(id, options)) return null
      if (id.startsWith('/@vite/')) return null

      const result = await transformWithEsbuild(code, id, options, undefined, config)
      if (options.jsxInject && needsJsxInject(id)) {
        result.code = `${options.jsxInject}\n${result.code}`
      }
      return result
    },
  }
}

export async function transformWithEsbuild(
  code: string,
  filename = 'module.ts',
  options: ESBuildOptions = {},
  _inMap?: unknown,
  _config?: ResolvedConfig,
): Promise<ESBuildTransformResult> {
  const esbuild = await import('esbuild')
  const loader = resolveLoader(filename)

  const result = await esbuild.transform(code, {
    loader,
    sourcemap: true,
    sourcefile: filename,
    target: options.target ?? 'es2020',
    jsx: options.jsx,
    jsxFactory: options.jsxFactory,
    jsxFragment: options.jsxFragment,
    jsxImportSource: options.jsxImportSource,
    tsconfigRaw: options.tsconfigRaw as any,
  })

  return {
    code: result.code,
    map: result.map ? JSON.parse(result.map) : null,
    warnings: result.warnings,
  }
}

function shouldTransform(id: string, options: ESBuildOptions): boolean {
  const clean = cleanUrl(id)
  if (!isJsLike(clean) && !isVueRequest(clean)) return false
  if (matches(options.exclude, clean)) return false
  if (options.include) return matches(options.include, clean)

  /**
   * 默认只处理 TS/JSX 类文件。普通 .js 也可以包含未来语法，但阅读版避免
   * 对所有 JS 做额外转换，保留 dev server 当前行为。
   */
  return /\.(tsx|ts|mts|cts|jsx)$/.test(clean) || isVueRequest(clean)
}

function resolveLoader(filename: string): EsbuildLoader {
  const ext = path.extname(cleanUrl(filename)).slice(1)
  if (ext === 'tsx') return 'tsx'
  if (ext === 'jsx') return 'jsx'
  if (ext === 'ts' || ext === 'mts' || ext === 'cts' || ext === 'vue') return 'ts'
  return 'js'
}

function needsJsxInject(id: string): boolean {
  return /\.(jsx|tsx)$/.test(cleanUrl(id))
}

function matches(patterns: ESBuildOptions['include'], id: string): boolean {
  if (!patterns) return false
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return list.some((pattern) => {
    if (typeof pattern === 'string') return id.includes(pattern)
    return pattern.test(id)
  })
}
