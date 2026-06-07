import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'

/**
 * 阅读定位：
 * resolve.ts 决定“一个 import specifier 最终指向哪里”。它连接 alias、
 * 相对路径、/@id、/@fs、node_modules、package exports/imports、browser field。
 * importAnalysis、optimizer、SSR 和 build 都会依赖这套解析规则保持一致。
 */
import type { Plugin, ResolvedConfig } from '../plugin.js'
import { cleanUrl, isBareImport, normalizePath, pathToUrl } from '../utils.js'
import type { PackageData } from '../packages.js'
import { findNearestMainPackageData, findNearestPackageData, resolvePackageData } from '../packages.js'

export const browserExternalId = '__vite-browser-external'
export const optionalPeerDepId = '__vite-optional-peer-dep'

export interface InternalResolveOptions {
  config: ResolvedConfig
  isRequire?: boolean
  tryIndex?: boolean
  preferRelative?: boolean
}

export type ResolveResult = {
  id: string
  external?: boolean
  meta?: Record<string, unknown>
} | null

export function resolvePlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:resolve',
    enforce: 'pre',
    resolveId(id, importer) {
      return tryNodeResolve(id, importer, { config, tryIndex: true })
    },
    load(id) {
      if (id === browserExternalId || id.startsWith(`${browserExternalId}:`)) {
        /**
         * package.json 的 browser 字段允许把某个 Node-only 文件映射成 false。
         * 官方 Vite 会返回一个特殊的 browser external 模块；这里返回空对象，
         * 让浏览器端 import 不会因为找不到 fs/path 等 Node 文件而直接崩掉。
         */
        return 'export default {}; export const __esModule = true;'
      }
      if (id.startsWith(`${optionalPeerDepId}:`)) {
        const [, dep, parent] = id.split(':')
        return [
          `throw new Error(${JSON.stringify(`Could not resolve optional peer dependency "${dep}" imported by "${parent}".`)});`,
          `export default {};`,
        ].join('\n')
      }
      if (isBareImport(id)) {
        return `export default await import(${JSON.stringify(id)})`
      }
      return null
    },
  }
}

