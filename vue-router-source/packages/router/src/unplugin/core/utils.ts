import type { TreeNode } from './tree'
import type { RouteRecordOverride, TreePathParam } from './treeNodeValue'
import { pascalCase } from 'scule'
import type { ResolvedOptions, RoutesFolderOptionResolved } from '../options'
import { _OverridableOption } from '../options'
import { toStringLiteral } from '../utils'

export function warn(
  msg: string,
  type: 'warn' | 'error' | 'debug' = 'warn'
): void {
  // unplugin 侧单独维护一套 warning 前缀，方便区分和 runtime router 的告警来源。
  console[type](`⚠️  [vue-router]: ${msg}`)
}

export function logTree(tree: TreeNode, log: (str: string) => any) {
  // 调试时把 route tree 结构打印成人类可读的 ASCII 树。
  log(printTree(tree))
}

const MAX_LEVEL = 1000
function printTree(
  tree: TreeNode | TreeNode['children'],
  level = 0,
  parentPre = '',
  treeStr = ''
): string {
  // end of recursion
  if (typeof tree !== 'object' || level >= MAX_LEVEL) return ''

  if (tree instanceof Map) {
    const total = tree.size
    let index = 0
    for (const [_key, child] of tree) {
      const hasNext = index++ < total - 1
      const { children } = child

      treeStr += `${`${parentPre}${hasNext ? '├' : '└'}${
        '─' + (children.size > 0 ? '┬' : '')
      } `}${child}\n`

      if (children) {
        treeStr += printTree(
          children,
          level + 1,
          `${parentPre}${hasNext ? '│' : ' '} `
        )
      }
    }
  } else {
    const children = tree.children
    treeStr = `${tree}\n`
    if (children) {
      treeStr += printTree(children, level + 1)
    }
  }

  return treeStr
}

/**
 * Type safe alternative to Array.isArray
 * https://github.com/microsoft/TypeScript/pull/48228
 */
export const isArray: (arg: ArrayLike<any> | any) => arg is ReadonlyArray<any> =
  Array.isArray

export function trimExtension(
  path: string,
  extensions: ResolvedOptions['extensions']
) {
  // 从页面文件路径里剥掉被配置允许的扩展名，得到纯路由片段。
  for (const extension of extensions) {
    const lastDot = path.endsWith(extension) ? -extension.length : 0
    if (lastDot < 0) {
      // usually only one extension should match
      return path.slice(0, lastDot)
    }
  }

  // no extension found, return the original path
  return path
}

export function throttle(fn: () => void, wait: number, initialWait: number) {
  // 用于文件监听场景：首个变化尽快执行，后续频繁变化在窗口期内合并。
  let pendingExecutionTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingExecution = false
  let executionTimeout: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (pendingExecutionTimeout == null) {
      pendingExecutionTimeout = setTimeout(() => {
        pendingExecutionTimeout = null
        if (pendingExecution) {
          pendingExecution = false
          fn()
        }
      }, wait)
      executionTimeout = setTimeout(() => {
        executionTimeout = null
        fn()
      }, initialWait)
    } else if (executionTimeout == null) {
      // we run the function recently, so we can skip it and add a pending execution
      pendingExecution = true
    }
  }
}

export const LEADING_SLASH_RE = /^\//
export const TRAILING_SLASH_RE = /\/$/
export const ESCAPED_TRAILING_SLASH_RE = /\\\/$/
export function joinPath(...paths: string[]): string {
  // 这是 unplugin 侧自己的路径拼接，处理的是“路由路径语义”，不是文件系统路径。
  let result = ''
  for (const path of paths) {
    result =
      result.replace(TRAILING_SLASH_RE, '') +
      // check path to avoid adding a trailing slash when joining an empty string
      (path && '/' + path.replace(LEADING_SLASH_RE, ''))
  }
  return result || '/'
}

