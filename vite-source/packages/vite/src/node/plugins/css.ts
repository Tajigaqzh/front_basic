import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Plugin, ResolvedConfig } from '../plugin.js'
import { cleanUrl, isCss, isAssetRequest, pathToUrl, shortHash } from '../utils.js'
import { createSimpleSourcemap } from '../server/sourcemap.js'

export function cssPlugin(): Plugin {
  let resolvedConfig: import('../plugin.js').ResolvedConfig

  return {
    name: 'vite-source:css',
    configResolved(config) {
      resolvedConfig = config
    },
    async load(id) {
      if (!isCss(id)) return null
      const filename = cleanUrl(id)
      const rawCss = fs.readFileSync(filename, 'utf-8')
      const styleId = `vite-source-${shortHash(id)}`
      const isModule = /\.module\.(css|scss|sass|less)$/.test(filename)
      const preprocessed = await preprocessCSS(rawCss, filename, resolvedConfig)
      const rebased = rebaseCssUrls(preprocessed.code, filename, resolvedConfig)
      const postcssResult = await runPostCSS(rebased.code, filename, resolvedConfig)
      const modules = isModule ? compileCssModules(postcssResult.code, filename, resolvedConfig) : null
      const css = modules?.css ?? postcssResult.code
      const map = resolvedConfig.css.devSourcemap
        ? createSimpleSourcemap(filename, postcssResult.code, resolvedConfig.root)
        : null

      /**
       * dev 阶段 CSS 被转换成 JS 模块：浏览器 import CSS 时实际执行这段 JS，
       * 它负责创建/更新 <style> 标签。官方源码会额外支持 CSS Modules、
       * 预处理器、PostCSS、source map 和 HMR 边界。
       *
       * CSS Modules 的关键点是“同一个 CSS 文件有两个产物”：
       * 1. 注入浏览器的 CSS，类名已经作用域化。
       * 2. 给 JS 使用的 tokens 映射，例如 styles.button。
       */
      const lines = [
        `const css = ${JSON.stringify(css)};`,
        `let style = document.querySelector('style[data-vite-source-id="${styleId}"]');`,
        `if (!style) {`,
        `  style = document.createElement('style');`,
        `  style.dataset.viteSourceId = ${JSON.stringify(styleId)};`,
        `  document.head.appendChild(style);`,
        `}`,
        `style.textContent = css;`,
      ]

      if (!modules) {
        lines.push(`export default css;`)
        return { code: lines.join('\n'), map }
      }

      for (const [name, scoped] of Object.entries(modules.tokens)) {
        if (/^[A-Za-z_$][\w$]*$/.test(name)) {
          lines.push(`export const ${name} = ${JSON.stringify(scoped)};`)
        }
      }
      lines.push(`export default ${JSON.stringify(modules.tokens)};`)
      return { code: lines.join('\n'), map }
    },
  }
}

interface CssModulesResult {
  css: string
  tokens: Record<string, string>
}

function compileCssModules(
  css: string,
  filename: string,
  config: import('../plugin.js').ResolvedConfig,
): CssModulesResult {
  const classNames = new Set<string>()
  css.replace(/\.([_a-zA-Z]+[\w-]*)/g, (_full, className: string) => {
    classNames.add(className)
    return ''
  })

  const tokens: Record<string, string> = {}
  let transformed = css

  for (const className of classNames) {
    const scoped = generateScopedName(className, filename, css, config)
    tokens[className] = scoped
    for (const alias of cssModuleAliases(className, config)) {
      tokens[alias] = scoped
    }
    transformed = transformed.replace(new RegExp(`\\.(${escapeRegExp(className)})(?![\\w-])`, 'g'), `.${scoped}`)
  }

  return { css: transformed, tokens }
}

function generateScopedName(
  className: string,
  filename: string,
  css: string,
  config: import('../plugin.js').ResolvedConfig,
): string {
  const option = config.css.modules?.generateScopedName
  if (typeof option === 'function') return option(className, filename, css)
  if (typeof option === 'string') {
    return option
      .replace(/\[local\]/g, className)
      .replace(/\[name\]/g, path.basename(filename, path.extname(filename)))
      .replace(/\[hash\]/g, shortHash(`${filename}:${className}:${css}`))
  }
  return `${className}_${shortHash(`${filename}:${className}`).slice(0, 5)}`
}

