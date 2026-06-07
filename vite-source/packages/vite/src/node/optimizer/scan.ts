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
  const normalized = cleanUrl(file)
  if (seen.has(normalized) || !fs.existsSync(normalized) || !isJsLike(normalized)) return
  seen.add(normalized)

  const code = await prepareScanCode(await fsp.readFile(normalized, 'utf-8'), normalized)
  for (const specifier of await parseStaticImports(code)) {
    if (isBareImport(specifier)) {
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
