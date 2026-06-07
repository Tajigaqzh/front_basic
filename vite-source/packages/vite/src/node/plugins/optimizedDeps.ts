import fsp from 'node:fs/promises'
import type { Plugin } from '../plugin.js'
import { cleanUrl } from '../utils.js'

export const ERR_OUTDATED_OPTIMIZED_DEP = 'ERR_OUTDATED_OPTIMIZED_DEP'
export const ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR =
  'ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR'
export const ERR_OPTIMIZE_DEPS_PROCESSING_ERROR =
  'ERR_OPTIMIZE_DEPS_PROCESSING_ERROR'

/**
 * 对齐官方 plugins/optimizedDeps.ts。
 *
 * 官方插件会等待正在处理的 dep、校验 browserHash、处理 outdated request。
 * 阅读版保留职责边界：如果请求命中 deps optimizer 的缓存文件，就直接从
 * 缓存读取，而不是继续走普通文件加载插件。
 */
export function optimizedDepsPlugin(): Plugin {
  return {
    name: 'vite-source:optimized-deps',
    async load(id) {
      const depsOptimizer = (globalThis as any).__vite_source_current_deps_optimizer
      if (!depsOptimizer?.isOptimizedDep(id)) return null

      try {
        return await fsp.readFile(cleanUrl(id), 'utf-8')
      } catch {
        throwFileNotFoundInOptimizedDep(id)
      }
    },
  }
}

export function throwOutdatedRequest(id: string): never {
  const err: any = new Error(`There is a new version of the pre-bundle for "${id}".`)
  err.code = ERR_OUTDATED_OPTIMIZED_DEP
  throw err
}

export function throwProcessingError(id: string): never {
  const err: any = new Error(`Something unexpected happened while optimizing "${id}".`)
  err.code = ERR_OPTIMIZE_DEPS_PROCESSING_ERROR
  throw err
}

export function throwFileNotFoundInOptimizedDep(id: string): never {
  const err: any = new Error(`The optimized dependency file does not exist: ${id}`)
  err.code = ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR
  throw err
}
