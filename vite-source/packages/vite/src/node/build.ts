import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * 阅读定位：
 * build.ts 是 dev 请求式转换和生产 bundle 的分界点。这里复用 Vite 插件容器
 * 做 resolve/load/transform，但把模块图、tree-shaking、chunk 输出交给 Rollup。
 * 阅读时重点看 viteBuildRollupPlugin：它就是 Vite 插件世界和 Rollup 世界的桥。
 */
import {
  rollup,
  type OutputAsset,
  type OutputChunk,
  type OutputOptions,
  type Plugin as RollupPlugin,
  type RollupOutput,
  type RollupOptions,
} from 'rollup'
import { transform as esbuildTransform } from 'esbuild'
import { resolveConfig, type InlineConfig, type ResolvedConfig } from './config.js'
import { createPluginContainer, type PluginContainer } from './server/pluginContainer.js'
import { cleanUrl, isCss, pathToUrl, shortHash, urlToFile } from './utils.js'
import { createBuildManifest } from './plugins/manifest.js'
import { reportBuildResult } from './plugins/reporter.js'

export async function build(inlineConfig: InlineConfig = {}): Promise<void> {
  const config = await resolveConfig(inlineConfig, 'build')
  const outDir = path.resolve(config.root, config.build.outDir)

  if (config.build.emptyOutDir && fs.existsSync(outDir)) {
    await fsp.rm(outDir, { recursive: true, force: true })
  }
  await fsp.mkdir(outDir, { recursive: true })

  const pluginContainer = await createPluginContainer(config)
  const htmlPath = path.join(config.root, 'index.html')
  let html = await fsp.readFile(htmlPath, 'utf-8')

  try {
    /**
     * 官方 Vite build 的关键分界线在这里：
     *
     * - Vite 负责解析配置、创建插件链、把 HTML 入口转成 JS 入口。
     * - Rollup/Rolldown 负责真正的模块图、tree-shaking、chunk graph、
     *   dynamic import 拆包和 manualChunks。
     *
     * 阅读版用 Rollup JS API 承担 bundler 职责，同时用一个 adapter plugin
     * 复用当前 Vite 插件容器的 resolve/load/transform。
     */
    const entries = resolveBuildEntries(config, html)
    const graph = await createChunkGraph(config, pluginContainer, entries)

    await writeRollupOutput(config, outDir, graph.output)

    html = replaceHtmlEntryScripts(config, html, entries, graph.chunks)
    html = injectBuildCssLinks(config, html, graph.css)
    html = await pluginContainer.transformIndexHtml(html, { path: '/index.html' })
    await fsp.writeFile(path.join(outDir, 'index.html'), html)
    await fsp.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(createBuildManifest(graph.chunks), null, 2))

    reportBuildResult(config, graph.chunks)
    config.logger.info(`[build] output: ${outDir}`)
  } finally {
    await pluginContainer.close()
  }
}

export async function createBuilder(inlineConfig: InlineConfig = {}) {
  return {
    buildApp: () => build(inlineConfig),
  }
}

export type BuildEnvironmentOptions = NonNullable<InlineConfig['build']>

interface BuildEntry {
  name: string
  url: string
  id: string
}

function resolveBuildEntries(config: Awaited<ReturnType<typeof resolveConfig>>, html: string): BuildEntry[] {
  const input = config.build.rollupOptions?.input
  if (typeof input === 'string') return [toBuildEntry(config, input)]
  if (Array.isArray(input)) return input.map((item) => toBuildEntry(config, item))
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([name, value]) => toBuildEntry(config, value, name))
  }

  const entries = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g)]
    .map((match) => toBuildEntry(config, cleanUrl(match[1])))

  if (!entries.length) {
    throw new Error('Build entry not found. Add <script type="module" src="..."> or build.rollupOptions.input.')
  }

  return entries
}

function toBuildEntry(config: ResolvedConfig, entry: string, name?: string): BuildEntry {
  const id = normalizeEntry(config, entry)
  return {
    name: name ?? sanitizeChunkName(path.basename(cleanUrl(entry), path.extname(cleanUrl(entry)))),
    url: entry.startsWith('/') ? cleanUrl(entry) : pathToUrl(config.root, id),
    id,
  }
}

