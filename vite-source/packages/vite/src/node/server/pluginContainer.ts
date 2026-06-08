import fs from 'node:fs/promises'
import { cleanUrl } from '../utils.js'
import type { EmittedFile, Hook, ModuleInfo, Plugin, PluginContext, ResolvedConfig, ResolvedId, TransformResult } from '../plugin.js'

/**
 * PluginContainer 是 Vite 开发时的 Rollup 兼容层。
 *
 * Vite 插件基本沿用 Rollup 插件钩子，但 dev server 是“按请求转换”，
 * Rollup build 是“从入口构建完整图”。容器的职责就是在 dev/build/SSR
 * 都能用同一种方式调用 resolveId/load/transform 等钩子。
 */
export class PluginContainer {
  /**
   * watchedFiles、emittedFiles、moduleInfo 都是 Rollup 插件上下文能力的缩小版。
   * 很多生态插件会调用 this.addWatchFile、this.emitFile、this.getModuleInfo，
   * 阅读版保留这些状态，方便理解 Vite 为什么需要模拟 Rollup context。
   */
  private watchedFiles = new Set<string>()
  private emittedFiles = new Map<string, EmittedFile & { fileName: string }>()
  private moduleInfo = new Map<string, ModuleInfo>()
  private nextFileReferenceId = 0

  constructor(
    private readonly config: ResolvedConfig,
    private readonly plugins: Plugin[],
  ) {}

  async buildStart(): Promise<void> {
    /**
     * buildStart 在容器创建时执行一次。
     * dev 模式下它对应“服务器启动前插件初始化”，build 模式下它对应
     * Rollup 构建开始前初始化。插件可在这里建立缓存或读取外部状态。
     */
    for (const plugin of this.plugins) {
      const hook = getHookHandler(plugin.buildStart)
      await hook?.call(this.createContext(plugin))
    }
  }

  async resolveId(id: string, importer?: string): Promise<ResolvedId | null> {
    /**
     * resolveId 是插件链的第一个短路钩子：谁先返回结果，后面的 resolver
     * 就不再处理。这个规则让 alias、虚拟模块、node_modules、框架子请求
     * 都能按插件顺序抢占解析权。
     */
    for (const plugin of this.plugins) {
      const hook = getHookHandler(plugin.resolveId)
      if (!hook) continue
      const result = await hook.call(this.createContext(plugin), id, importer)
      if (!result) continue
      const resolved = typeof result === 'string' ? { id: result } : result
      this.recordModuleInfo(resolved.id, resolved.meta)
      return resolved
    }
    return null
  }

  async load(id: string): Promise<TransformResult | null> {
    /**
     * load 负责把 resolved id 变成源码。
     * 插件可以返回虚拟模块、CSS/JSON/asset 转换结果；如果没人处理，
     * 容器最后尝试按文件系统路径读取源码，这是 dev 请求最常见的兜底。
     */
    for (const plugin of this.plugins) {
      const hook = getHookHandler(plugin.load)
      if (!hook) continue
      const result = await hook.call(this.createContext(plugin), id)
      if (result == null) continue
      const loaded = typeof result === 'string' ? { code: result } : result
      this.recordModuleInfo(id, loaded.meta)
      return loaded
    }

    try {
      return { code: await fs.readFile(cleanUrl(id), 'utf-8') }
    } catch {
      return null
    }
  }

  async transform(code: string, id: string): Promise<TransformResult> {
    /**
     * transform 是串行管线，不是短路管线。
     * 每个插件拿到上一个插件的输出继续处理：TS/JSX 先变 JS，glob/dynamic import
     * 生成新 import，最后 import-analysis 再统一改写导入路径。
     */
    let current: TransformResult = { code }
    for (const plugin of this.plugins) {
      const hook = getHookHandler(plugin.transform)
      if (!hook) continue
      const result = await hook.call(this.createContext(plugin), current.code, id)
      if (result == null) continue
      current = typeof result === 'string' ? { code: result } : result
      this.recordModuleInfo(id, current.meta)
    }
    return current
  }

  async ssrTransform(code: string, id: string): Promise<TransformResult | null> {
    /**
     * SSR 转换和浏览器转换关注点不同：浏览器需要 URL 重写和 HMR，
     * SSR 更关心把 ESM 模块包装成可在 Node 里执行的形态。
     */
    let current: TransformResult = { code }
    let changed = false
    for (const plugin of this.plugins) {
      if (!plugin.ssrTransform) continue
      const result = await plugin.ssrTransform.call(this.createContext(plugin), current.code, id)
      if (result == null) continue
      current = typeof result === 'string' ? { code: result } : result
      changed = true
    }
    return changed ? current : null
  }