function paramToName({ paramName, modifier, isSplat }: TreePathParam) {
  // 把参数片段转成 route name 生成时可读的 PascalCase 片段。
  return `${isSplat ? '$' : ''}${paramName.charAt(0).toUpperCase() + paramName.slice(1)}${
    modifier
    // ? modifier === '+'
    //   ? 'OneOrMore'
    //   : modifier === '?'
    //   ? 'ZeroOrOne'
    //   : 'ZeroOrMore'
    // : ''
  }`
}

/**
 * Creates a name based of the node path segments.
 *
 * @param node - the node to get the path from
 * @param parent - the parent node
 * @returns a route name
 */
export function getPascalCaseRouteName(node: TreeNode): string {
  // 生成稳定、可预测的命名路由名，是文件路由类型安全的重要前提。
  if (node.parent?.isRoot() && node.value.pathSegment === '') return 'Root'

  let name = node.value.subSegments
    .map(segment => {
      if (typeof segment === 'string') {
        return pascalCase(segment)
      }
      // else it's a param
      return paramToName(segment)
    })
    .join('')

  if (node.value.components.size && node.children.has('index')) {
    name += 'Parent'
  }

  const parent = node.parent

  return (
    (parent && !parent.isRoot()
      ? getPascalCaseRouteName(parent).replace(/Parent$/, '')
      : '') + name
  )
}

/**
 * Joins the path segments of a node into a name that corresponds to the filepath represented by the node.
 *
 * @param node - the node to get the path from
 * @returns a route name
 */
export function getFileBasedRouteName(node: TreeNode): string {
  // 另一种命名策略：更贴近原始文件系统层级。
  if (!node.parent) return ''
  return (
    getFileBasedRouteName(node.parent) +
    '/' +
    (node.value.rawSegment === 'index' ? '' : node.value.rawSegment)
  )
}

export function mergeRouteRecordOverride(
  a: RouteRecordOverride,
  b: RouteRecordOverride
): RouteRecordOverride {
  // 合并 <route> block、definePage、build-time edits 等不同来源的 override。
  const merged: RouteRecordOverride = {}
  const keys = [
    ...new Set<keyof RouteRecordOverride>([
      ...(Object.keys(a) as (keyof RouteRecordOverride)[]),
      ...(Object.keys(b) as (keyof RouteRecordOverride)[]),
    ]),
  ]

  for (const key of keys) {
    if (key === 'alias') {
      const newAlias: string[] = []
      merged[key] = newAlias.concat(a.alias || [], b.alias || [])
    } else if (key === 'meta') {
      merged[key] = mergeDeep(a[key] || {}, b[key] || {})
    } else if (key === 'params') {
      merged[key] = {
        path: {
          ...a[key]?.path,
          ...b[key]?.path,
        },
        query: {
          ...a[key]?.query,
          ...b[key]?.query,
        },
      }
    } else {
      // @ts-expect-error: TS cannot see it's the same key
      merged[key] = b[key] ?? a[key]
    }
  }

  return merged
}

function isObject(obj: any): obj is Record<any, any> {
  return obj && typeof obj === 'object'
}

function mergeDeep(...objects: Array<Record<any, any>>): Record<any, any> {
  // 主要用于 meta 的深合并。
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key]
      const oVal = obj[key]

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal)
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal)
      } else {
        prev[key] = oVal
      }
    })

    return prev
  }, {})
}

/**
 * Returns a route path to be used by the router with any defined prefix from an absolute path to a file. Since it
 * returns a route path, it will remove the extension from the file.
 *
 * @param options - RoutesFolderOption to apply
 * @param filePath - absolute path to file
 * @returns a route path to be used by the router with any defined prefix
 */
