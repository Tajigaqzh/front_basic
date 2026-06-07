import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from '../plugin.js'
import { cleanUrl, isJsLike, isVueRequest, slash } from '../utils.js'

interface ImportGlobOptions {
  eager?: boolean
  import?: string
  query?: string | Record<string, string | number | boolean>
}

interface ParsedGlobCall {
  start: number
  end: number
  patterns: string[]
  options: ImportGlobOptions
}

/**
 * 对齐官方 plugins/importMetaGlob.ts。
 *
 * 官方实现使用 AST、tinyglobby、MagicString，并支持热更新时根据 glob
 * 重新失效 importer。阅读版先保留日常最核心的转换：
 *
 *   import.meta.glob('./pages/*.js')
 *   -> { './pages/a.js': () => import('./pages/a.js') }
 *
 *   import.meta.glob('./pages/*.js', { eager: true })
 *   -> import * as __vite_glob_0_0 from './pages/a.js'
 *      { './pages/a.js': __vite_glob_0_0 }
 */
export function importGlobPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:import-glob',
    transform(code, id) {
      if (!code.includes('import.meta.glob') || (!isJsLike(id) && !isVueRequest(id))) {
        return null
      }

      const calls = parseImportGlobCalls(code)
      if (!calls.length) return null

      let transformed = code
      const staticImports: string[] = []

      for (let index = calls.length - 1; index >= 0; index--) {
        const call = calls[index]
        const replacement = renderGlobReplacement(config, cleanUrl(id), call, index, staticImports)
        transformed = `${transformed.slice(0, call.start)}${replacement}${transformed.slice(call.end)}`
      }

      return `${staticImports.join('\n')}${staticImports.length ? '\n' : ''}${transformed}`
    },
  }
}

function parseImportGlobCalls(code: string): ParsedGlobCall[] {
  const calls: ParsedGlobCall[] = []
  const re = /\bimport\.meta\.glob(?:<[^>]+>)?\s*\(/g
  let match: RegExpExecArray | null

  while ((match = re.exec(code))) {
    const openIndex = code.indexOf('(', match.index)
    const closeIndex = findMatchingParen(code, openIndex)
    if (closeIndex === -1) continue

    const args = splitTopLevelArgs(code.slice(openIndex + 1, closeIndex))
    const patterns = parseGlobPatterns(args[0])
    if (!patterns.length) continue

    calls.push({
      start: match.index,
      end: closeIndex + 1,
      patterns,
      options: parseGlobOptions(args[1]),
    })
  }

  return calls
}

function renderGlobReplacement(
  config: ResolvedConfig,
  importer: string,
  call: ParsedGlobCall,
  callIndex: number,
  staticImports: string[],
): string {
  const entries = resolveGlobEntries(config.root, importer, call.patterns)
  const pairs: string[] = []

  entries.forEach((entry, entryIndex) => {
    const specifier = withQuery(entry.specifier, call.options.query)
    const key = JSON.stringify(entry.key)

    if (call.options.eager) {
      const identifier = `__vite_glob_${callIndex}_${entryIndex}`
      const importName = call.options.import
      if (!importName || importName === '*') {
        staticImports.push(`import * as ${identifier} from ${JSON.stringify(specifier)};`)
      } else if (importName === 'default') {
        staticImports.push(`import ${identifier} from ${JSON.stringify(specifier)};`)
      } else {
        staticImports.push(`import { ${importName} as ${identifier} } from ${JSON.stringify(specifier)};`)
      }
      pairs.push(`${key}: ${identifier}`)
      return
    }

    const loader = `() => import(${JSON.stringify(specifier)})`
    if (!call.options.import || call.options.import === '*') {
      pairs.push(`${key}: ${loader}`)
    } else if (call.options.import === 'default') {
      pairs.push(`${key}: () => import(${JSON.stringify(specifier)}).then((m) => m.default)`)
    } else {
      pairs.push(`${key}: () => import(${JSON.stringify(specifier)}).then((m) => m[${JSON.stringify(call.options.import)}])`)
    }
  })

  return `({ ${pairs.join(', ')} })`
}

function resolveGlobEntries(
  root: string,
  importer: string,
  patterns: string[],
): Array<{ key: string; specifier: string }> {
  const affirmed = patterns.filter((pattern) => !pattern.startsWith('!'))
  const negated = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1))
  const files = new Map<string, { key: string; specifier: string }>()

  for (const pattern of affirmed) {
    const absolutePattern = resolvePattern(importer, root, pattern)
    const baseDir = getGlobBase(absolutePattern)
    const matcher = globToRegExp(slash(absolutePattern))

    for (const file of walkFiles(baseDir)) {
      const normalized = slash(file)
      if (!matcher.test(normalized)) continue
      if (negated.some((item) => globToRegExp(slash(resolvePattern(importer, root, item))).test(normalized))) {
        continue
      }
      const specifier = pattern.startsWith('/')
        ? slash(path.relative(root, file)).replace(/^/, '/')
        : toRelativeSpecifier(path.dirname(importer), file)
      const key = pattern.startsWith('/') ? specifier : toRelativeSpecifier(path.dirname(importer), file)
      files.set(normalized, { key, specifier })
    }
  }

  return [...files.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function parseGlobPatterns(raw: string | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return splitTopLevelArgs(trimmed.slice(1, -1)).map(readStringLiteral).filter(Boolean) as string[]
  }
  const value = readStringLiteral(trimmed)
  return value ? [value] : []
}

