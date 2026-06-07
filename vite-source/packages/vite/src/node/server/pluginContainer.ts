import fs from 'node:fs/promises'
import { cleanUrl } from '../utils.js'
import type { EmittedFile, Hook, ModuleInfo, Plugin, PluginContext, ResolvedConfig, ResolvedId, TransformResult } from '../plugin.js'

export class PluginContainer {
  private watchedFiles = new Set<string>()
  private emittedFiles = new Map<string, EmittedFile & { fileName: string }>()
  private moduleInfo = new Map<string, ModuleInfo>()
  private nextFileReferenceId = 0

  constructor(
    private readonly config: ResolvedConfig,
    private readonly plugins: Plugin[],
  ) {}

  async buildStart(): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = getHookHandler(plugin.buildStart)
      await hook?.call(this.createContext(plugin))
    }
  }

  async resolveId(id: string, importer?: string): Promise<ResolvedId | null> {
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
    let current = html
    for (const plugin of this.plugins) {
      if (!plugin.transformIndexHtml) continue
      const result = await plugin.transformIndexHtml(current, ctx)
      if (typeof result === 'string') current = result
    }
    return current
  }

  async close(): Promise<void> {
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
  await container.buildStart()
  return container
}

function getHookHandler<T extends (...args: any[]) => any>(hook: Hook<T> | undefined): T | undefined {
  if (!hook) return undefined
  return typeof hook === 'function' ? hook : hook.handler
}

function formatMessage(message: string | { message?: string }): string {
  return typeof message === 'string' ? message : message.message ?? JSON.stringify(message)
}
