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
  // 先把 .vue 源码 parse 成 descriptor：script/template/styles/customBlocks。
  const { descriptor, errors } = createDescriptor(filename, code, options)
  if (errors.length) {
    // SFC parse 出错时通过 pluginContext.error 抛错，Vite error middleware 会展示。
    for (const error of errors) {
      pluginContext.error(formatCompilerError(filename, error))
    }
    return null
  }

  // output 保存最终 ESM 代码的每一行。
  const output: string[] = []
  // attachedProps 最后交给 _export_sfc，把 render/__scopeId/__file 挂到组件对象上。
  const attachedProps: string[] = []
  // 任意 style scoped 都会让 template 编译时带上 scopeId。
  const hasScoped = descriptor.styles.some((style) => style.scoped)

  // 生成 script 部分：把 export default 改成 const _sfc_main = ...
  output.push(genScriptCode(descriptor, options))

  if (descriptor.template) {
    // template 不在主模块里直接编译，而是生成 ?vue&type=template 子请求。
    const request = genVueRequest(options.root, filename, {
      type: 'template',
      id: descriptor.id,
      scoped: hasScoped,
    })
    // 子请求会导出 render，主模块只负责 import 并挂载到组件对象。
    output.push(`import { render as _sfc_render } from ${JSON.stringify(request)};`)
    attachedProps.push(`["render", _sfc_render]`)
  }

  descriptor.styles.forEach((style, index) => {
    // 每个 style block 生成一个独立子请求，HMR 时才能按 index 单独更新样式。
    const request = genVueRequest(options.root, filename, {
      type: 'style',
      index,
      id: descriptor.id,
      scoped: style.scoped,
    })
    output.push(`import ${JSON.stringify(request)};`)
  })

  descriptor.customBlocks.forEach((block, index) => {
    // custom block 也作为子请求暴露给插件链，真实生态插件可继续接管它。
    const request = genVueRequest(options.root, filename, {
      type: 'custom',
      index,
      id: descriptor.id,
      blockType: block.type,
    })
    output.push(`import ${JSON.stringify(request)};`)
  })

  if (hasScoped) {
    // Vue runtime 会用 __scopeId 给组件 VNode 补 data-v-xxx 属性。
    attachedProps.push(`["__scopeId", ${JSON.stringify(`data-v-${descriptor.id}`)}]`)
  }

  // __file 主要用于 devtools 和报错定位。
  attachedProps.push(`["__file", ${JSON.stringify(normalizePath(path.relative(options.root, filename)))}]`)

  /**
   * 阅读版 HMR 先标记组件主模块为 self-accepting。
   * 官方 handleHotUpdate 会继续比较 descriptor 差异，决定是 rerender
   * template、reload component，还是向 importer 传播。
   */
  output.push(`if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot.invalidate());`)
  if (attachedProps.length) {
    // _export_sfc 是虚拟 helper，负责把附加属性写回组件对象。
    output.push(`import _export_sfc from ${JSON.stringify(EXPORT_HELPER_ID)};`)
    output.push(`export default _export_sfc(_sfc_main, [${attachedProps.join(',')}]);`)
  } else {
    output.push(`export default _sfc_main;`)
  }

  return { code: output.filter(Boolean).join('\n') }
}

function genScriptCode(descriptor: SourceSFCDescriptor, options: ResolvedOptions): string {
  // <script setup> 需要先经过 compiler-sfc compileScript，普通 script 可直接改写默认导出。
  const resolved = resolveScript(descriptor, options)
  if (resolved) return resolved.content

  if (descriptor.script) {
    // 普通 <script> 里 export default {...} 会改成 const _sfc_main = {...}。
    return rewriteDefaultExport(descriptor.script.content)
  }

  // 没写 script 时仍然要创建一个组件对象，template/render 才有挂载目标。
  return `const _sfc_main = {};`
}

function rewriteDefaultExport(code: string): string {
  // 最小实现：只处理常见的 export default 写法。
  if (/\bexport\s+default\b/.test(code)) {
    return code.replace(/\bexport\s+default\b/, 'const _sfc_main =')
  }
  // 没有默认导出时保留原代码，再补一个空组件对象。
  return `${code}\nconst _sfc_main = {};`
}

function genVueRequest(
  root: string,
  filename: string,
  query: { type: 'template' | 'style' | 'custom'; id: string; scoped?: boolean; index?: number; blockType?: string },
): string {
  // Vue 子请求参数都通过 URLSearchParams 生成，避免手写 query 时遗漏编码。
  const params = new URLSearchParams()
  // vue 标记告诉 plugin-vue：这是 SFC 子模块，不是普通 .vue 主请求。
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