  async transformIndexHtml(html: string, ctx: Parameters<NonNullable<Plugin['transformIndexHtml']>>[1]): Promise<string> {
    /**
     * HTML 不是普通 JS 模块，入口脚本、资源 URL、dev client 注入都发生在这里。
     * 所以 Vite 为 HTML 单独提供 transformIndexHtml 钩子。
     */
    let current = html
    for (const plugin of this.plugins) {
      if (!plugin.transformIndexHtml) continue
      const result = await plugin.transformIndexHtml(current, ctx)
      if (typeof result === 'string') current = result
    }
    return current
  }

  async close(): Promise<void> {
    // closeBundle 逆序执行，和很多插件“后创建先释放”的资源生命周期一致。
    for (const plugin of [...this.plugins].reverse()) {
      await plugin.closeBundle?.()
    }
  }

  getWatchFiles(): string[] {
    return [...this.watchedFiles]
  }

  takeEmittedFiles(): Array<EmittedFile & { referenceId: string; fileName: string }> {
    const files = [...this.emittedFiles.entries()].map(([referenceId, file]) => ({
      referenceId,
      ...file,
    }))
    this.emittedFiles.clear()
    return files
  }

  private createContext(plugin: Plugin): PluginContext {
    /**
     * 每次调用钩子都创建一个带当前 plugin 名称的 context。
     * warn/error 会带上插件名，resolve 会回到当前容器，从而支持插件内部
     * this.resolve('dep', importer) 继续复用完整解析链。
     */
    return {
      resolve: (id, importer) => this.resolveId(id, importer),
      addWatchFile: (id) => this.watchedFiles.add(id),
      emitFile: (file) => this.emitFile(file),
      getFileName: (referenceId) => this.getFileName(referenceId),
      getModuleInfo: (id) => this.getModuleInfo(id),
      warn: (message) => this.config.logger.warn(`[${plugin.name}] ${formatMessage(message)}`),
      error: (message) => {
        throw new Error(`[${plugin.name}] ${formatMessage(message)}`)
      },
    }
  }

  private emitFile(file: EmittedFile): string {
    // Rollup 真实实现会在 generate 阶段落盘；这里先缓存，build adapter 再 flush。
    const referenceId = `vite-source-file-${this.nextFileReferenceId++}`
    const fileName = file.fileName ?? file.name ?? referenceId
    this.emittedFiles.set(referenceId, { ...file, fileName })
    return referenceId
  }

  private getFileName(referenceId: string): string {
    const file = this.emittedFiles.get(referenceId)
    if (!file) throw new Error(`Unknown emitted file reference: ${referenceId}`)
    return file.fileName
  }

  private getModuleInfo(id: string): ModuleInfo | null {
    return this.moduleInfo.get(cleanUrl(id)) ?? null
  }

  private recordModuleInfo(id: string, meta: Record<string, unknown> = {}): void {
    /**
     * moduleInfo 是给插件查询的轻量信息，不等同于 dev server 的 ModuleGraph。
     * ModuleGraph 记录 URL/id/importer/HMR/cache；moduleInfo 更像 Rollup context
     * 暴露给插件的元数据视图。
     */
    const clean = cleanUrl(id)
    const current = this.moduleInfo.get(clean)
    this.moduleInfo.set(clean, {
      id: clean,
      meta: { ...(current?.meta ?? {}), ...meta },
      importedIds: current?.importedIds ?? [],
      isEntry: current?.isEntry ?? false,
    })
  }
}

export async function createPluginContainer(config: ResolvedConfig): Promise<PluginContainer> {
  const container = new PluginContainer(config, config.plugins)
  // 容器创建完成立刻触发 buildStart，保证后续请求进来时插件已经初始化。
  await container.buildStart()
  return container
}

function getHookHandler<T extends (...args: any[]) => any>(hook: Hook<T> | undefined): T | undefined {
  // Rollup 支持 hook 或 { handler, order/filter } 形式；阅读版只取 handler。
  if (!hook) return undefined
  return typeof hook === 'function' ? hook : hook.handler
}

function formatMessage(message: string | { message?: string }): string {
  return typeof message === 'string' ? message : message.message ?? JSON.stringify(message)
}