export interface BuildModule {
  id: string
  url: string
  code: string
  deps: string[]
  dynamicDeps: string[]
}

export interface BuildChunk {
  name: string
  fileName: string
  isEntry: boolean
  facadeModuleId?: string | null
  modules: BuildModule[]
  imports: string[]
  dynamicImports: string[]
  code: string
}

export interface ChunkGraph {
  entries: string[]
  modules: Map<string, BuildModule>
  chunks: BuildChunk[]
  css: BuildCssAsset[]
  output: RollupOutput['output']
}

export interface BuildCssAsset {
  id: string
  fileName: string
  source: string
}

/**
 * createChunkGraph 保留官方 build.ts 里的同名概念：构建不是简单把文件拼起来，
 * 而是让 bundler 从入口出发生成完整模块图。Rollup 会在这里完成：
 *
 * - tree-shaking：未使用 export 不进入最终 chunk。
 * - shared chunk：多个入口或动态入口共享的模块会被抽出。
 * - manualChunks：用户通过 build.rollupOptions.output.manualChunks 指定拆包。
 * - dynamic import：动态边界会变成独立 chunk，并写入 dynamicImports。
 */
export async function createChunkGraph(
  config: ResolvedConfig,
  pluginContainer: PluginContainer,
  entries: BuildEntry[] | string[],
): Promise<ChunkGraph> {
  const normalizedEntries = entries.map((entry) =>
    typeof entry === 'string' ? toBuildEntry(config, entry) : entry,
  )
  const cssAssets: BuildCssAsset[] = []
  const bundle = await rollup(createRollupOptions(config, pluginContainer, normalizedEntries, cssAssets))

  try {
    const generated = await bundle.generate(createRollupOutputOptions(config))
    const chunks = generated.output.filter(isOutputChunk).map((chunk) => toBuildChunk(config, chunk))
    const modules = new Map<string, BuildModule>()
    for (const chunk of chunks) {
      for (const mod of chunk.modules) modules.set(mod.id, mod)
    }

    return {
      entries: normalizedEntries.map((entry) => entry.id),
      modules,
      chunks,
      css: cssAssets,
      output: generated.output,
    }
  } finally {
    await bundle.close()
  }
}

function createRollupOptions(
  config: ResolvedConfig,
  pluginContainer: PluginContainer,
  entries: BuildEntry[],
  cssAssets: BuildCssAsset[],
): RollupOptions {
  return {
    input: Object.fromEntries(entries.map((entry) => [entry.name, entry.id])),
    external: config.build.rollupOptions?.external as RollupOptions['external'],
    treeshake: config.build.rollupOptions?.treeshake as RollupOptions['treeshake'],
    plugins: [viteBuildRollupPlugin(config, pluginContainer, cssAssets)],
    onwarn(warning, warn) {
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      warn(warning)
    },
  }
}

function createRollupOutputOptions(config: ResolvedConfig): OutputOptions {
  const output = config.build.rollupOptions?.output
  const format = output?.format === 'esm' ? 'es' : output?.format

  return {
    format: (format ?? 'es') as OutputOptions['format'],
    entryFileNames: output?.entryFileNames ?? 'assets/[name].[hash].js',
    chunkFileNames: output?.chunkFileNames ?? 'assets/[name].[hash].js',
    assetFileNames: output?.assetFileNames ?? 'assets/[name].[hash][extname]',
    manualChunks: output?.manualChunks as OutputOptions['manualChunks'],
    sourcemap: config.build.sourcemap,
    compact: Boolean(config.build.minify),
  }
}

