import fsp from 'node:fs/promises'
import path from 'node:path'
import { build as esbuildBuild } from 'esbuild'
import type { ResolvedConfig } from '../plugin.js'
import { tryNodeResolve } from '../plugins/resolve.js'
import { shortHash, slash } from '../utils.js'

export interface BundledDepResult {
  id: string
  entry: string
  file: string
  modules: string[]
  code: string
  needsInterop: boolean
}

/**
 * 对齐官方 optimizer/rolldownDepPlugin.ts 的职责边界。
 *
 * 官方 Vite 新版本可以用 Rolldown 预构建依赖；传统路径使用 esbuild。
 * 阅读版先接入真实 esbuild bundle，让 optimizeDeps 不再只是代理模块：
 *
 *   bare dep -> package entry -> esbuild bundle(format esm) -> deps cache file
 *
 * 这样浏览器请求 /node_modules/.vite-source/deps/vue.js 时拿到的是已经打平的
 * ESM 依赖文件，能观察到真实预构建、CJS 转 ESM、metafile 输入模块列表。
 */
export async function bundleOptimizedDep(
  config: ResolvedConfig,
  dep: string,
  outFile: string,
): Promise<BundledDepResult> {
  const resolved = tryNodeResolve(dep, undefined, { config, tryIndex: true })
  const entry = resolved?.external ? dep : resolved?.id ?? dep

  await fsp.mkdir(path.dirname(outFile), { recursive: true })

  const result = await esbuildBuild({
    absWorkingDir: config.root,
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    metafile: true,
    write: true,
    splitting: false,
    mainFields: config.resolve.mainFields,
    conditions: [
      ...config.resolve.conditions,
      config.isProduction ? 'production' : 'development',
      'import',
      'default',
    ],
    logLevel: 'silent',
    define: normalizeEsbuildDefine(config.define),
  })

  const code = await fsp.readFile(outFile, 'utf-8')
  const modules = Object.keys(result.metafile?.inputs ?? {}).map((input) =>
    slash(path.resolve(config.root, input)),
  )
  const needsInterop = Object.values(result.metafile?.inputs ?? {}).some((input: any) =>
    input.format === 'cjs',
  )

  /**
   * 给优化产物追加很小的可读注释。真实 Vite 不需要这段，但源码阅读时能从
   * 文件里直接看到 dep、entry、hash、CJS interop 判断结果。
   */
  const annotated = [
    `// Bundled by vite-source optimizer using esbuild.`,
    `// dep=${dep}`,
    `// entry=${slash(String(entry))}`,
    `// needsInterop=${String(needsInterop)}`,
    code,
    `export const __vite_source_dep = ${JSON.stringify(dep)};`,
    `export const __vite_source_hash = ${JSON.stringify(shortHash(code))};`,
  ].join('\n')

  await fsp.writeFile(outFile, annotated)

  return {
    id: dep,
    entry,
    file: outFile,
    modules,
    code: annotated,
    needsInterop,
  }
}

function normalizeEsbuildDefine(define: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(define)) {
    normalized[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return normalized
}