export function asRoutePath(
  {
    src,
    path = '',
    extensions,
  }: Pick<RoutesFolderOptionResolved, 'src' | 'path' | 'extensions'>,
  filePath: string
) {
  // 把绝对文件路径映射成相对的“路由文件路径”，同时去掉扩展名和注入的前缀。
  return trimExtension(
    typeof path === 'string'
      ? // add the path prefix if any
        path +
          // remove the absolute path to the pages folder
          filePath.slice(src.length + 1)
      : path(filePath),
    extensions
  )
}

/**
 * Builds a pattern from a file pattern and a list of extensions.
 *
 * @param filePattern - the file pattern to append the extensions to e.g. **‍/*
 * @param extensions array of extensions to append to the pattern e.g. ['.vue', '.js']
 * @returns
 */
export function appendExtensionListToPattern(
  filePatterns: string,
  extensions: string[]
): string
export function appendExtensionListToPattern(
  filePatterns: string[],
  extensions: string[]
): string[]
export function appendExtensionListToPattern(
  filePatterns: string | string[],
  extensions: string[]
): string[] | string {
  // 把 **/* 这类基础 glob 扩成 **/*.{vue,md} 这种可直接扫描的模式。
  const extensionPattern =
    extensions.length === 1
      ? extensions[0]
      : `.{${extensions.map(extension => extension.replace('.', '')).join(',')}}`

  return Array.isArray(filePatterns)
    ? filePatterns.map(filePattern => `${filePattern}${extensionPattern}`)
    : `${filePatterns}${extensionPattern}`
}

export interface ImportEntry {
  // name of the variable to import
  name: string
  // optional name to use when importing
  as?: string
}

export class ImportsMap {
  // path -> import as -> import name
  // e.g map['vue-router']['myUseRouter'] = 'useRouter' -> import { useRouter as myUseRouter } from 'vue-router'
  private map = new Map<string, Map<string, string>>()

  constructor() {}

  add(path: string, importEntry: ImportEntry): this
  add(path: string, importEntry: string): this
  add(path: string, importEntry: string | ImportEntry): this {
    // 统一收集生成阶段需要的 import，避免直接拼字符串时产生重复导入。
    if (!this.map.has(path)) {
      this.map.set(path, new Map())
    }
    const imports = this.map.get(path)!
    if (typeof importEntry === 'string') {
      imports.set(importEntry, importEntry)
    } else {
      imports.set(importEntry.as || importEntry.name, importEntry.name)
    }

    return this
  }

  /**
   * Check if the given path has the given import name.
   *
   * @param path - the path to check
   * @param name - the import name to check
   */
  has(path: string, name: string): boolean {
    return this.map.has(path) && this.map.get(path)!.has(name)
  }

  /**
   * Add a default import. Alias for `add(path, { name: 'default', as })`.
   *
   * @param path - the path to import from
   * @param as - the name to import as
   */
  addDefault(path: string, as: string): this {
    return this.add(path, { name: 'default', as })
  }

  /**
   * Get the list of imports for the given path.
   *
   * @param path - the path to get the import list for
   * @returns the list of imports for the given path
   */
  getImportList(path: string): Required<ImportEntry>[] {
    if (!this.map.has(path)) return []
    return Array.from(this.map.get(path)!).map(([as, name]) => ({
      as: as || name,
      name,
    }))
  }

  toString(): string {
    let importStatements = ''
    for (const [path, imports] of this.map) {
      if (!imports.size) continue

      const fromImportPath = toStringLiteral(path)

      // only one import and it's the default one
      if (imports.size === 1) {
        // we extract the first and only entry
        const [[importName, maybeDefault]] = [...imports.entries()] as [
          [string, string],
        ]
        // we only care if this is the default import
        if (maybeDefault === 'default') {
          importStatements += `import ${importName} from ${fromImportPath}\n`
          continue
        }
      }
      importStatements += `import { ${Array.from(imports)
        .map(([as, name]) => (as === name ? name : `${name} as ${as}`))
        .join(', ')} } from ${fromImportPath}\n`
    }

    return importStatements
  }

  get size(): number {
    return this.map.size
  }
}