function cssModuleAliases(
  className: string,
  config: import('../plugin.js').ResolvedConfig,
): string[] {
  const convention = config.css.modules?.localsConvention ?? 'camelCase'
  if (convention === 'asIs') return []
  const camel = className.replace(/-([a-z])/g, (_full, char: string) => char.toUpperCase())
  if (convention === 'dashes' && camel === className) return []
  return camel === className ? [] : [camel]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function preprocessCSS(
  css: string,
  id: string,
  config: ResolvedConfig,
): Promise<{ code: string; map?: unknown }> {
  const ext = path.extname(id).slice(1) as 'scss' | 'sass' | 'less' | 'styl' | 'stylus' | 'css'
  const options = config.css.preprocessorOptions?.[ext as keyof NonNullable<ResolvedConfig['css']['preprocessorOptions']>]
  const withAdditionalData = `${options?.additionalData ?? ''}${css}`

  /**
   * 官方 css.ts 会根据 lang 调用 Sass/Less/Stylus worker。阅读版现在接入
   * 真实 sass/less 包，保留同样的关键顺序：
   *
   *   preprocessor -> URL rebasing -> PostCSS -> CSS Modules -> JS 注入
   *
   * Stylus 暂时仍保留轻量转换，后续可以继续按官方 worker 方式补。
   */
  if (ext === 'scss' || ext === 'sass') {
    const sass = await import('sass')
    const result = await sass.compileStringAsync(withAdditionalData, {
      ...(withoutAdditionalData(options) as Record<string, unknown>),
      url: pathToFileURL(id),
      loadPaths: [path.dirname(id), ...arrayOption((options as any)?.loadPaths)],
      sourceMap: config.css.devSourcemap,
      syntax: ext === 'sass' ? 'indented' : 'scss',
    } as any)

    return { code: result.css, map: result.sourceMap }
  }

  if (ext === 'less') {
    const less = await import('less')
    const result = await less.default.render(withAdditionalData, {
      ...(withoutAdditionalData(options) as Record<string, unknown>),
      filename: id,
      paths: [path.dirname(id), ...arrayOption((options as any)?.paths)],
      sourceMap: config.css.devSourcemap ? {} : undefined,
    } as any)

    return { code: result.css, map: result.map ? JSON.parse(result.map) : undefined }
  }
  if (ext === 'styl' || ext === 'stylus') {
    return { code: withAdditionalData.replace(/^(\s*)([\w-]+)\s+([^{}\n;]+)$/gm, '$1$2: $3;') }
  }
  return { code: withAdditionalData }
}

function rebaseCssUrls(
  css: string,
  id: string,
  config: ResolvedConfig,
): { code: string } {
  const dir = path.dirname(id)

  /**
   * CSS 里的 url(./foo.png) 是相对于 CSS 文件本身的。浏览器拿到注入后的
   * <style> 时已经不知道这个 CSS 文件路径，所以 Vite 必须在服务端把它
   * 改成根路径资源 URL。官方实现还会处理 srcset、publicDir、build hash。
   */
  return {
    code: css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (full, quote: string, rawUrl: string) => {
      const url = rawUrl.trim()
      if (shouldSkipUrlRebase(url)) return full

      const clean = cleanUrl(url)
      const resolved = path.resolve(dir, clean)
      const rebased = pathToUrl(config.root, resolved)
      const suffix = url.slice(clean.length)
      return `url(${quote}${rebased}${suffix}${quote})`
    }),
  }
}

async function runPostCSS(
  css: string,
  id: string,
  config: ResolvedConfig,
): Promise<{ code: string; map?: unknown }> {
  const postcssOptions = await resolvePostCSSOptions(config)
  if (!postcssOptions.plugins.length) return { code: css }

  /**
   * 官方 Vite 会加载 postcss-load-config 并支持完整 PostCSS 插件对象。
   * 阅读版直接调用 postcss.process，同时兼容之前示例里使用的
   * `{ transform(css, id) {} }` 轻量插件。
   */
  let code = css
  const realPlugins: any[] = []
  for (const plugin of postcssOptions.plugins) {
    if (plugin?.transform && !plugin.postcssPlugin) {
      const transformed = await plugin.transform(code, id)
      if (typeof transformed === 'string') code = transformed
    } else {
      realPlugins.push(plugin)
    }
  }

  if (!realPlugins.length) return { code }

  const postcss = await import('postcss')
  const result = await postcss.default(realPlugins).process(code, {
    from: id,
    map: config.css.devSourcemap ? { inline: false, annotation: false } : false,
    ...postcssOptions.options,
  })
  return { code: result.css, map: result.map?.toJSON() }
}

async function resolvePostCSSOptions(
  config: ResolvedConfig,
): Promise<{ plugins: any[]; options: Record<string, unknown> }> {
  const inline = config.css.postcss
  if (inline && typeof inline !== 'string') {
    return {
      plugins: inline.plugins ?? [],
      options: omit(inline as Record<string, unknown>, ['plugins']),
    }
  }

  const configPath = typeof inline === 'string'
    ? path.resolve(config.root, inline)
    : findPostCSSConfig(config.root)
  if (!configPath) return { plugins: [], options: {} }

  const imported = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)
  const loaded = imported.default ?? imported
  return {
    plugins: loaded.plugins ?? [],
    options: omit(loaded, ['plugins']),
  }
}

function findPostCSSConfig(root: string): string | null {
  const names = [
    'postcss.config.js',
    'postcss.config.mjs',
    'postcss.config.cjs',
    '.postcssrc.js',
    '.postcssrc.mjs',
    '.postcssrc.cjs',
  ]
  for (const name of names) {
    const file = path.join(root, name)
    if (fs.existsSync(file)) return file
  }
  return null
}

function shouldSkipUrlRebase(url: string): boolean {
  return (
    !url ||
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('data:') ||
    /^[a-zA-Z][\w+.-]*:/.test(url) ||
    !isAssetRequest(url)
  )
}

function withoutAdditionalData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  return omit(value as Record<string, unknown>, ['additionalData'])
}

function omit(object: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(object)) {
    if (!keys.includes(key) && value !== undefined) result[key] = value
  }
  return result
}

function arrayOption(value: unknown): string[] {
  if (!value) return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}
