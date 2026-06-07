import type { Awaitable } from './utils.js'
import type { ViteDevServer } from './server/index.js'

export interface ConfigEnv {
  command: 'serve' | 'build'
  mode: string
}

export type UserConfigExport =
  | UserConfig
  | Promise<UserConfig>
  | ((env: ConfigEnv) => Awaitable<UserConfig>)

export interface UserConfig {
  root?: string
  base?: string
  mode?: string
  configFile?: string | false
  logLevel?: 'info' | 'warn' | 'error' | 'silent'
  define?: Record<string, unknown>
  plugins?: PluginOption[]
  server?: ServerOptions
  build?: BuildOptions
  preview?: PreviewOptions
  resolve?: ResolveOptions
  optimizeDeps?: DepOptimizationOptions
  ssr?: SSROptions
  css?: CSSOptions
  esbuild?: import('./plugins/esbuild.js').ESBuildOptions | false
}

export interface InlineConfig extends UserConfig {}

export interface ServerOptions {
  host?: string | boolean
  port?: number
  strictPort?: boolean
  open?: boolean | string
  hmr?: boolean | Record<string, unknown>
  origin?: string
  cors?: boolean
  allowedHosts?: string[] | true
  proxy?: Record<string, string | { target: string; changeOrigin?: boolean; rewrite?: (path: string) => string }>
}

export interface BuildOptions {
  outDir?: string
  emptyOutDir?: boolean
  minify?: boolean
  sourcemap?: boolean
  watch?: unknown
  rollupOptions?: {
    input?: string | string[] | Record<string, string>
    output?: {
      manualChunks?: unknown
      entryFileNames?: string
      chunkFileNames?: string
      assetFileNames?: string
      format?: 'es' | 'esm' | 'system' | 'cjs' | 'umd' | 'iife'
    }
    external?: unknown
    treeshake?: unknown
  }
}

export interface PreviewOptions extends ServerOptions {
  outDir?: string
}

export type AliasOptions = Record<string, string> | { find: string | RegExp; replacement: string }[]

export interface ResolveOptions {
  alias?: AliasOptions
  extensions?: string[]
  mainFields?: string[]
  conditions?: string[]
  preserveSymlinks?: boolean
  dedupe?: string[]
}

export interface DepOptimizationOptions {
  entries?: string[]
  include?: string[]
  exclude?: string[]
  force?: boolean
}

export interface SSROptions {
  noExternal?: string[] | boolean
  external?: string[]
}

export interface CSSOptions {
  modules?: {
    localsConvention?: 'camelCase' | 'dashes' | 'asIs'
    generateScopedName?: string | ((className: string, filename: string, css: string) => string)
  }
  preprocessorOptions?: {
    scss?: { additionalData?: string; [key: string]: unknown }
    sass?: { additionalData?: string; [key: string]: unknown }
    less?: { additionalData?: string; [key: string]: unknown }
    styl?: { additionalData?: string }
    stylus?: { additionalData?: string }
  }
  postcss?:
    | string
    | {
        plugins?: Array<any>
      }
  devSourcemap?: boolean
}

export interface ResolvedConfig {
  command: 'serve' | 'build'
  mode: string
  root: string
  base: string
  define: Record<string, unknown>
  env: Record<string, string>
  isProduction: boolean
  configFile?: string
  logLevel: 'info' | 'warn' | 'error' | 'silent'
  plugins: Plugin[]
  server: Required<Pick<ServerOptions, 'port' | 'strictPort'>> & ServerOptions
  build: Required<Pick<BuildOptions, 'outDir' | 'emptyOutDir' | 'minify' | 'sourcemap'>> & BuildOptions
  preview: Required<Pick<PreviewOptions, 'port' | 'strictPort' | 'outDir'>> & PreviewOptions
  resolve: Required<ResolveOptions>
  optimizeDeps: Required<DepOptimizationOptions>
  ssr: Required<Pick<SSROptions, 'external'>> & SSROptions
  css: CSSOptions
  esbuild?: import('./plugins/esbuild.js').ESBuildOptions | false
  packageCache: import('./packages.js').PackageCache
  logger: import('./logger.js').Logger
}