export function tryNodeResolve(
  id: string,
  importer: string | undefined,
  options: InternalResolveOptions,
): ResolveResult {
  const { config } = options
  const aliased = applyAlias(id, config.resolve.alias)

  if (aliased === browserExternalId || aliased.startsWith(`${browserExternalId}:`)) return { id: aliased }
  if (isNodeBuiltin(aliased)) return { id: `${browserExternalId}:${aliased}` }
  if (aliased.startsWith('\0')) return { id: aliased }
  if (aliased.startsWith('/@vite/')) return { id: aliased }
  if (aliased.startsWith('/@id/')) {
    const raw = aliased.slice('/@id/'.length)
    const queryIndex = raw.indexOf('?')
    const bare = decodeURIComponent(queryIndex === -1 ? raw : raw.slice(0, queryIndex))
    const params = new URLSearchParams(queryIndex === -1 ? '' : raw.slice(queryIndex + 1))
    const requestImporter = params.get('importer')
    return tryNodeResolve(bare, requestImporter ? decodeURIComponent(requestImporter) : importer, options)
  }
  if (aliased.startsWith('/@fs/')) return tryFsResolve(aliased.slice('/@fs/'.length), options)

  if (aliased.startsWith('#')) {
    return resolvePackageImports(aliased, importer, options)
  }

  if (aliased.startsWith('/')) {
    return tryFsResolve(path.resolve(config.root, aliased.replace(/^\//, '')), options)
  }

  if (aliased.startsWith('.') || options.preferRelative) {
    const base = importer ? path.dirname(cleanUrl(importer)) : config.root
    const browserMapped = resolveBrowserMapping(path.resolve(base, aliased), importer, options)
    if (browserMapped) return browserMapped
    const resolved = tryFsResolve(path.resolve(base, aliased), options)
    if (resolved || aliased.startsWith('.')) return resolved
  }

  if (isBareImport(aliased)) {
    const resolved = resolvePackageEntry(aliased, importer, options)
    if (resolved) return resolved
    return { id: aliased, external: true, meta: { reason: 'unresolved-bare-import' } }
  }

  return null
}

export function tryFsResolve(file: string, options: InternalResolveOptions): ResolveResult {
  const clean = cleanUrl(file)
  const postfix = file.slice(clean.length)
  for (const ext of ['', ...options.config.resolve.extensions]) {
    const candidate = normalizePath(`${clean}${ext}`)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const resolved = options.config.resolve.preserveSymlinks
        ? candidate
        : normalizePath(fs.realpathSync(candidate))
      return {
        id: `${resolved}${postfix}`,
      }
    }
  }

  if (options.tryIndex !== false && fs.existsSync(clean) && fs.statSync(clean).isDirectory()) {
    return tryDirectoryResolve(clean, options)
  }

  return null
}

export function resolvePackageEntry(
  id: string,
  importer: string | undefined,
  options: InternalResolveOptions,
): ResolveResult {
  const { config } = options
  const { packageName, subpath } = parsePackageSpecifier(id)
  const basedir = getPackageResolveBase(packageName, importer, options)
  const pkg = findSelfPackageData(packageName, basedir, options) ?? resolvePackageData(
    packageName,
    basedir,
    config.resolve.preserveSymlinks,
    config.packageCache,
  )
  if (!pkg) return resolveOptionalPeerDep(packageName, basedir, options)

  const optionsKey = getResolveOptionsKey(options)
  const cached = pkg.getResolvedCache(subpath, optionsKey)
  if (cached) return { id: cached, meta: packageMeta(pkg) }

  const target = resolvePackageTarget(pkg, subpath, options)
  if (!target) return null
  if (target === browserExternalId) return { id: browserExternalId, meta: packageMeta(pkg) }

  const tryIndex = !pkg.data.exports || subpath === '.'
  const resolved = tryFsResolve(target, { ...options, tryIndex })
  if (resolved) pkg.setResolvedCache(subpath, resolved.id, optionsKey)
  return resolved ? { ...resolved, meta: packageMeta(pkg) } : null
}

function tryDirectoryResolve(dir: string, options: InternalResolveOptions): ResolveResult {
  const packageJson = path.join(dir, 'package.json')
  if (fs.existsSync(packageJson)) {
    const pkg: PackageData = {
      dir,
      data: JSON.parse(fs.readFileSync(packageJson, 'utf-8')) as Record<string, any>,
      hasSideEffects: () => null,
      setResolvedCache() {},
      getResolvedCache() {
        return undefined
      },
    }
    const entry = resolvePackageTarget(pkg, '.', options)
    if (entry) {
      const resolved: ResolveResult = tryFsResolve(entry, { ...options, tryIndex: false })
      if (resolved) return resolved
    }
  }

  for (const ext of options.config.resolve.extensions) {
    const indexFile = path.join(dir, `index${ext}`)
    const resolved: ResolveResult = tryFsResolve(indexFile, { ...options, tryIndex: false })
    if (resolved) return resolved
  }

  return null
}

function resolvePackageTarget(
  pkg: PackageData,
  subpath: string,
  options: InternalResolveOptions,
): string | null {
  const exported = resolveExportsOrImports(pkg.data.exports, subpath, getConditions(options))
  if (exported === false) return null
  if (exported) return normalizePackageTarget(pkg.dir, exported)

  if (pkg.data.exports && subpath !== '.') return null

  if (subpath !== '.') {
    const mapped = resolveBrowserField(subpath, pkg, options)
    if (mapped === false) return browserExternalId
    return path.join(pkg.dir, mapped ?? subpath)
  }

  for (const field of options.config.resolve.mainFields) {
    const value = pkg.data[field]
    if (field === 'browser' && value && typeof value === 'object') {
      const mapped = value['.'] ?? mapWithBrowserField('.', value)
      if (mapped === false) return browserExternalId
      if (typeof mapped === 'string') return normalizePackageTarget(pkg.dir, mapped)
      continue
    }
    if (typeof value === 'string') return path.join(pkg.dir, value)
  }

  if (typeof pkg.data.main === 'string') return path.join(pkg.dir, pkg.data.main)

  for (const fallback of ['index.js', 'index.json', 'index.node']) {
    const resolved = tryFsResolve(path.join(pkg.dir, fallback), options)
    if (resolved) return resolved.id
  }

  return null
}

export function resolveExportsOrImports(
  field: unknown,
  subpath: string,
  conditions: string[],
): string | false | null {
  if (typeof field === 'string' && subpath === '.') return field
  if (Array.isArray(field) && subpath === '.') return pickConditionalTarget(field, conditions)
  if (!field || typeof field !== 'object') return null

  const object = field as Record<string, unknown>
  const key = normalizeSubpathKey(subpath)

  if (isConditionalExportsObject(object) && subpath === '.') {
    return pickConditionalTarget(object, conditions)
  }

  if (Object.hasOwn(object, key)) {
    return pickConditionalTarget(object[key], conditions)
  }

  return resolvePatternTarget(object, key, conditions)
}

function pickConditionalTarget(target: unknown, conditions: string[]): string | false | null {
  if (typeof target === 'string') return target
  if (target === false || target === null) return false
  if (Array.isArray(target)) {
    for (const item of target) {
      const picked = pickConditionalTarget(item, conditions)
      if (picked !== null) return picked
    }
  }
  if (target && typeof target === 'object') {
    const object = target as Record<string, unknown>
    const enabled = new Set(conditions)
    /**
     * Node 的 conditional exports 语义是“按 package.json 里对象键的顺序”
     * 匹配条件，而不是按 Vite conditions 数组顺序。这个细节会影响
     * `{ browser, development, import, default }` 同时存在时选中哪个入口。
     */
    for (const [condition, value] of Object.entries(object)) {
      if (condition === 'default' || enabled.has(condition)) {
        const picked = pickConditionalTarget(value, conditions)
        if (picked !== null) return picked
      }
    }
  }
  return null
}

function resolvePackageImports(
  id: string,
  importer: string | undefined,
  options: InternalResolveOptions,
): ResolveResult {
  if (!importer) return null

  const basedir = path.dirname(cleanUrl(importer))
  const pkg = findNearestPackageData(basedir, options.config.packageCache)
  if (!pkg?.data.imports) return null

  const { file, postfix } = splitPackageImportsId(id)
  const target = resolveExportsOrImports(pkg.data.imports, file, getConditions(options))
  if (target === false) return null
  if (!target) return null

  /**
   * imports target 既可以是包内相对路径，也可以继续指向另一个裸包。
   * 相对路径按当前 package.json 所在目录解析，裸包则回到完整 Node resolve。
   */
  if (target.startsWith('.')) {
    return tryFsResolve(path.join(pkg.dir, `${target}${postfix}`), options)
  }
  return tryNodeResolve(`${target}${postfix}`, importer, options)
}

function resolveBrowserMapping(
  file: string,
  importer: string | undefined,
  options: InternalResolveOptions,
): ResolveResult {
  if (!importer || !options.config.resolve.mainFields.includes('browser')) return null

  const importerFile = cleanUrl(importer)
  const pkg = findNearestPackageData(path.dirname(importerFile), options.config.packageCache)
  const browser = pkg?.data.browser
  if (!pkg || !browser || typeof browser !== 'object') return null

  const normalizedFile = normalizePath(cleanUrl(file))
  const normalizedPkgDir = normalizePath(pkg.dir)
  if (!normalizedFile.startsWith(`${normalizedPkgDir}/`)) return null

  const { file: fileWithoutPostfix, postfix } = splitFileAndPostfix(normalizedFile)
  const relative = `./${normalizePath(path.relative(pkg.dir, fileWithoutPostfix))}`
  const mapped = mapWithBrowserField(relative, browser)
  if (mapped === false) return { id: browserExternalId }
  if (typeof mapped !== 'string') return null

  return tryFsResolve(path.join(pkg.dir, `${mapped}${postfix}`), options)
}

function resolveBrowserField(
  subpath: string,
  pkg: PackageData,
  options: InternalResolveOptions,
): string | false | null {
  if (!options.config.resolve.mainFields.includes('browser')) return null
  const browser = pkg.data.browser
  if (!browser || typeof browser !== 'object') return null
  return mapWithBrowserField(normalizeSubpathKey(subpath), browser) ?? null
}

function mapWithBrowserField(
  relativePathInPkgDir: string,
  map: Record<string, string | false>,
): string | false | undefined {
  const normalizedPath = path.posix.normalize(relativePathInPkgDir)

  for (const key of Object.keys(map)) {
    const normalizedKey = path.posix.normalize(key)
    if (
      normalizedPath === normalizedKey ||
      equalWithoutSuffix(normalizedPath, normalizedKey, '.js') ||
      equalWithoutSuffix(normalizedPath, normalizedKey, '/index.js')
    ) {
      return map[key]
    }
  }
}

function resolvePatternTarget(
  object: Record<string, unknown>,
  key: string,
  conditions: string[],
): string | false | null {
  const matches = Object.keys(object)
    .filter((pattern) => pattern.includes('*') && patternMatch(pattern, key))
    .sort((a, b) => patternSpecificity(b) - patternSpecificity(a))

  for (const pattern of matches) {
    const target = pickConditionalTarget(object[pattern], conditions)
    if (target === false) return false
    if (typeof target === 'string') {
      return target.replace('*', patternCapture(pattern, key))
    }
  }

  return null
}

function getConditions(options: InternalResolveOptions): string[] {
  const configured = options.config.resolve.conditions
  return [
    ...configured,
    options.config.isProduction ? 'production' : 'development',
    options.isRequire ? 'require' : 'import',
    'default',
  ]
}

function getPackageResolveBase(
  packageName: string,
  importer: string | undefined,
  options: InternalResolveOptions,
): string {
  if (options.config.resolve.dedupe.includes(packageName)) return options.config.root
  return importer ? path.dirname(cleanUrl(importer)) : options.config.root
}

function findSelfPackageData(
  packageName: string,
  basedir: string,
  options: InternalResolveOptions,
): PackageData | null {
  const self = findNearestPackageData(basedir, options.config.packageCache)
  return self?.data.name === packageName && self.data.exports ? self : null
}

function resolveOptionalPeerDep(
  packageName: string,
  basedir: string,
  options: InternalResolveOptions,
): ResolveResult {
  const parent = findNearestMainPackageData(basedir, options.config.packageCache)
  if (
    parent?.data.peerDependencies?.[packageName] &&
    parent.data.peerDependenciesMeta?.[packageName]?.optional
  ) {
    return {
      id: `${optionalPeerDepId}:${packageName}:${parent.data.name ?? parent.dir}`,
      meta: { optionalPeerDep: true },
    }
  }
  return null
}

function isNodeBuiltin(id: string): boolean {
  const bare = id.replace(/^node:/, '')
  return builtinModules.includes(bare) || builtinModules.includes(`node:${bare}`)
}

function normalizePackageTarget(pkgDir: string, target: string): string {
  if (target.startsWith('./') || target === '.') return path.join(pkgDir, target)
  return path.join(pkgDir, target)
}

function normalizeSubpathKey(subpath: string): string {
  if (subpath === '.') return '.'
  if (subpath.startsWith('#')) return subpath
  return subpath.startsWith('./') ? subpath : `./${subpath}`
}

function splitFileAndPostfix(id: string): { file: string; postfix: string } {
  const query = id.search(/[?#]/)
  return query === -1
    ? { file: id, postfix: '' }
    : { file: id.slice(0, query), postfix: id.slice(query) }
}

function splitPackageImportsId(id: string): { file: string; postfix: string } {
  const query = id.indexOf('?')
  return query === -1
    ? { file: id, postfix: '' }
    : { file: id.slice(0, query), postfix: id.slice(query) }
}

function isConditionalExportsObject(object: Record<string, unknown>): boolean {
  return Object.keys(object).every((key) => key === 'default' || !key.startsWith('.'))
}

function patternMatch(pattern: string, key: string): boolean {
  const [prefix, suffix] = pattern.split('*')
  return key.startsWith(prefix) && key.endsWith(suffix)
}

function patternCapture(pattern: string, key: string): string {
  const [prefix, suffix] = pattern.split('*')
  return key.slice(prefix.length, suffix ? -suffix.length : undefined)
}

function patternSpecificity(pattern: string): number {
  return pattern.replace('*', '').length
}

function equalWithoutSuffix(file: string, key: string, suffix: string): boolean {
  return key.endsWith(suffix) && key.slice(0, -suffix.length) === file
}

function getResolveOptionsKey(options: InternalResolveOptions): string {
  const { config } = options
  return [
    options.isRequire ? 'require' : 'import',
    config.isProduction ? 'production' : 'development',
    config.resolve.conditions.join(','),
    config.resolve.mainFields.join(','),
    config.resolve.extensions.join(','),
  ].join('|')
}

function applyAlias(id: string, alias: ResolvedConfig['resolve']['alias']): string {
  const entries = Array.isArray(alias)
    ? alias
    : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))

  for (const entry of entries) {
    if (typeof entry.find === 'string') {
      if (id === entry.find || id.startsWith(`${entry.find}/`)) {
        return `${entry.replacement}${id.slice(entry.find.length)}`
      }
    } else if (entry.find.test(id)) {
      return id.replace(entry.find, entry.replacement)
    }
  }

  return id
}

function parsePackageSpecifier(id: string): { packageName: string; subpath: string } {
  const parts = id.split('/')
  if (id.startsWith('@')) {
    return {
      packageName: `${parts[0]}/${parts[1]}`,
      subpath: parts.slice(2).join('/') || '.',
    }
  }
  return { packageName: parts[0], subpath: parts.slice(1).join('/') || '.' }
}

function packageMeta(pkg: PackageData): Record<string, unknown> {
  return {
    packageName: pkg.data.name,
    packageDir: pkg.dir,
    moduleSideEffects: pkg.hasSideEffects(pkg.dir),
  }
}

export function resolvedIdToBrowserUrl(config: ResolvedConfig, id: string): string {
  if (id === browserExternalId || id.startsWith(`${browserExternalId}:`) || id.startsWith(`${optionalPeerDepId}:`)) {
    return `/@id/${encodeURIComponent(id)}`
  }
  if (id.startsWith('/@vite/')) return id
  if (id.startsWith('/@id/') || id.startsWith('/@fs/')) return id
  if (id.startsWith('\0')) return `/@id/${encodeURIComponent(id)}`
  if (isBareImport(id)) return `/@id/${encodeURIComponent(id)}`

  const { file, postfix } = splitFileAndPostfix(id)
  return `${pathToUrl(config.root, file)}${postfix}`
}
