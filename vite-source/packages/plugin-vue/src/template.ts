import {
  compileTemplate,
  type SFCTemplateCompileResults,
} from 'vue/compiler-sfc'
import type { ResolvedOptions } from './index.js'
import type { SourceSFCDescriptor } from './utils/descriptorCache.js'
import { resolveScript } from './script.js'

interface PluginContext {
  warn(message: string | { message?: string }): void
  error(message: string | { message?: string }): never
}

/**
 * 对齐官方 template.ts：SFC template 子请求会被编译成一个导出 render
 * 函数的 JS 模块。主模块再把 render 挂到组件对象上。
 */
export function transformTemplateAsModule(
  code: string,
  filename: string,
  descriptor: SourceSFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
): { code: string; map?: unknown } {
  const result = compile(code, filename, descriptor, options, pluginContext)
  return {
    code: `${result.code}\nif (import.meta.hot) import.meta.hot.accept(() => import.meta.hot.invalidate());`,
    map: result.map,
  }
}

export function compile(
  code: string,
  filename: string,
  descriptor: SourceSFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
): SFCTemplateCompileResults {
  const hasScoped = descriptor.styles.some((style) => style.scoped)
  const script = resolveScript(descriptor, options)

  const result = compileTemplate({
    ...options.template,
    id: descriptor.id,
    filename,
    source: code,
    scoped: hasScoped,
    isProd: options.isProduction,
    compilerOptions: {
      ...options.template?.compilerOptions,
      scopeId: hasScoped ? `data-v-${descriptor.id}` : undefined,
      /**
       * <script setup> 的绑定默认不会挂到组件 public proxy 上。
       * 如果 template 编译器不知道哪些变量来自 setup，就会生成 _ctx.title，
       * 运行时会触发 “Property xxx was accessed during render but is not defined”。
       * 官方 plugin-vue 通过 resolveScript(...).bindings 把绑定元数据传给
       * compileTemplate，这里保留同样的关键步骤。
       */
      bindingMetadata: script?.bindings,
      sourceMap: options.sourceMap,
    },
  })

  for (const error of result.errors) {
    pluginContext.error(formatCompilerError(filename, error))
  }
  for (const tip of result.tips) {
    pluginContext.warn({ message: `${filename}: ${tip}` })
  }

  return result
}

function formatCompilerError(filename: string, error: unknown): string {
  if (typeof error === 'string') return `${filename}: ${error}`
  if (error && typeof error === 'object' && 'message' in error) {
    return `${filename}: ${String((error as { message: unknown }).message)}`
  }
  return `${filename}: ${String(error)}`
}
