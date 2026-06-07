import type { Plugin, ResolvedConfig } from '../plugin.js'

/**
 * 阅读定位：
 * plugins/index.ts 是内置插件链的总装配点。Vite 的能力不是写在一个大函数里，
 * 而是按 resolve/html/css/asset/define/import-analysis 等插件串起来。
 * 看这个文件时重点看顺序：前面的插件会改变 id 或源码，后面的插件基于
 * 已转换结果继续分析。例如 importAnalysis 必须在 esbuild、glob、asset URL 之后。
 */
import { assetImportMetaUrlPlugin } from './assetImportMetaUrl.js'
import { assetPlugin } from './asset.js'
import { clientInjectionsPlugin } from './clientInjections.js'
import { cssPlugin } from './css.js'
import { definePlugin } from './define.js'
import { dynamicImportVarsPlugin } from './dynamicImportVars.js'
import { esbuildPlugin } from './esbuild.js'
import { htmlPlugin } from './html.js'
import { importGlobPlugin } from './importMetaGlob.js'
import { importAnalysisPlugin } from './importAnalysis.js'
import { buildImportAnalysisPlugin } from './importAnalysisBuild.js'
import { jsonPlugin } from './json.js'
import { optimizedDepsPlugin } from './optimizedDeps.js'
import { resolvePlugin } from './resolve.js'

/**
 * 官方 Vite 的内置插件链很长，且 dev/build 会有不同插件。
 * 这里按主链路保留最能说明执行逻辑的插件：
 *
 * pre:    resolve 先把浏览器 URL、相对路径和裸模块变成内部 id。
 * normal: html/json/css/asset/client 负责把不同资源变成浏览器可执行内容。
 * post:   import-analysis 在最终 JS 上分析依赖并重写导入路径。
 */
export function resolvePlugins(config: ResolvedConfig): Plugin[] {
  return [
    resolvePlugin(config),
    optimizedDepsPlugin(),
    htmlPlugin(config),
    jsonPlugin(),
    cssPlugin(),
    assetPlugin(config),
    clientInjectionsPlugin(config),
    definePlugin(config),
    assetImportMetaUrlPlugin(config),
    dynamicImportVarsPlugin(config),
    importGlobPlugin(config),
    ...(config.esbuild === false ? [] : [esbuildPlugin(config)]),
    config.command === 'build'
      ? buildImportAnalysisPlugin(config)
      : importAnalysisPlugin(config),
  ]
}