function parseGlobOptions(raw: string | undefined): ImportGlobOptions {
  if (!raw) return {}
  const options: ImportGlobOptions = {}
  if (/\beager\s*:\s*true\b/.test(raw)) options.eager = true
  const importMatch = /\bimport\s*:\s*(['"])([^'"]+)\1/.exec(raw)
  if (importMatch) options.import = importMatch[2]
  const queryStringMatch = /\bquery\s*:\s*(['"])([^'"]+)\1/.exec(raw)
  if (queryStringMatch) options.query = queryStringMatch[2]
  return options
}

function withQuery(specifier: string, query: ImportGlobOptions['query']): string {
  if (!query) return specifier
  if (typeof query === 'string') return `${specifier}${query.startsWith('?') ? query : `?${query}`}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) params.set(key, String(value))
  const text = params.toString()
  return text ? `${specifier}?${text}` : specifier
}

function readStringLiteral(value: string): string | null {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) return null
  return trimmed.slice(1, -1)
}

function findMatchingParen(code: string, openIndex: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = openIndex; i < code.length; i++) {
    const char = code[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function splitTopLevelArgs(raw: string): string[] {
  const args: string[] = []
  let start = 0
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '[' || char === '{' || char === '(') depth++
    else if (char === ']' || char === '}' || char === ')') depth--
    else if (char === ',' && depth === 0) {
      args.push(raw.slice(start, i).trim())
      start = i + 1
    }
  }
  args.push(raw.slice(start).trim())
  return args.filter(Boolean)
}

function resolvePattern(importer: string, root: string, pattern: string): string {
  if (pattern.startsWith('/')) return path.resolve(root, pattern.slice(1))
  return path.resolve(path.dirname(importer), pattern)
}

function getGlobBase(pattern: string): string {
  const normalized = slash(pattern)
  const globIndex = normalized.search(/[*?[\]{}]/)
  if (globIndex === -1) return path.dirname(pattern)
  const prefix = normalized.slice(0, globIndex)
  return prefix.endsWith('/') ? prefix.slice(0, -1) : path.dirname(prefix)
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const result: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') result.push(...walkFiles(file))
    } else if (entry.isFile()) {
      result.push(file)
    }
  }
  return result
}

function globToRegExp(pattern: string): RegExp {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*'
        i++
      } else {
        source += '[^/]*'
      }
    } else {
      source += escapeRegExp(char)
    }
  }
  return new RegExp(`^${source}$`)
}

function toRelativeSpecifier(fromDir: string, file: string): string {
  const relative = slash(path.relative(fromDir, file))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}
