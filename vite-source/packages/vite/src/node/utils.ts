import path from 'node:path'
import { createHash } from 'node:crypto'

export type Awaitable<T> = T | Promise<T>

export function slash(id: string): string {
  return id.replace(/\\/g, '/')
}

export function normalizePath(id: string): string {
  return slash(path.normalize(id))
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function arraify<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function cleanUrl(url: string): string {
  return url.split('?')[0].split('#')[0]
}

export function removeTimestampQuery(url: string): string {
  return url.replace(/[?&]t=\d+/, '')
}

export function isBareImport(id: string): boolean {
  return !id.startsWith('\0') && !id.startsWith('.') && !id.startsWith('/') && !id.includes(':')
}

export function isJsLike(id: string): boolean {
  return /\.(mjs|js|mts|ts|jsx|tsx)$/.test(cleanUrl(id))
}

export function isCss(id: string): boolean {
  return /\.(css|scss|sass|less)$/.test(cleanUrl(id))
}

export const isCSSRequest = isCss

export function isJson(id: string): boolean {
  return /\.json$/.test(cleanUrl(id))
}

export function isVueRequest(id: string): boolean {
  return /\.vue$/.test(cleanUrl(id))
}

export function isAssetRequest(id: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)$/.test(cleanUrl(id))
}

export function isExplicitImportRequest(id: string): boolean {
  return /[?&]import(?:&|$)/.test(id)
}

export function pathToUrl(root: string, file: string): string {
  const relative = slash(path.relative(root, file))
  if (relative.startsWith('..')) return `/@fs/${slash(file)}`
  return relative.startsWith('.') ? `/${relative}` : `/${relative}`
}

export function urlToFile(root: string, url: string): string {
  return path.resolve(root, cleanUrl(url).replace(/^\//, ''))
}

export function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8)
}

export function mergeConfig<T extends Record<string, any>, U extends Record<string, any>>(
  defaults: T,
  override: U,
): T & U {
  const merged: Record<string, any> = { ...defaults }
  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(merged[key])) {
      merged[key] = mergeConfig(merged[key], value)
    } else if (value !== undefined) {
      merged[key] = value
    }
  }
  return merged as T & U
}

export function parseImports(code: string): string[] {
  const imports = new Set<string>()
  const patterns = [
    /import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code))) {
      imports.add(match[1])
    }
  }

  return [...imports]
}

export async function asyncReplace(
  code: string,
  pattern: RegExp,
  replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
  const pieces: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(code))) {
    pieces.push(code.slice(lastIndex, match.index))
    pieces.push(await replacer(match))
    lastIndex = match.index + match[0].length
  }

  pieces.push(code.slice(lastIndex))
  return pieces.join('')
}

/**
 * 官方 Vite 从 @rollup/pluginutils 暴露 createFilter。很多框架插件会使用它
 * 判断当前 id 是否需要处理。阅读版实现 glob 的完整度有限，但支持官方
 * plugin-vue 最常用的 RegExp、字符串和数组输入。
 */
export function createFilter(
  include?: string | RegExp | Array<string | RegExp>,
  exclude?: string | RegExp | Array<string | RegExp>,
): (id: string) => boolean {
  const includes = arraify(include)
  const excludes = arraify(exclude)
  return (id) => {
    if (excludes.some((pattern) => matchesFilterPattern(pattern, id))) return false
    return includes.length === 0 || includes.some((pattern) => matchesFilterPattern(pattern, id))
  }
}

export async function transformWithEsbuild(code: string): Promise<{ code: string; map: null }> {
  return { code, map: null }
}

export async function formatPostcssSourceMap(map: unknown): Promise<unknown> {
  return map
}

function matchesFilterPattern(pattern: string | RegExp, id: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(id)
  return id.includes(pattern)
}
