import fs from 'node:fs'
import path from 'node:path'
import { parse, type SFCDescriptor } from 'vue/compiler-sfc'
import type { ResolvedOptions } from '../index.js'
import { hash } from './hash.js'
import { normalizePath } from './path.js'

export const cache = new Map<string, SFCDescriptor>()

export type SourceSFCDescriptor = SFCDescriptor & { id: string }

/**
 * 官方 descriptorCache.ts 是 Vue SFC 插件的核心缓存层。
 * descriptor 是 compiler-sfc parse 后得到的结构化结果，里面保存
 * template/script/styles/customBlocks。后续 main/template/style 都复用它。
 */
export function createDescriptor(
  filename: string,
  source: string,
  options: ResolvedOptions,
): { descriptor: SourceSFCDescriptor; errors: SyntaxError[] } {
  const { descriptor, errors } = parse(source, {
    filename,
    sourceMap: options.sourceMap,
  })
  const extended = descriptor as SourceSFCDescriptor
  const normalizedPath = normalizePath(path.relative(options.root, filename))
  extended.id = hash(normalizedPath + (options.isProduction ? source : ''))
  cache.set(filename, extended)
  return { descriptor: extended, errors }
}

export function getDescriptor(filename: string, options: ResolvedOptions): SourceSFCDescriptor {
  const cached = cache.get(filename)
  if (cached) return cached as SourceSFCDescriptor
  return createDescriptor(filename, fs.readFileSync(filename, 'utf-8'), options).descriptor
}

export function getCachedDescriptor(filename: string): SourceSFCDescriptor | undefined {
  return cache.get(filename) as SourceSFCDescriptor | undefined
}

export function invalidateDescriptor(filename: string): void {
  cache.delete(filename)
}
