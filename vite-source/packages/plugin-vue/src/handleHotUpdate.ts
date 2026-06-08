import type { SFCBlock } from 'vue/compiler-sfc'
import type { ResolvedOptions } from './index.js'
import {
  createDescriptor,
  getCachedDescriptor,
  invalidateDescriptor,
  type SourceSFCDescriptor,
} from './utils/descriptorCache.js'
import { getResolvedScript, invalidateScript, resolveScript, setResolvedScript } from './script.js'

interface ModuleNodeLike {
  url: string
  id: string
}

export interface VueHotUpdateContext {
  file: string
  modules: ModuleNodeLike[]
  read?: () => Promise<string>
}

/**
 * 对齐官方 handleHotUpdate.ts。
 *
 * Vue SFC HMR 的关键是比较“旧 descriptor”和“新 descriptor”：
 * - 只有 template 变了：优先更新 template 子模块，浏览器侧 rerender。
 * - script 变了：更新主模块，组件 reload。
 * - style 变了：更新 style 子模块。
 *
 * 阅读版返回受影响的 ModuleNode 列表，Vite server 再用已有 HMR 传播逻辑发送
 * update/full-reload。浏览器端目前还没有完整 __VUE_HMR_RUNTIME__ rerender
 * 协议，所以这里先做到模块级精确失效。
 */
export async function handleHotUpdate(
  ctx: VueHotUpdateContext,
  options: ResolvedOptions,
): Promise<ModuleNodeLike[] | void> {
  // 只处理 Vue SFC 文件，其它文件交还给 Vite 通用 HMR 流程。
  if (!ctx.file.endsWith('.vue')) return

  // prev 是文件变化前缓存的 descriptor，用来和新内容做差异比较。
  const prev = getCachedDescriptor(ctx.file)
  if (!prev) return

  // read 由 Vite server 提供，确保读取的是变化后的最新文件内容。
  const code = ctx.read ? await ctx.read() : ''
  // next 是变化后的 descriptor。
  const { descriptor: next } = createDescriptor(ctx.file, code, options)
  // affected 收集需要通知 Vite HMR 继续传播的模块节点。
  const affected = new Set<ModuleNodeLike>()

  // 主模块对应 /src/App.vue，不带 ?vue。
  const mainModule = ctx.modules.find((mod) => !mod.url.includes('?vue'))
  // template 子模块对应 /src/App.vue?vue&type=template...
  const templateModule = ctx.modules.find((mod) => mod.url.includes('type=template'))

  // script 或 script setup 变了，通常需要刷新组件主模块。
  const scriptChanged = hasScriptChanged(prev, next)
  if (scriptChanged) {
    // script 编译缓存必须失效，否则下一次 transform 会拿到旧 setup/script 结果。
    invalidateScript(ctx.file)
    if (mainModule) affected.add(mainModule)
  } else {
    /**
     * script 没变时复用旧的 resolvedScript。
     * 这样 template/style 热更新不需要重新跑 script setup 编译。
     */
    const previousScript = getResolvedScript(prev)
    if (previousScript !== undefined) setResolvedScript(next, previousScript)
  }

  if (!isEqualBlock(prev.template, next.template)) {
    // template 变了但 script 没变，先确保 next descriptor 也带有可复用 script 信息。
    if (!scriptChanged) resolveScript(next, options)
    // 优先更新 template 子模块；没有子模块时退回更新主模块。
    if (templateModule) affected.add(templateModule)
    else if (mainModule) affected.add(mainModule)
  }

  // style block 按 index 精确比较，哪个 style 变了只更新哪个 style 子模块。
  const styleModules = findChangedStyleModules(ctx.modules, prev, next)
  for (const mod of styleModules) affected.add(mod)
  // style 数量变化会影响主模块生成的 import 列表，因此主模块也要更新。
  if (prev.styles.length !== next.styles.length && mainModule) affected.add(mainModule)

  if (prev.styles.some((style) => style.scoped) !== next.styles.some((style) => style.scoped)) {
    // scoped 状态变化会影响 template 上的 scopeId，也会影响组件主模块元信息。
    if (templateModule) affected.add(templateModule)
    if (mainModule) affected.add(mainModule)
  }

  if (prev.cssVars.join('') !== next.cssVars.join('') && mainModule) {
    // CSS v-bind 变量变化需要组件主模块重新生成变量注入逻辑。
    affected.add(mainModule)
  }

  // 最后清掉旧 descriptor，下次 getDescriptor 会重新读取最新 SFC。
  invalidateDescriptor(ctx.file)

  // 返回 undefined 代表交给 Vite 默认模块列表；返回数组代表插件精确筛选过。
  return affected.size ? [...affected] : undefined
}

export function isEqualBlock(a: SFCBlock | null, b: SFCBlock | null): boolean {
  // 两边都没有这个 block，说明没变化。
  if (!a && !b) return true
  // 一边有一边没有，说明新增或删除了 block。
  if (!a || !b) return false
  // src 引用相同外部文件时，SFC 这一层的 block 结构可视为相同。
  if (a.src && b.src && a.src === b.src) return true
  // 内容不同一定变化。
  if (a.content !== b.content) return false
  // 内容相同还要比较 scoped/lang/module 等 attrs。
  const aAttrs = JSON.stringify(a.attrs ?? {})
  const bAttrs = JSON.stringify(b.attrs ?? {})
  return aAttrs === bAttrs
}

export function isOnlyTemplateChanged(prev: SourceSFCDescriptor, next: SourceSFCDescriptor): boolean {
  // 这个工具函数表示“除了 template，其它 script/style 都没变”。
  return (
    !hasScriptChanged(prev, next) &&
    !isEqualBlock(prev.template, next.template) &&
    prev.styles.length === next.styles.length &&
    prev.styles.every((style, index) => isEqualBlock(style, next.styles[index]))
  )
}

function hasScriptChanged(prev: SourceSFCDescriptor, next: SourceSFCDescriptor): boolean {
  // <script> 和 <script setup> 任意一个变化，都视为 script 层变化。
  return !isEqualBlock(prev.script, next.script) || !isEqualBlock(prev.scriptSetup, next.scriptSetup)
}

function findChangedStyleModules(
  modules: ModuleNodeLike[],
  prev: SourceSFCDescriptor,
  next: SourceSFCDescriptor,
): ModuleNodeLike[] {
  const affected: ModuleNodeLike[] = []
  for (let index = 0; index < next.styles.length; index++) {
    // style 内容和 attrs 都相同，则这个 style 子模块无需更新。
    if (isEqualBlock(prev.styles[index], next.styles[index])) continue
    // 通过 query 里的 type=style&index=n 找回对应 ModuleNode。
    const mod = modules.find((item) => item.url.includes('type=style') && item.url.includes(`index=${index}`))
    if (mod) affected.push(mod)
  }
  return affected
}
