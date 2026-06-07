import path from 'node:path'
import type { ResolvedOptions } from './index.js'
import { createDescriptor, type SourceSFCDescriptor } from './utils/descriptorCache.js'
import { normalizePath, pathToUrl } from './utils/path.js'
import { resolveScript } from './script.js'
import { EXPORT_HELPER_ID } from './helper.js'

interface PluginContext {
  error(message: string | { message?: string }): never
}

/**
 * 对齐官方 main.ts 的核心职责：把一个 .vue 文件转换成标准 ESM。
 *
 * 生成结果大致是：
 *   const _sfc_main = { ...script default... }
 *   import { render } from "/src/App.vue?vue&type=template"
 *   import "/src/App.vue?vue&type=style&index=0"
 *   _sfc_main.render = render
 *   export default _sfc_main
 */
export function transformMain(
  code: string,
  filename: string,
  options: ResolvedOptions,
  pluginContext: PluginContext,
): { code: string; map?: unknown } | null {
  const { descriptor, errors } = createDescriptor(filename, code, options)
  if (errors.length) {
    for (const error of errors) {
      pluginContext.error(formatCompilerError(filename, error))
    }
    return null
  }

  const output: string[] = []
  const attachedProps: string[] = []
  const hasScoped = descriptor.styles.some((style) => style.scoped)

  output.push(genScriptCode(descriptor, options))

  if (descriptor.template) {
    const request = genVueRequest(options.root, filename, {
      type: 'template',
      id: descriptor.id,
      scoped: hasScoped,
    })
    output.push(`import { render as _sfc_render } from ${JSON.stringify(request)};`)
    attachedProps.push(`["render", _sfc_render]`)
  }

  descriptor.styles.forEach((style, index) => {
    const request = genVueRequest(options.root, filename, {
      type: 'style',
      index,
      id: descriptor.id,
      scoped: style.scoped,
    })
    output.push(`import ${JSON.stringify(request)};`)
  })

  descriptor.customBlocks.forEach((block, index) => {
    const request = genVueRequest(options.root, filename, {
      type: 'custom',
      index,
      id: descriptor.id,
      blockType: block.type,
    })
    output.push(`import ${JSON.stringify(request)};`)
  })

  if (hasScoped) {
    attachedProps.push(`["__scopeId", ${JSON.stringify(`data-v-${descriptor.id}`)}]`)
  }

  attachedProps.push(`["__file", ${JSON.stringify(normalizePath(path.relative(options.root, filename)))}]`)

  /**
   * 阅读版 HMR 先标记组件主模块为 self-accepting。
   * 官方 handleHotUpdate 会继续比较 descriptor 差异，决定是 rerender
   * template、reload component，还是向 importer 传播。
   */
  output.push(`if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot.invalidate());`)
  if (attachedProps.length) {
    output.push(`import _export_sfc from ${JSON.stringify(EXPORT_HELPER_ID)};`)
    output.push(`export default _export_sfc(_sfc_main, [${attachedProps.join(',')}]);`)
  } else {
    output.push(`export default _sfc_main;`)
  }

  return { code: output.filter(Boolean).join('\n') }
}

function genScriptCode(descriptor: SourceSFCDescriptor, options: ResolvedOptions): string {
  const resolved = resolveScript(descriptor, options)
  if (resolved) return resolved.content

  if (descriptor.script) {
    return rewriteDefaultExport(descriptor.script.content)
  }

  return `const _sfc_main = {};`
}

function rewriteDefaultExport(code: string): string {
  if (/\bexport\s+default\b/.test(code)) {
    return code.replace(/\bexport\s+default\b/, 'const _sfc_main =')
  }
  return `${code}\nconst _sfc_main = {};`
}

function genVueRequest(
  root: string,
  filename: string,
  query: { type: 'template' | 'style' | 'custom'; id: string; scoped?: boolean; index?: number; blockType?: string },
): string {
  const params = new URLSearchParams()
  params.set('vue', '')
  params.set('type', query.type)
  if (query.index != null) params.set('index', String(query.index))
  params.set('id', query.id)
  if (query.blockType) params.set('blockType', query.blockType)
  if (query.scoped) params.set('scoped', 'true')
  return `${pathToUrl(root, filename)}?${params.toString()}`
}

function formatCompilerError(filename: string, error: unknown): string {
  if (typeof error === 'string') return `${filename}: ${error}`
  if (error && typeof error === 'object' && 'message' in error) {
    return `${filename}: ${String((error as { message: unknown }).message)}`
  }
  return `${filename}: ${String(error)}`
}
