import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * 阅读定位：
 * config.ts 是 Vite 所有入口的第一层“归一化器”。CLI、JS API、dev、build
 * 最终都会走到 resolveConfig。阅读时要关注三件事：
 * 1. 用户配置和命令行参数如何合并成 ResolvedConfig。
 * 2. 插件 config/configResolved 钩子在配置生命周期中的位置。
 * 3. resolve/server/build/css/optimizer 等默认值在哪里形成。
 */
import { DEFAULT_CONFIG_FILES, DEFAULT_DEV_PORT, DEFAULT_PREVIEW_PORT } from './constants.js'
import { createLogger } from './logger.js'
import {
  type ConfigEnv,
  type InlineConfig,
  type ResolvedConfig,
  type UserConfig,
  type UserConfigExport,
  defineConfig,
  flattenPlugins,
  sortPlugins,
} from './plugin.js'
import { resolvePlugins } from './plugins/index.js'
import { mergeConfig } from './utils.js'

export { defineConfig }
export type { InlineConfig, ResolvedConfig, UserConfig, ConfigEnv }

/**
 * resolveConfig 是 Vite 所有入口的共同前置步骤。
 *
 * 参数 inlineConfig 来自 CLI 或 JS API，例如 createServer({ root, server })。
 * 参数 command 表示当前命令是 dev server 的 serve，还是生产构建的 build。
 * 参数 defaultMode 是没有传 mode 时使用的模式；官方 Vite 中 serve 默认
 * development，build 默认 production。
 */
export async function resolveConfig(
  inlineConfig: InlineConfig = {},
  command: 'serve' | 'build',
  defaultMode = command === 'serve' ? 'development' : 'production',
): Promise<ResolvedConfig> {
  const mode = inlineConfig.mode ?? defaultMode
  const root = path.resolve(inlineConfig.root ?? process.cwd())
  const env: ConfigEnv = { command, mode }

  const configFileResult = await loadConfigFromFile(root, inlineConfig.configFile, env)
  let userConfig = configFileResult?.config ?? {}

  userConfig = mergeConfig(userConfig, inlineConfig)
  const logger = createLogger(userConfig.logLevel)

  let userPlugins = sortPlugins(await flattenPlugins(userConfig.plugins))

  /**
   * 插件 config 钩子可以返回额外配置。官方实现会在排序、环境变量、
   * alias、build/server 默认值之间做更多细分；这里保留关键点：
   * “用户配置加载完成后，插件还有一次参与配置合并的机会”。
   */
  for (const plugin of userPlugins) {
    const extraConfig = await plugin.config?.(userConfig, env)
    if (extraConfig) {
      userConfig = mergeConfig(userConfig, extraConfig)
    }
  }

  userPlugins = sortPlugins(await flattenPlugins(userConfig.plugins))

  const resolved: ResolvedConfig = {
    command,
    mode,
    root,
    base: normalizeBase(userConfig.base ?? '/'),
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      ...(command === 'build' ? { 'import.meta.hot': 'undefined' } : {}),
      ...userConfig.define,
    },
    env: {
      MODE: mode,
      DEV: String(command === 'serve'),
      PROD: String(command === 'build'),
    },
    isProduction: command === 'build' || mode === 'production',
    configFile: configFileResult?.path,
    logLevel: userConfig.logLevel ?? 'info',
    plugins: [],
    server: {
      port: userConfig.server?.port ?? DEFAULT_DEV_PORT,
      strictPort: userConfig.server?.strictPort ?? false,
      host: userConfig.server?.host,
      open: userConfig.server?.open,
      hmr: userConfig.server?.hmr ?? true,
      origin: userConfig.server?.origin,
      cors: userConfig.server?.cors ?? true,
      allowedHosts: userConfig.server?.allowedHosts ?? [],
      proxy: userConfig.server?.proxy ?? {},
    },
    build: {
      outDir: userConfig.build?.outDir ?? 'dist',
      emptyOutDir: userConfig.build?.emptyOutDir ?? true,
      minify: userConfig.build?.minify ?? false,
      sourcemap: userConfig.build?.sourcemap ?? false,
      watch: userConfig.build?.watch,
      rollupOptions: userConfig.build?.rollupOptions,
    },
    preview: {
      port: userConfig.preview?.port ?? DEFAULT_PREVIEW_PORT,
      strictPort: userConfig.preview?.strictPort ?? false,
      outDir: userConfig.preview?.outDir ?? userConfig.build?.outDir ?? 'dist',
      host: userConfig.preview?.host,
      open: userConfig.preview?.open,
    },
    resolve: {
      alias: userConfig.resolve?.alias ?? {},
      extensions: userConfig.resolve?.extensions ?? ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.css', '.vue'],
      mainFields: userConfig.resolve?.mainFields ?? ['browser', 'module', 'jsnext:main', 'jsnext', 'main'],
      conditions: userConfig.resolve?.conditions ?? ['browser', 'module', 'import', 'default'],
      preserveSymlinks: userConfig.resolve?.preserveSymlinks ?? false,
      dedupe: userConfig.resolve?.dedupe ?? [],
    },
    optimizeDeps: {
      entries: userConfig.optimizeDeps?.entries ?? [],
      include: userConfig.optimizeDeps?.include ?? [],
      exclude: userConfig.optimizeDeps?.exclude ?? [],
      force: userConfig.optimizeDeps?.force ?? false,
    },
    ssr: {
      external: userConfig.ssr?.external ?? [],
      noExternal: userConfig.ssr?.noExternal ?? false,
    },
    css: {
      modules: userConfig.css?.modules,
      preprocessorOptions: userConfig.css?.preprocessorOptions,
      postcss: userConfig.css?.postcss,
      devSourcemap: userConfig.css?.devSourcemap ?? false,
    },
    esbuild: userConfig.esbuild ?? {},
    packageCache: new Map(),
    logger,
  }

  resolved.plugins = sortPlugins([...resolvePlugins(resolved), ...userPlugins])

  for (const plugin of resolved.plugins) {
    await plugin.configResolved?.(resolved)
  }

  logger.info(`[config] root=${resolved.root}`)
  logger.info(`[config] mode=${resolved.mode}, command=${resolved.command}`)
  return resolved
}

async function loadConfigFromFile(
  root: string,
  configFile: string | false | undefined,
  env: ConfigEnv,
): Promise<{ path: string; config: UserConfig } | null> {
  if (configFile === false) return null

  const candidates = configFile
    ? [path.resolve(root, configFile)]
    : DEFAULT_CONFIG_FILES.map((file) => path.resolve(root, file))

  const configPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!configPath) return null

  /**
   * 官方 Vite 默认会先 bundle 配置文件，以便支持 TS、ESM/CJS 混用和依赖。
   * 这个阅读版只使用 Node 原生动态 import。若 vite.config.ts 无法被当前
   * Node 直接执行，可以改成 vite.config.mjs，或者把重点放在流程阅读上。
   */
  const imported = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)
  const raw: UserConfigExport = imported.default ?? imported
  const config = typeof raw === 'function' ? await raw(env) : await raw

  return { path: configPath, config }
}

function normalizeBase(base: string): string {
  if (base === '') return '/'
  return base.startsWith('/') ? base : `/${base}`
}
