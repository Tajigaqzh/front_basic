import fs from 'node:fs'
import path from 'node:path'
import { normalizePath } from './utils.js'

export type PackageCache = Map<string, PackageData>

export interface PackageData {
  dir: string
  data: Record<string, any>
  hasSideEffects(id: string): boolean | 'no-treeshake' | null
  setResolvedCache(key: string, entry: string, optionsKey: string): void
  getResolvedCache(key: string, optionsKey: string): string | undefined
}

/**
 * 对齐官方 packages.ts：集中负责 package.json 的查找、读取、缓存。
 *
 * Vite 的 resolve、optimizer、SSR external 判断都会反复读取 package.json。
 * 如果这些逻辑散落在各个插件里，既慢也难维护；所以官方源码把它抽成
 * PackageData/PackageCache。这里保留同样的数据边界。
 */
export function resolvePackageData(
  pkgName: string,
  basedir: string,
  preserveSymlinks = false,
  packageCache?: PackageCache,
): PackageData | null {
  const originalBasedir = basedir

  while (basedir) {
    const cacheKey = `${pkgName}|${basedir}|${originalBasedir}|${preserveSymlinks ? 1 : 0}`
    const cached = packageCache?.get(cacheKey)
    if (cached) return cached

    const pkgPath = path.join(basedir, 'node_modules', pkgName, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const finalPath = preserveSymlinks ? pkgPath : fs.realpathSync(pkgPath)
      const pkgData = loadPackageData(finalPath)
      packageCache?.set(cacheKey, pkgData)
      return pkgData
    }

    const parent = path.dirname(basedir)
    if (parent === basedir) break
    basedir = parent
  }

  return null
}

export function findNearestPackageData(
  basedir: string,
  packageCache?: PackageCache,
): PackageData | null {
  const originalBasedir = basedir

  while (basedir) {
    const cacheKey = `nearest|${basedir}|${originalBasedir}`
    const cached = packageCache?.get(cacheKey)
    if (cached) return cached

    const pkgPath = path.join(basedir, 'package.json')
    if (fs.existsSync(pkgPath) && fs.statSync(pkgPath).isFile()) {
      const pkgData = loadPackageData(pkgPath)
      packageCache?.set(cacheKey, pkgData)
      return pkgData
    }

    const parent = path.dirname(basedir)
    if (parent === basedir) break
    basedir = parent
  }

  return null
}

export function findNearestMainPackageData(
  basedir: string,
  packageCache?: PackageCache,
): PackageData | null {
  const nearest = findNearestPackageData(basedir, packageCache)
  if (!nearest) return null
  return nearest.data.name
    ? nearest
    : findNearestMainPackageData(path.dirname(nearest.dir), packageCache)
}

export function loadPackageData(pkgPath: string): PackageData {
  const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, any>
  const dir = normalizePath(path.dirname(pkgPath))
  const resolvedCache = new Map<string, string>()
  const sideEffects = data.sideEffects

  return {
    dir,
    data,
    hasSideEffects(id) {
      if (typeof sideEffects === 'boolean') return sideEffects
      if (Array.isArray(sideEffects)) {
        return sideEffects.some((pattern) => {
          const suffix = String(pattern).replace(/^\*\*\//, '')
          return normalizePath(id).endsWith(suffix)
        })
      }
      return null
    },
    setResolvedCache(key, entry, optionsKey) {
      resolvedCache.set(`${key}|${optionsKey}`, entry)
    },
    getResolvedCache(key, optionsKey) {
      return resolvedCache.get(`${key}|${optionsKey}`)
    },
  }
}

export function findNearestNodeModules(basedir: string): string | null {
  while (basedir) {
    const candidate = path.join(basedir, 'node_modules')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }
    const parent = path.dirname(basedir)
    if (parent === basedir) break
    basedir = parent
  }
  return null
}
