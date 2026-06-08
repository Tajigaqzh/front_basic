import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { transform } from 'esbuild'
import { init, parse } from 'es-module-lexer'
import type { ResolvedConfig } from '../plugin.js'
import { cleanUrl, isBareImport, isJsLike } from '../utils.js'
import { createOptimizeDepsIncludeResolver } from './resolve.js'

/**
 * 对齐官方 optimizer/scan.ts。
 *
 * 官方使用 Rolldown scan 插件来 crawl HTML、JS、Vue/Svelte 等入口。阅读版
 * 保留扫描职责：计算入口、递归读取源码、发现 bare imports、报告 missing。
 */
export async function scanDeps(config: ResolvedConfig): Promise<string[]> {
  /**
   * 扫描阶段只关心“入口源码静态导入了哪些裸模块”。
   * 它不会执行模块，也不会跑完整插件链；这样 dev server 启动时能快速得到
   * 一批最需要预构建的 node_modules 依赖。
   */
  const entries = await resolveOptimizerEntries(config)
  const include = createOptimizeDepsIncludeResolver(config)
  const deps = new Set(include())
  const excluded = new Set(config.optimizeDeps.exclude)

  for (const entry of entries) {
    await scanFile(entry, deps, excluded, new Set())
  }

  return [...deps].filter((dep) => !excluded.has(dep)).sort()
}

async function resolveOptimizerEntries(config: ResolvedConfig): Promise<string[]> {
  /**
   * optimizeDeps.entries 是显式扫描入口；没有配置时，Vite 从 index.html 的
   * module script 找应用入口。这个选择体现了 Vite 的 HTML-first 应用模型。
   */
  const configured = config.optimizeDeps.entries.map((entry) => path.resolve(config.root, entry))
  if (configured.length) return configured

  const html = path.join(config.root, 'index.html')
  if (!fs.existsSync(html)) return []

  const htmlText = await fsp.readFile(html, 'utf-8')
  return [...htmlText.matchAll(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g)].map((match) =>
    path.resolve(config.root, match[1].replace(/^\//, '')),
  )
}

async function scanFile(
  file: string,
  deps: Set<string>,
  excluded: Set<string>,
  seen: Set<string>,
): Promise<void> {
  /**
   * seen 防止循环 import 重复扫描；isJsLike 限定扫描范围。
   * 官方扫描器会通过插件处理 Vue/Svelte/CSS 等更多入口，这里保留 JS/TS 主干。
   */
  const normalized = cleanUrl(file)
  if (seen.has(normalized) || !fs.existsSync(normalized) || !isJsLike(normalized)) return
  seen.add(normalized)

  const code = await prepareScanCode(await fsp.readFile(normalized, 'utf-8'), normalized)
  for (const specifier of await parseStaticImports(code)) {
    if (isBareImport(specifier)) {
      /**
       * bare import 例如 react、lodash-es，是浏览器不能直接按相对 URL 获取的依赖。
       * optimizer 收集它们，后续生成 /node_modules/.vite-source/deps 下的缓存入口。
       */
      if (!excluded.has(specifier)) deps.add(specifier)
      continue
    }

    if (specifier.startsWith('.')) {
      const child = path.resolve(path.dirname(normalized), specifier)
      await scanFile(resolveExistingJsFile(child), deps, excluded, seen)
    }
  }
}

async function prepareScanCode(code: string, file: string): Promise<string> {
  /**
   * es-module-lexer 解析的是 JS 语法。TS/TSX/JSX 需要先用 esbuild 快速降成
   * ESM JS，再提取静态 import。
   */
  const ext = path.extname(file).slice(1)
  if (!['ts', 'tsx', 'jsx', 'mts'].includes(ext)) return code
  const result = await transform(code, {
    loader: ext === 'mts' ? 'ts' : ext as 'ts' | 'tsx' | 'jsx',
    format: 'esm',
    target: 'es2020',
    jsx: 'transform',
  })
  return result.code
}

async function parseStaticImports(code: string): Promise<string[]> {
  await init
  const [imports] = parse(code)
  return imports
    .map((item) => item.n)
    .filter((specifier): specifier is string => typeof specifier === 'string')
}

function resolveExistingJsFile(file: string): string {
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    const candidate = `${file}${ext}`
    if (fs.existsSync(candidate)) return candidate
  }
  return file
}
