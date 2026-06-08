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
  // 插件实例创建时清掉 script 缓存，避免上一次 dev/build 的 SFC 结果影响新服务。
  clearScriptCache()

  // options 会在 configResolved 里用最终 Vite 配置补齐，这里先给出可运行默认值。
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
      /**
       * config 是最早执行的插件 hook。
       * Vue 插件在这里补 runtime compile flags，让浏览器代码里不会再读取
       * Node 专属的 process.env。
       */
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
      // configResolved 能读到 root/build/css/server 等最终值，适合更新插件内部状态。
      options.root = config.root
      options.isProduction = Boolean(config.isProduction)
      options.sourceMap = config.command === 'build' ? Boolean(config.build?.sourcemap) : true
      options.cssDevSourcemap = Boolean(config.css?.devSourcemap)
    },

    resolveId(id) {
      // export helper 是插件内部虚拟模块，后续 load 会返回 helperCode。
      if (id === EXPORT_HELPER_ID) return id
      // .vue?vue&type=xxx 是 transformMain 生成的子请求，直接声明“我能处理”。
      if (parseVueRequest(id).query.vue) return id
      return null
    },

    load(id) {
      // 虚拟 helper 模块不对应真实文件，必须由 load 钩子提供源码。
      if (id === EXPORT_HELPER_ID) return helperCode

      const { filename, query } = parseVueRequest(id)
      if (!query.vue) return null

      // 子请求都复用同一个 SFC descriptor，避免每个 block 重复 parse .vue 文件。
      const descriptor = getDescriptor(filename, options)
      if (query.type === 'template') {
        // template 子模块先返回 template block 内容，transform 再编译成 render 函数。
        return readBlockContent(filename, descriptor.template, this)
      }
      if (query.type === 'style') {
        // style 子模块返回对应 index 的 style block 内容。
        return readBlockContent(filename, descriptor.styles[query.index ?? 0], this)
      }
      if (query.type === 'script') {
        // script 子请求主要用于对齐官方结构；主模块通常会直接内联 script。
        return descriptor.script?.content ?? descriptor.scriptSetup?.content ?? ''
      }
      if (query.type === 'custom') {
        // custom block 交给后续 transform 包成普通 ESM。
        return readBlockContent(filename, descriptor.customBlocks[query.index ?? 0], this)
      }
      return null
    },

    async transform(code, id) {
      // 只处理 .vue 主请求和 .vue?vue 子请求。
      if (!vueRequestRE.test(id)) return null

      const { filename, query } = parseVueRequest(id)
      // include/exclude 是用户控制插件作用范围的常见选项。
      if (rawOptions.include && !rawOptions.include.test(filename)) return null
      if (rawOptions.exclude?.test(filename)) return null

      if (!query.vue) {
        // 主请求：把完整 SFC 拆成 imports + export default 组件对象。
        return transformMain(code, filename, options, this)
      }

      const descriptor = getDescriptor(filename, options)
      if (query.type === 'template') {
        // template 子请求：编译成 render 函数模块。
        return transformTemplateAsModule(code, filename, descriptor, options, this)
      }
      if (query.type === 'style') {
        // style 子请求：编译 scoped/css vars，并在 dev 中变成可注入 CSS 的 JS。
        return transformStyle(code, descriptor, query.index ?? 0, options)
      }
      if (query.type === 'custom') {
        // 阅读版把 custom block 简化成导出原始字符串。
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
      // Vite server 文件变化后会调用这里，Vue 插件可按 block 精确返回受影响模块。
      return handleHotUpdate(ctx as any, options)
    },
  }
}

function readBlockContent(
  filename: string,
  block: { content?: string; src?: string } | null | undefined,
  ctx: PluginContext,
): string {
  // 没有对应 block 时返回空字符串，让子请求仍然是合法模块。
  if (!block) return ''
  // 普通内联 block 直接使用 descriptor 里的 content。
  if (!block.src) return block.content ?? ''

  // <style src="./a.css"> 这类外部资源要加入 watch，外部文件变化也能触发 HMR。
  const src = path.resolve(path.dirname(filename), block.src)
  ctx.addWatchFile(src)
  return fs.readFileSync(src, 'utf-8')
}
