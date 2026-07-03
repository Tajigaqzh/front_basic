import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * 阅读定位：
 * optimizer/index.ts 管依赖预构建生命周期：扫描入口裸模块、判断 metadata 是否
 * stale、调用 esbuild 预构建、写入 _metadata.json。它解决的是 dev 模式下
 * node_modules 依赖太碎、CJS 不能直接被浏览器 import 的问题。
 */
import type { ResolvedConfig } from '../plugin.js'
import { cleanUrl, shortHash, slash } from '../utils.js'
import { bundleOptimizedDep } from './rolldownDepPlugin.js'
import { scanDeps } from './scan.js'
import { getDepsCacheDir, getOptimizedDepPath } from './resolve.js'

export interface OptimizedDepInfo {
  id: string
  file: string
  src: string
  browserHash: string
}

export interface DepOptimizationMetadata {
  hash: string
  browserHash: string
  optimized: Record<string, OptimizedDepInfo>
}

export interface DepsOptimizer {
  metadata: DepOptimizationMetadata
  metadataFile: string
  scanProcessing: Promise<DepOptimizationMetadata>
  isOptimizedDep(id: string): boolean
  getOptimizedDepId(id: string): string | undefined
  getOptimizedDepInfo(id: string): OptimizedDepInfo | undefined
}

/**
 * 官方 Vite 的 optimizer 会用 esbuild/Rolldown 把 node_modules 依赖预打包成
 * 浏览器友好的 ESM。本阅读版不真正 bundle 第三方包，而是生成代理模块：
 *
 *   export * from "react";
 *   export { default } from "react";
 *
 * 这样可以清楚看到依赖预构建的几个关键阶段：
 * 1. 从入口源码扫描裸模块。
 * 2. 合并 optimizeDeps.include/exclude。
 * 3. 写入 node_modules/.vite 或自定义缓存目录的 metadata。
 * 4. dev 请求裸模块时走预构建缓存路径。
 */
export async function optimizeDeps(
  config: ResolvedConfig,
  force = config.optimizeDeps.force,
): Promise<DepsOptimizer> {
  /**
   * optimizer 先扫描再决定是否复用缓存。
   * 扫描结果参与 hash 计算，所以入口源码新增/删除 bare import 后，
   * _metadata.json 会被判定 stale 并重新生成。
   */
  const cacheDir = getDepsCacheDir(config)
  const metadataFile = path.join(cacheDir, '_metadata.json')
  //   扫描依赖数组
  const deps = await scanDeps(config)
  //   创建hash
  const hash = await createOptimizerHash(config, deps)

  if (!force && fs.existsSync(metadataFile)) {
    const metadata = JSON.parse(await fsp.readFile(metadataFile, 'utf-8')) as DepOptimizationMetadata
    if (metadata.hash === hash) {
      /**
       * 复用 metadata 不只是省去文件写入，更重要的是保持 browserHash 稳定。
       * 浏览器端依赖 URL 的 query/hash 稳定后，HTTP 缓存也可以继续命中。
       */
      config.logger.info(`[optimizer] using cached deps metadata: ${slash(metadataFile)}`)
      return createDepsOptimizer(metadata, metadataFile)
    }
    config.logger.info(`[optimizer] stale deps metadata, rebuilding: ${slash(metadataFile)}`)
  }

  // deps
  await fsp.rm(cacheDir, { recursive: true, force: true })
  await fsp.mkdir(cacheDir, { recursive: true })

  const optimized: Record<string, OptimizedDepInfo> = {}

  for (const dep of deps) {
    /**
     * 每个 bare import 会对应一个优化产物文件。
     * 官方 Vite 会用 esbuild/Rolldown 真实 bundle 依赖；阅读版生成代理模块，
     * 但 metadata/file/browserHash 的生命周期和官方核心思想一致。
     */
    const file = getOptimizedDepPath(config, dep)
    const bundled = await bundleOptimizedDep(config, dep, file)
    optimized[dep] = {
      id: dep,
      file,
      src: dep,
      browserHash: shortHash(bundled.code),
    }
  }

  const metadata: DepOptimizationMetadata = {
    hash,
    browserHash: shortHash(`${hash}:browser`),
    optimized,
  }

  // 写到.vite/deps/_metadata.json文件中
  await fsp.writeFile(metadataFile, JSON.stringify(metadata, null, 2))
  config.logger.info(`[optimizer] optimized deps: ${deps.length ? deps.join(', ') : '(none)'}`)
  return createDepsOptimizer(metadata, metadataFile)
}

export { scanDeps, getDepsCacheDir }

/**
 * 创建hash
 * @param config
 * @param deps
 */
async function createOptimizerHash(config: ResolvedConfig, deps: string[]): Promise<string> {
  /**
   * 官方 optimizer 的 hash 会综合配置、lockfile、package.json、依赖入口等。
   * 阅读版保留同样思想：metadata 不是永远可信，项目依赖或配置变化后需要
   * 判定 stale 并重新预构建。
   */
  const rootPackage = await readIfExists(path.join(config.root, 'package.json'))
  const workspacePackage = await readIfExists(path.join(path.dirname(config.root), 'package.json'))
  const pnpmLock = await readIfExists(path.join(config.root, 'pnpm-lock.yaml'))
    || await readIfExists(path.join(path.dirname(config.root), 'pnpm-lock.yaml'))
  const hashSource = JSON.stringify({
    mode: config.mode,
    include: config.optimizeDeps.include,
    exclude: config.optimizeDeps.exclude,
    deps,
    rootPackageHash: shortHash(rootPackage),
    workspacePackageHash: shortHash(workspacePackage),
    pnpmLockHash: shortHash(pnpmLock),
  })
  return shortHash(hashSource)
}

async function readIfExists(file: string): Promise<string> {
  try {
    return await fsp.readFile(file, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * 创建依赖优化器
 * @param metadata
 * @param metadataFile
 */
function createDepsOptimizer(
  metadata: DepOptimizationMetadata,
  metadataFile: string,
): DepsOptimizer {
  /**
   * DepsOptimizer 是 transformRequest 和 optimizedDepsPlugin 的查询表。
   * 它不负责转换源码，只回答：
   * - 这个 id 是不是优化依赖？
   * - 如果是，它的缓存文件在哪里？
   * - 这份 metadata 的来源文件在哪里？
   */
  return {
    metadata,
    metadataFile,
    scanProcessing: Promise.resolve(metadata),
    isOptimizedDep(id) {
      return Boolean(metadata.optimized[id] || Object.values(metadata.optimized).some((dep) => dep.file === cleanUrl(id)))
    },
    getOptimizedDepId(id) {
      return metadata.optimized[id]?.file
    },
    getOptimizedDepInfo(id) {
      return metadata.optimized[id]
    },
  }
}
