import fsp from 'node:fs/promises'
import type { ModuleGraph, ModuleNode } from './moduleGraph.js'
import type { ViteDevServer } from './index.js'

export interface HmrUpdate {
  type: 'js-update' | 'css-update'
  path: string
  acceptedPath: string
  timestamp: number
}

export interface HmrPropagationResult {
  updates: HmrUpdate[]
  fullReload: boolean
  boundaries: ModuleNode[]
}

/**
 * 官方 HMR 会从变更模块向上寻找 accept 边界：
 * - 模块 self-accept：只更新自己。
 * - importer accept 了该依赖：更新 importer 声明的边界。
 * - 一直找不到边界：full reload。
 *
 * 这里保留同样的图遍历模型，便于阅读 HMR 为什么依赖 ModuleGraph。
 */
export function propagateHmrUpdate(
  graph: ModuleGraph,
  changedModules: ModuleNode[],
): HmrPropagationResult {
  const updates: HmrUpdate[] = []
  const boundaries: ModuleNode[] = []
  const seen = new Set<ModuleNode>()

  for (const mod of changedModules) {
    const accepted = walkToAcceptedBoundary(mod, mod, seen, updates, boundaries)
    if (!accepted) return { updates: [], fullReload: true, boundaries: [] }
  }

  return { updates, fullReload: false, boundaries }
}

export async function handleHMRUpdate(server: ViteDevServer, file: string): Promise<void> {
  let modules = server.moduleGraph.getModulesByFile(file)
  if (!modules.length) {
    /**
     * Chrome、编辑器或系统文件可能触发和模块图无关的 fs.watch 事件。
     * 官方 Vite 会过滤大量无关文件；阅读版这里直接忽略，避免只改一个
     * 文件时被无关事件带成 full reload。
     */
    server.config.logger.info(`[hmr] ignored ${file}`)
    return
  }

  /**
   * 官方 Vite 会先执行插件 handleHotUpdate，让框架插件根据自身结构精确
   * 返回受影响模块。Vue SFC 就会在这里区分 script/template/style 变化。
   */
  for (const plugin of server.config.plugins) {
    if (!plugin.handleHotUpdate) continue
    const filtered = await plugin.handleHotUpdate({
      file,
      server,
      modules,
      read: () => fsp.readFile(file, 'utf-8'),
    })
    if (Array.isArray(filtered)) {
      modules = filtered as ModuleNode[]
    }
  }

  if (!modules.length) return

  const timestamp = Date.now()
  for (const mod of modules) server.moduleGraph.invalidateModule(mod, timestamp)
  const result = propagateHmrUpdate(server.moduleGraph, modules)

  if (result.fullReload) {
    server.ws.send({ type: 'full-reload' })
  } else {
    server.ws.send({
      type: 'update',
      updates: dedupeUpdates(result.updates).map((update) => ({ ...update, timestamp })),
    })
  }
}

function dedupeUpdates(updates: HmrUpdate[]): HmrUpdate[] {
  const seen = new Set<string>()
  const result: HmrUpdate[] = []
  for (const update of updates) {
    const key = `${update.type}:${update.path}:${update.acceptedPath}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(update)
  }
  return result
}

function walkToAcceptedBoundary(
  changed: ModuleNode,
  current: ModuleNode,
  seen: Set<ModuleNode>,
  updates: HmrUpdate[],
  boundaries: ModuleNode[],
): boolean {
  if (seen.has(current)) return true
  seen.add(current)

  if (current.isSelfAccepting) {
    updates.push({
      type: current.url.endsWith('.css') ? 'css-update' : 'js-update',
      path: current.url,
      acceptedPath: current.url,
      timestamp: Date.now(),
    })
    boundaries.push(current)
    return true
  }

  for (const importer of current.importers) {
    if (accepts(importer, changed) || accepts(importer, current)) {
      updates.push({
        type: importer.url.endsWith('.css') ? 'css-update' : 'js-update',
        path: importer.url,
        acceptedPath: changed.url,
        timestamp: Date.now(),
      })
      boundaries.push(importer)
      continue
    }

    if (!walkToAcceptedBoundary(changed, importer, seen, updates, boundaries)) {
      return false
    }
  }

  return current.importers.size > 0 || current.isSelfAccepting
}

function accepts(importer: ModuleNode, dep: ModuleNode): boolean {
  for (const accepted of importer.acceptedHmrDeps) {
    if (accepted.url === dep.url || accepted.id === dep.id) return true
  }
  return false
}
