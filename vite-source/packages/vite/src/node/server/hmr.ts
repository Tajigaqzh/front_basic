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
  /**
   * HMR 传播的核心判断不是“谁依赖了变更文件就都更新”，而是：
   * 从变更模块沿 importers 反向走，直到找到一个 accept 边界。
   * 找到边界就可以局部更新；走到入口还没有边界，就只能 full reload。
   */
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
  /**
   * 文件系统事件只知道真实文件路径，HMR 需要先把它映射回 ModuleGraph 节点。
   * 如果模块从没被浏览器请求过，它不在模块图里，改动也无需通知浏览器。
   */
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
  /**
   * 先失效缓存，再计算更新边界。
   * 浏览器收到 update 后会重新 import 带时间戳的 URL，此时必须触发新转换，
   * 不能继续使用旧的 transformResult。
   */
  for (const mod of modules) server.moduleGraph.invalidateModule(mod, timestamp)
  const result = propagateHmrUpdate(server.moduleGraph, modules)

  if (result.fullReload) {
    // 找不到可接受边界时，局部替换无法保证应用状态正确，只能整页刷新。
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
  /**
   * seen 防止循环依赖导致无限递归。遇到已经看过的节点时认为这条路径
   * 不阻塞更新，继续由其它路径决定是否 full reload。
   */
  if (seen.has(current)) return true
  seen.add(current)

  if (current.isSelfAccepting) {
    /**
     * self-accepting 是最小更新边界：模块自己声明能处理自己的新版本。
     * 典型例子是框架运行时包装过的组件模块。
     */
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
      /**
       * importer 显式 accept 了 changed/current，说明边界在 importer。
       * 浏览器端会重新 import acceptedPath，并调用 importer 注册的回调。
       */
      updates.push({
        type: importer.url.endsWith('.css') ? 'css-update' : 'js-update',
        path: importer.url,
        acceptedPath: changed.url,
        timestamp: Date.now(),
      })
      boundaries.push(importer)
      continue
    }

    // 当前 importer 不是边界，就继续沿着 importer 的 importer 向应用入口查找。
    if (!walkToAcceptedBoundary(changed, importer, seen, updates, boundaries)) {
      return false
    }
  }

  /**
   * 没有 importer 且不是 self-accepting，通常说明已经到达入口模块。
   * 入口不能被任何父模块 accept，因此这条路径需要 full reload。
   */
  return current.importers.size > 0 || current.isSelfAccepting
}

function accepts(importer: ModuleNode, dep: ModuleNode): boolean {
  for (const accepted of importer.acceptedHmrDeps) {
    if (accepted.url === dep.url || accepted.id === dep.id) return true
  }
  return false
}
