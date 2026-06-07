import { compileScript, type SFCScriptBlock } from 'vue/compiler-sfc'
import type { ResolvedOptions } from './index.js'
import type { SourceSFCDescriptor } from './utils/descriptorCache.js'
import { getCachedDescriptor } from './utils/descriptorCache.js'

let clientCache = new WeakMap<SourceSFCDescriptor, SFCScriptBlock | null>()

/**
 * 对齐官方 script.ts。
 *
 * compileScript 是 <script setup> 的关键步骤，它会：
 * - 把 setup 顶层变量改造成组件 setup 返回值。
 * - 生成 bindings，给 template 编译器判断变量来自 setup/props/data。
 * - 处理 lang="ts"、defineProps、defineEmits 等基础编译。
 *
 * 阅读版先实现 client 缓存和 genDefaultAs，SSR 分支后续再补。
 */
export function resolveScript(
  descriptor: SourceSFCDescriptor,
  options: ResolvedOptions,
): SFCScriptBlock | null {
  if (!descriptor.script && !descriptor.scriptSetup) return null

  const cached = clientCache.get(descriptor)
  if (cached !== undefined) return cached

  const resolved = compileScript(descriptor, {
    id: descriptor.id,
    isProd: options.isProduction,
    sourceMap: options.sourceMap,
    genDefaultAs: '_sfc_main',
  })

  clientCache.set(descriptor, resolved)
  return resolved
}

export function getResolvedScript(descriptor: SourceSFCDescriptor): SFCScriptBlock | null | undefined {
  return clientCache.get(descriptor)
}

export function setResolvedScript(descriptor: SourceSFCDescriptor, script: SFCScriptBlock | null): void {
  clientCache.set(descriptor, script)
}

export function invalidateScript(filename: string): void {
  const descriptor = getCachedDescriptor(filename)
  if (descriptor) clientCache.delete(descriptor)
}

export function clearScriptCache(): void {
  clientCache = new WeakMap()
}