function viteBuildRollupPlugin(
  config: ResolvedConfig,
  pluginContainer: PluginContainer,
  cssAssets: BuildCssAsset[],
): RollupPlugin {
  return {
    name: 'vite-source:rollup-adapter',
    async resolveId(source, importer) {
      /**
       * Rollup 会先解析入口的绝对路径。绝对真实文件可以直接返回；
       * 其它请求仍走 Vite resolver，这样 alias、exports/imports、
       * browser field、Vue 子请求和虚拟模块都复用同一套规则。
       */
      const clean = cleanUrl(source)
      if (path.isAbsolute(clean) && fs.existsSync(clean)) return source

      const resolved = await pluginContainer.resolveId(source, importer)
      if (!resolved) return null

      return {
        id: resolved.id,
        external: resolved.external ?? false,
        meta: resolved.meta as Record<string, unknown> | undefined,
      }
    },
    async load(id) {
      const loaded = await pluginContainer.load(id)
      if (loaded && isBuildCssRequest(id)) {
        const extracted = extractCssFromJs(loaded.code, id)
        if (extracted) {
          const fileName = `assets/${sanitizeChunkName(path.basename(cleanUrl(id)).replace(/\.[^.]+$/, ''))}.${shortHash(extracted.css)}.css`
          this.emitFile({
            type: 'asset',
            fileName,
            source: extracted.css,
          })
          cssAssets.push({ id, fileName, source: extracted.css })
          return {
            code: extracted.js,
            map: loaded.map as any,
          }
        }
      }
      flushPluginContainerEmittedFiles(this, pluginContainer)
      return loaded ? toRollupHookResult(loaded) : null
    },
    async transform(code, id) {
      const transformed = await pluginContainer.transform(code, id)
      if (isBuildCssRequest(id)) {
        const extracted = extractCssFromJs(transformed.code, id)
        if (extracted) {
          const fileName = `assets/${sanitizeChunkName(path.basename(cleanUrl(id)).replace(/\.[^.]+$/, ''))}.${shortHash(extracted.css)}.css`
          this.emitFile({
            type: 'asset',
            fileName,
            source: extracted.css,
          })
          cssAssets.push({ id, fileName, source: extracted.css })
          return {
            code: stripBuildHmr(extracted.js),
            map: transformed.map as any,
          }
        }
      }
      flushPluginContainerEmittedFiles(this, pluginContainer)
      return toRollupHookResult({
        ...transformed,
        code: stripBuildHmr(transformed.code),
      })
    },
  }
}

function flushPluginContainerEmittedFiles(
  rollupContext: { emitFile(file: any): string },
  pluginContainer: PluginContainer,
): void {
  for (const file of pluginContainer.takeEmittedFiles()) {
    if (file.type === 'asset') {
      rollupContext.emitFile({
        type: 'asset',
        name: file.name,
        fileName: file.fileName,
        source: file.source ?? '',
      })
    } else if (file.id) {
      rollupContext.emitFile({
        type: 'chunk',
        id: file.id,
        name: file.name,
        fileName: file.fileName,
      })
    }
  }
}

function toBuildChunk(config: ResolvedConfig, chunk: OutputChunk): BuildChunk {
  const moduleIds = chunk.moduleIds ?? Object.keys(chunk.modules)
  const modules = moduleIds.map((id) => {
    const rendered = chunk.modules[id]
    return {
      id,
      url: path.isAbsolute(id) ? pathToUrl(config.root, id) : id,
      code: rendered?.code ?? '',
      deps: [],
      dynamicDeps: [],
    }
  })

  return {
    name: chunk.name,
    fileName: chunk.fileName,
    isEntry: chunk.isEntry,
    facadeModuleId: chunk.facadeModuleId,
    modules,
    imports: [...chunk.imports],
    dynamicImports: [...chunk.dynamicImports],
    code: chunk.code,
  }
}

async function writeRollupOutput(
  config: ResolvedConfig,
  outDir: string,
  output: RollupOutput['output'],
): Promise<void> {
  for (const item of output) {
    const file = path.join(outDir, item.fileName)
    await fsp.mkdir(path.dirname(file), { recursive: true })
    if (isOutputChunk(item)) {
      const code = await finalizeBuildChunkCode(config, item)
      await fsp.writeFile(file, code)
    } else {
      await fsp.writeFile(file, item.source)
    }
  }
}

