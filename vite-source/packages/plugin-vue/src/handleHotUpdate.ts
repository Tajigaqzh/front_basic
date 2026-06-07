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
  if (!ctx.file.endsWith('.vue')) return

  const prev = getCachedDescriptor(ctx.file)
  if (!prev) return

  const code = ctx.read ? await ctx.read() : ''
  const { descriptor: next } = createDescriptor(ctx.file, code, options)
  const affected = new Set<ModuleNodeLike>()

  const mainModule = ctx.modules.find((mod) => !mod.url.includes('?vue'))
  const templateModule = ctx.modules.find((mod) => mod.url.includes('type=template'))

  const scriptChanged = hasScriptChanged(prev, next)
  if (scriptChanged) {
    invalidateScript(ctx.file)
    if (mainModule) affected.add(mainModule)
  } else {
    const previousScript = getResolvedScript(prev)
    if (previousScript !== undefined) setResolvedScript(next, previousScript)
  }

  if (!isEqualBlock(prev.template, next.template)) {
    if (!scriptChanged) resolveScript(next, options)
    if (templateModule) affected.add(templateModule)
    else if (mainModule) affected.add(mainModule)
  }

  const styleModules = findChangedStyleModules(ctx.modules, prev, next)
  for (const mod of styleModules) affected.add(mod)
  if (prev.styles.length !== next.styles.length && mainModule) affected.add(mainModule)

  if (prev.styles.some((style) => style.scoped) !== next.styles.some((style) => style.scoped)) {
    if (templateModule) affected.add(templateModule)
    if (mainModule) affected.add(mainModule)
  }

  if (prev.cssVars.join('') !== next.cssVars.join('') && mainModule) {
    affected.add(mainModule)
  }

  invalidateDescriptor(ctx.file)

  return affected.size ? [...affected] : undefined
}

export function isEqualBlock(a: SFCBlock | null, b: SFCBlock | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.src && b.src && a.src === b.src) return true
  if (a.content !== b.content) return false
  const aAttrs = JSON.stringify(a.attrs ?? {})
  const bAttrs = JSON.stringify(b.attrs ?? {})
  return aAttrs === bAttrs
}

export function isOnlyTemplateChanged(prev: SourceSFCDescriptor, next: SourceSFCDescriptor): boolean {
  return (
    !hasScriptChanged(prev, next) &&
    !isEqualBlock(prev.template, next.template) &&
    prev.styles.length === next.styles.length &&
    prev.styles.every((style, index) => isEqualBlock(style, next.styles[index]))
  )
}

function hasScriptChanged(prev: SourceSFCDescriptor, next: SourceSFCDescriptor): boolean {
  return !isEqualBlock(prev.script, next.script) || !isEqualBlock(prev.scriptSetup, next.scriptSetup)
}

function findChangedStyleModules(
  modules: ModuleNodeLike[],
  prev: SourceSFCDescriptor,
  next: SourceSFCDescriptor,
): ModuleNodeLike[] {
  const affected: ModuleNodeLike[] = []
  for (let index = 0; index < next.styles.length; index++) {
    if (isEqualBlock(prev.styles[index], next.styles[index])) continue
    const mod = modules.find((item) => item.url.includes('type=style') && item.url.includes(`index=${index}`))
    if (mod) affected.push(mod)
  }
  return affected
}
