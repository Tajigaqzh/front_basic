import type { SFCStyleCompileOptions, SFCTemplateCompileOptions } from 'vue/compiler-sfc'
import fs from 'node:fs'
import path from 'node:path'
import { transformMain } from './main.js'
import { EXPORT_HELPER_ID, helperCode } from './helper.js'
import { transformStyle } from './style.js'
import { transformTemplateAsModule } from './template.js'
import { handleHotUpdate } from './handleHotUpdate.js'
import { clearScriptCache } from './script.js'
import { getDescriptor } from './utils/descriptorCache.js'
import { parseVueRequest } from './utils/query.js'

export { parseVueRequest } from './utils/query.js'
export type { VueQuery } from './utils/query.js'

export interface Options {
  include?: RegExp
  exclude?: RegExp
  isProduction?: boolean
  template?: Partial<SFCTemplateCompileOptions>
  style?: Partial<SFCStyleCompileOptions>
}

export interface ResolvedOptions extends Options {
  root: string
  isProduction: boolean
  sourceMap: boolean
  cssDevSourcemap: boolean
}

type Awaitable<T> = T | Promise<T>

interface PluginContext {
  addWatchFile(id: string): void
  warn(message: string | { message?: string }): void
  error(message: string | { message?: string }): never
}

interface ViteLikePlugin {
  name: string
  config?: (config: Record<string, any>) => Record<string, any> | void
  configResolved?: (config: Record<string, any>) => void
  resolveId?: (this: PluginContext, id: string) => string | { id: string } | null | undefined
  load?: (this: PluginContext, id: string) => string | { code: string; map?: unknown } | null | undefined
  transform?: (
    this: PluginContext,
    code: string,
    id: string,
  ) => Awaitable<string | { code: string; map?: unknown } | null | undefined>
  handleHotUpdate?: (ctx: { file: string; modules: unknown[]; read?: () => Promise<string> }) => Awaitable<unknown[] | void>
}

const vueRequestRE = /\.vue($|\?)/

/**
 * 本地复刻版 @vitejs/plugin-vue。
 *
 * 入口文件职责和官方 packages/plugin-vue/src/index.ts 对齐：
 * - 在 config 钩子中补 Vue runtime 需要的 define 常量。
 * - 在 configResolved 中缓存 root/sourceMap 等最终配置。
 * - 在 resolveId/load/transform 中把 .vue 和 .vue?vue&type=xxx
 *   分发给 main/template/style 模块处理。
 */
export default function vuePlugin(rawOptions: Options = {}): ViteLikePlugin {
  clearScriptCache()

  const options: ResolvedOptions = {
    ...rawOptions,
    root: process.cwd(),
    isProduction: rawOptions.isProduction ?? process.env.NODE_ENV === 'production',
    sourceMap: true,
    cssDevSourcemap: false,
  }

  return {
    name: 'vite:vue',

    config(config) {
      return {
        define: {
          __VUE_OPTIONS_API__: true,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
          ...config.define,
        },
        resolve: {
          /**
           * 官方插件也会 dedupe vue，避免 monorepo/link 场景出现多个
           * Vue runtime 实例。阅读版的 resolver 暂未实现 dedupe，但配置
           * 仍保留下来，便于理解官方设计意图。
           */
          dedupe: ['vue'],
        },
      }
    },

    configResolved(config) {
      options.root = config.root
      options.isProduction = Boolean(config.isProduction)
      options.sourceMap = config.command === 'build' ? Boolean(config.build?.sourcemap) : true
      options.cssDevSourcemap = Boolean(config.css?.devSourcemap)
    },

    resolveId(id) {
      if (id === EXPORT_HELPER_ID) return id
      if (parseVueRequest(id).query.vue) return id
      return null
    },

    load(id) {
      if (id === EXPORT_HELPER_ID) return helperCode

      const { filename, query } = parseVueRequest(id)
      if (!query.vue) return null

      const descriptor = getDescriptor(filename, options)
      if (query.type === 'template') {
        return readBlockContent(filename, descriptor.template, this)
      }
      if (query.type === 'style') {
        return readBlockContent(filename, descriptor.styles[query.index ?? 0], this)
      }
      if (query.type === 'script') {
        return descriptor.script?.content ?? descriptor.scriptSetup?.content ?? ''
      }
      if (query.type === 'custom') {
        return readBlockContent(filename, descriptor.customBlocks[query.index ?? 0], this)
      }
      return null
    },

    async transform(code, id) {
      if (!vueRequestRE.test(id)) return null

      const { filename, query } = parseVueRequest(id)
      if (rawOptions.include && !rawOptions.include.test(filename)) return null
      if (rawOptions.exclude?.test(filename)) return null

      if (!query.vue) {
        return transformMain(code, filename, options, this)
      }

      const descriptor = getDescriptor(filename, options)
      if (query.type === 'template') {
        return transformTemplateAsModule(code, filename, descriptor, options, this)
      }
      if (query.type === 'style') {
        return transformStyle(code, descriptor, query.index ?? 0, options)
      }
      if (query.type === 'custom') {
        return {
          code: [
            `// custom block <${query.blockType ?? descriptor.customBlocks[query.index ?? 0]?.type ?? 'custom'}>`,
            `export default ${JSON.stringify(code)};`,
          ].join('\n'),
        }
      }
      return null
    },

    handleHotUpdate(ctx) {
      return handleHotUpdate(ctx as any, options)
    },
  }
}

function readBlockContent(
  filename: string,
  block: { content?: string; src?: string } | null | undefined,
  ctx: PluginContext,
): string {
  if (!block) return ''
  if (!block.src) return block.content ?? ''

  const src = path.resolve(path.dirname(filename), block.src)
  ctx.addWatchFile(src)
  return fs.readFileSync(src, 'utf-8')
}