async function finalizeBuildChunkCode(config: ResolvedConfig, chunk: OutputChunk): Promise<string> {
  if (!config.build.minify) return chunk.code
  const result = await esbuildTransform(chunk.code, {
    loader: 'js',
    format: 'esm',
    target: 'es2020',
    minify: true,
    sourcemap: false,
  })
  return result.code
}

function injectBuildCssLinks(config: ResolvedConfig, html: string, css: BuildCssAsset[]): string {
  if (!css.length) return html
  const links = css
    .map((asset) => `<link rel="stylesheet" href="${toPublicPath(config, asset.fileName)}">`)
    .join('\n')
  return html.includes('</head>')
    ? html.replace('</head>', `${links}\n</head>`)
    : `${links}\n${html}`
}

function replaceHtmlEntryScripts(
  config: ResolvedConfig,
  html: string,
  entries: BuildEntry[],
  chunks: BuildChunk[],
): string {
  let transformed = html
  for (const entry of entries) {
    const chunk = chunks.find((item) =>
      item.isEntry && (item.facadeModuleId === entry.id || item.name === entry.name),
    )
    if (!chunk) continue
    const publicPath = toPublicPath(config, chunk.fileName)
    transformed = transformed.replace(
      /<script\b([^>]*\btype=(["'])module\2[^>]*)\bsrc=(["'])([^"']+)\3([^>]*)><\/script>/g,
      (full, before: string, _typeQuote: string, srcQuote: string, src: string, after: string) => {
        return cleanUrl(src) === entry.url
          ? `<script${before}src=${srcQuote}${publicPath}${srcQuote}${after}></script>`
          : full
      },
    )
  }
  return transformed
}

function normalizeEntry(config: ResolvedConfig, entry: string): string {
  const clean = cleanUrl(entry)
  if (path.isAbsolute(clean)) return clean
  if (clean.startsWith('/')) return urlToFile(config.root, clean)
  return path.resolve(config.root, clean)
}

function isBuildCssRequest(id: string): boolean {
  return isCss(id) || (id.includes('.vue?') && id.includes('type=style'))
}

function extractCssFromJs(code: string, id: string): { css: string; js: string } | null {
  const match = /^const css = ((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*'));\n/.exec(code)
  if (!match) return null

  const css = JSON.parse(match[1])
  const exportsStart = code.search(/\bexport\s+/)
  const exportsOnly = exportsStart === -1 ? `export default ${JSON.stringify('')};` : code.slice(exportsStart)
  return {
    css,
    js: [
      `// CSS extracted by vite-source build: ${id}`,
      exportsOnly.replace(/export\s+default\s+css\s*;/g, `export default ${JSON.stringify(css)};`),
    ].join('\n'),
  }
}

function toPublicPath(config: ResolvedConfig, fileName: string): string {
  return `${config.base}${fileName}`.replace(/\/{2,}/g, '/')
}

function sanitizeChunkName(name: string): string {
  return name.replace(/[^\w$-]+/g, '_') || 'entry'
}

function toRollupHookResult(result: { code: string; map?: unknown }) {
  return {
    code: result.code,
    map: result.map as any,
  }
}

function isOutputChunk(item: OutputChunk | OutputAsset): item is OutputChunk {
  return item.type === 'chunk'
}

function stripBuildHmr(code: string): string {
  return code
    .replace(/^\s*if\s*\(\s*import\.meta\.hot\s*\)\s*import\.meta\.hot\.accept\(.*\);\s*$/gm, '')
    .replace(/^\s*if\s*\(\s*undefined\s*\)\s*undefined\.accept\(.*\);\s*$/gm, '')
    .replace(/^\s*if\s*\(\s*import\.meta\.hot\s*\)\s*\{\s*\n\s*import\.meta\.hot\.accept\(.*\);?\s*\n\s*\}\s*$/gm, '')
    .replace(/^\s*if\s*\(\s*undefined\s*\)\s*\{\s*\n\s*undefined\.accept\(.*\);?\s*\n\s*\}\s*$/gm, '')
}
