import path from 'node:path'

/**
 * 阅读定位：
 * ModuleGraph 负责把浏览器 URL、文件系统 id、依赖关系和 HMR 边界串起来。
 * transformRequest 负责写图，hmr.ts 负责读图向上寻找 accept 边界。
 * 所以 HMR 的很多问题，本质都是“模块图里边是否记录对了”。
 */
import { cleanUrl, slash } from '../utils.js'
import { parseImportAnalysisAst } from '../plugins/importAnalysis.js'

export interface ModuleNode {
  /** 浏览器看到的模块 URL，例如 /src/main.ts 或 /@id/react。 */
  url: string
  /** 插件容器解析后的内部 id，通常是绝对文件路径，也可能是虚拟模块 id。 */
  id: string
  /** 谁 import 了当前模块。HMR 从变更模块向上找边界时依赖这个反向边。 */
  importers: Set<ModuleNode>
  /** 当前模块 import 了哪些模块。transformRequest 更新模块信息时重建这组边。 */
  importedModules: Set<ModuleNode>
  /** import.meta.hot.accept('./dep') 声明的可接受依赖。 */
  acceptedHmrDeps: Set<ModuleNode>
  /** 官方用于精确 export 级 HMR；阅读版保留字段，便于和官方源码对照。 */
  acceptedHmrExports: Set<string>
  /** import.meta.hot.accept() 无参数或回调形式代表模块可以自接受更新。 */
  isSelfAccepting: boolean
  /** 当前模块最终转换结果缓存。HMR 失效时会被清空。 */
  transformResult: { code: string; map?: unknown } | null
  /** 最近一次失效时间戳，用于给浏览器追加 ?t=xxx 避免 HTTP 缓存。 */
  lastInvalidationTimestamp: number
}

/**
 * ModuleGraph 是 dev server 的记忆系统。
 *
 * 浏览器请求的是 URL，例如 /src/main.ts；插件容器处理的是 resolved id，
 * 例如 /Users/.../src/main.ts。模块图把二者关联起来，并记录依赖关系，
 * HMR 才能从“哪个文件变了”追到“哪些浏览器模块需要更新”。
 */
export class ModuleGraph {
  private urlToModuleMap = new Map<string, ModuleNode>()
  private idToModuleMap = new Map<string, ModuleNode>()

  getModuleByUrl(url: string): ModuleNode | undefined {
    return this.urlToModuleMap.get(url)
  }

  getModuleById(id: string): ModuleNode | undefined {
    return this.idToModuleMap.get(id)
  }

  ensureEntryFromUrl(url: string, id = cleanUrl(url)): ModuleNode {
    /**
     * URL 和 id 不是一一等同的：同一个文件可能通过 /src/a.ts、带 query 的
     * Vue 子请求、或解析后的绝对路径被访问。ensureEntryFromUrl 会尽量复用
     * 已有节点，避免同一模块在图里分裂成多个互不相干的节点。
     */
    const normalizedUrl = url
    let mod = this.urlToModuleMap.get(normalizedUrl) ?? this.idToModuleMap.get(id)
    if (!mod) {
      mod = {
        url: normalizedUrl,
        id,
        importers: new Set(),
        importedModules: new Set(),
        acceptedHmrDeps: new Set(),
        acceptedHmrExports: new Set(),
        isSelfAccepting: false,
        transformResult: null,
        lastInvalidationTimestamp: 0,
      }
    }
    mod.id = id
    this.urlToModuleMap.set(normalizedUrl, mod)
    this.idToModuleMap.set(id, mod)
    return mod
  }

  async updateModuleInfo(mod: ModuleNode, code: string): Promise<void> {
    /**
     * 模块每次重新 transform 后，依赖关系都要先清理再重建。
     * 否则删除一个 import 后，旧依赖还会保留 importer 反向边，HMR 会误判影响范围。
     */
    for (const dep of mod.importedModules) {
      dep.importers.delete(mod)
    }
    mod.importedModules.clear()
    mod.acceptedHmrDeps.clear()
    mod.acceptedHmrExports.clear()

    const ast = await parseImportAnalysisAst(code)
    mod.isSelfAccepting = ast.isSelfAccepting

    for (const specifier of [...ast.staticImports, ...ast.dynamicImports]) {
      /**
       * 这里记录的是 import-analysis 之后的 specifier，通常已经是浏览器 URL。
       * 真实 Vite 会进一步通过 moduleGraph.resolveUrl 做更完整的 url/id 映射。
       */
      const dep = this.ensureEntryFromUrl(specifier, specifier)
      mod.importedModules.add(dep)
      dep.importers.add(mod)
    }

    for (const accepted of ast.acceptedHmrDeps) {
      const normalized = normalizeAcceptedHmrDep(mod.url, accepted)
      mod.acceptedHmrDeps.add(this.ensureEntryFromUrl(normalized, normalized))
    }
  }

  invalidateModule(
    mod: ModuleNode,
    timestamp = Date.now(),
    seen: Set<ModuleNode> = new Set(),
  ): void {
    if (seen.has(mod)) return
    seen.add(mod)
    mod.transformResult = null
    mod.lastInvalidationTimestamp = timestamp

    /**
     * 官方 Vite 会根据 soft invalidation、accepted exports、CSS HMR 等场景
     * 决定失效范围。阅读版的原则是：只让变更模块本身失效；如果最终需要
     * full reload，浏览器会重新拉整页依赖。这样自接受模块更新时不会因为
     * importer 缓存被清空而制造多余请求。
     */
    if (!mod.isSelfAccepting) {
      for (const importer of mod.importers) {
        if (!accepts(importer, mod)) this.invalidateModule(importer, timestamp, seen)
      }
    }
  }

  getModulesByFile(file: string): ModuleNode[] {
    /**
     * 一个真实文件可能对应多个模块节点，例如 Vue SFC 的 script/template/style
     * 子请求。HMR 从文件系统事件进入时，需要找出所有相关 ModuleNode。
     */
    return [...new Set([...this.idToModuleMap.values()].filter((mod) => cleanUrl(mod.id) === file))]
  }

  getModules(): ModuleNode[] {
    return [...new Set([...this.urlToModuleMap.values(), ...this.idToModuleMap.values()])]
  }
}

function normalizeAcceptedHmrDep(importerUrl: string, accepted: string): string {
  if (!accepted.startsWith('.')) return accepted
  return slash(path.posix.normalize(path.posix.join(path.posix.dirname(importerUrl), accepted)))
}

function accepts(importer: ModuleNode, dep: ModuleNode): boolean {
  for (const accepted of importer.acceptedHmrDeps) {
    if (accepted.url === dep.url || accepted.id === dep.id) return true
  }
  return false
}
