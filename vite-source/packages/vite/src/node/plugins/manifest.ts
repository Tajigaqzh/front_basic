import path from 'node:path'
import type { BuildChunk } from '../build.js'

export type Manifest = Record<string, ManifestChunk>

export interface ManifestChunk {
  src?: string
  file: string
  css?: string[]
  assets?: string[]
  isEntry?: boolean
  name?: string
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
}

/**
 * 对齐官方 plugins/manifest.ts。
 *
 * 官方 manifestPlugin 在 generateBundle 中读取 Rolldown bundle。
 * 阅读版 build.ts 自己生成 BuildChunk，所以这里提供同名 manifest 数据结构
 * 和从 BuildChunk 转 manifest 的函数。
 */
export function createBuildManifest(chunks: BuildChunk[]): Manifest {
  const manifest: Manifest = {}

  for (const chunk of chunks) {
    const key = chunk.facadeModuleId
      ? chunk.modules.find((mod) => mod.id === chunk.facadeModuleId)?.url.replace(/^\//, '') ?? chunk.facadeModuleId
      : `_${path.basename(chunk.fileName)}`
    manifest[key] = {
      src: chunk.facadeModuleId
        ? chunk.modules.find((mod) => mod.id === chunk.facadeModuleId)?.url
        : undefined,
      file: chunk.fileName,
      isEntry: chunk.isEntry || undefined,
      isDynamicEntry: !chunk.isEntry || undefined,
      name: chunk.name,
      imports: chunk.imports.length ? chunk.imports : undefined,
      dynamicImports: chunk.dynamicImports.length ? chunk.dynamicImports : undefined,
    }
  }

  return manifest
}