export interface ResolvedId {
  id: string
  external?: boolean
  meta?: Record<string, unknown>
}

export interface TransformResult {
  code: string
  map?: unknown
  meta?: Record<string, unknown>
}

export interface EmittedFile {
  type: 'asset' | 'chunk'
  name?: string
  fileName?: string
  source?: string | Uint8Array
  id?: string
}

export interface ModuleInfo {
  id: string
  meta: Record<string, unknown>
  importedIds: string[]
  isEntry: boolean
}

export interface HtmlTagDescriptor {
  tag: string
  attrs?: Record<string, string | boolean>
  children?: string
  injectTo?: 'head' | 'body'
}

export interface PluginContext {
  resolve(id: string, importer?: string): Promise<ResolvedId | null>
  addWatchFile(id: string): void
  emitFile(file: EmittedFile): string
  getFileName(referenceId: string): string
  getModuleInfo(id: string): ModuleInfo | null
  warn(message: string | { message?: string }): void
  error(message: string | { message?: string }): never
}

export type ObjectHook<T extends (...args: any[]) => any> = {
  handler: T
  filter?: unknown
}

export type Hook<T extends (...args: any[]) => any> = T | ObjectHook<T>

export interface Plugin {
  name: string
  enforce?: 'pre' | 'post'

  /**
   * config 钩子在用户配置刚加载后执行，可以继续合并配置。
   * 官方 Vite 用它让插件参与默认配置生成，例如 Vue 插件追加 resolve.alias。
   */
  config?: (config: UserConfig, env: ConfigEnv) => Awaitable<UserConfig | void>

  /**
   * configResolved 在最终配置确定后执行。此时插件应只读取配置或缓存派生信息，
   * 不再修改配置对象。
   */
  configResolved?: (config: ResolvedConfig) => Awaitable<void>

  configureServer?: (server: ViteDevServer) => Awaitable<void | (() => void)>
  buildStart?: Hook<(this: PluginContext) => Awaitable<void>>
  resolveId?: Hook<(this: PluginContext, id: string, importer?: string) => Awaitable<string | ResolvedId | null | undefined>>
  load?: Hook<(this: PluginContext, id: string) => Awaitable<string | TransformResult | null | undefined>>
  transform?: Hook<(this: PluginContext, code: string, id: string) => Awaitable<string | TransformResult | null | undefined>>
  transformIndexHtml?: (html: string, ctx: { path: string; server?: ViteDevServer }) => Awaitable<string | HtmlTagDescriptor[] | null | undefined>
  /**
   * ssrLoadModule 使用这个钩子把浏览器向的模块代码改写成 Node 可执行代码。
   * 官方 Vite 中这部分会处理 import.meta、动态 import、CJS 互操作和 source map。
   */
  ssrTransform?: (this: PluginContext, code: string, id: string) => Awaitable<string | TransformResult | null | undefined>
  handleHotUpdate?: (ctx: { file: string; server: ViteDevServer; modules: unknown[]; read: () => Promise<string> }) => Awaitable<unknown[] | void>
  closeBundle?: () => Awaitable<void>
}

export type FalsyPlugin = false | null | undefined
export type PluginOption = Plugin | FalsyPlugin | PluginOption[]

export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export async function flattenPlugins(options: PluginOption[] = []): Promise<Plugin[]> {
  const flattened: Plugin[] = []
  for (const option of options) {
    if (!option) continue
    if (Array.isArray(option)) {
      flattened.push(...(await flattenPlugins(option)))
    } else {
      flattened.push(option)
    }
  }
  return flattened
}

export function sortPlugins(plugins: Plugin[]): Plugin[] {
  const pre = plugins.filter((plugin) => plugin.enforce === 'pre')
  const normal = plugins.filter((plugin) => !plugin.enforce)
  const post = plugins.filter((plugin) => plugin.enforce === 'post')
  return [...pre, ...normal, ...post]
}
