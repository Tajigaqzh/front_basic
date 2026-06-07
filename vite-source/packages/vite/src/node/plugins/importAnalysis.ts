import path from 'node:path'
import { init, parse } from 'es-module-lexer'

/**
 * 阅读定位：
 * importAnalysis 是 dev 模式最后的 JS 分析插件。它把源码里的 import specifier
 * 改写成浏览器能请求的 URL，同时收集 import.meta.hot.accept 信息写入
 * ModuleGraph。官方 Vite 的 HMR、依赖发现、URL 重写都绕不开这一步。
 */
import type { Plugin, PluginContext, ResolvedConfig } from '../plugin.js'
import { cleanUrl, isAssetRequest, isBareImport, isJsLike, isVueRequest, normalizePath, pathToUrl } from '../utils.js'
import { resolvedIdToBrowserUrl } from './resolve.js'

export function importAnalysisPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:import-analysis',
    enforce: 'post',
    async transform(code, id) {
      if (id.startsWith('/@vite/')) return null
      if (!isJsLike(id) && !isVueRequest(id) && !id.startsWith('/@vite/')) return null

      /**
       * 官方 importAnalysisPlugin 使用 es-module-lexer/AST 精确解析导入语句。
       * 阅读版先生成轻量 AST，再基于节点 span 改写 specifier。它体现了关键职责：
       * 1. 找出当前模块依赖了谁。
       * 2. 把文件系统路径重写成浏览器可以请求的 URL。
       * 3. 记录 import.meta.hot.accept，为 HMR 边界传播服务。
       * 4. 为 HMR 注入 import.meta.hot 基础对象。
       */
      const ast = await parseImportAnalysisAst(code)
      const rewritten = await rewriteImportSpecifiers(code, ast.nodes, (specifier) =>
        rewriteSpecifier.call(this, config, specifier, id),
      )

      return {
        code: [
          `import { createHotContext as __vite_create_hot_context__ } from "/@vite/client";`,
          `import.meta.hot = import.meta.hot || __vite_create_hot_context__(${JSON.stringify(pathToUrl(config.root, id))});`,
          `import.meta.hot.__acceptedDeps = ${JSON.stringify(ast.acceptedHmrDeps)};`,
          `import.meta.hot.__selfAccepting = ${JSON.stringify(ast.isSelfAccepting)};`,
          rewritten,
        ].join('\n'),
      }
    },
  }
}

async function rewriteSpecifier(
  this: PluginContext,
  config: ResolvedConfig,
  specifier: string,
  importer: string,
): Promise<string> {
  if (specifier.startsWith('/@vite/')) return specifier
  if (specifier.startsWith('/@id/') || specifier.startsWith('/@fs/')) return specifier

  const resolved = await this.resolve(specifier, cleanUrl(importer))
  if (resolved && !resolved.external) {
    const url = resolvedIdToBrowserUrl(config, resolved.id)
    return isAssetRequest(resolved.id) ? `${url}?import` : url
  }

  if (specifier.startsWith('\0')) return `/@id/${encodeURIComponent(specifier)}?importer=${encodeURIComponent(cleanUrl(importer))}`
  if (isBareImport(specifier)) return `/@id/${encodeURIComponent(specifier)}?importer=${encodeURIComponent(cleanUrl(importer))}`
  if (specifier.startsWith('/')) return isAssetRequest(specifier) ? `${specifier}?import` : specifier

  const file = normalizePath(path.resolve(path.dirname(cleanUrl(importer)), specifier))
  const url = pathToUrl(config.root, file)
  return isAssetRequest(file) ? `${url}?import` : url
}

export type ImportAstNode =
  | ImportDeclarationNode
  | ExportNamedDeclarationNode
  | ImportExpressionNode
  | HotAcceptCallNode

export interface ImportDeclarationNode {
  type: 'ImportDeclaration'
  start: number
  end: number
  specifier: string
  specifierStart: number
  specifierEnd: number
}

export interface ExportNamedDeclarationNode {
  type: 'ExportNamedDeclaration'
  start: number
  end: number
  specifier: string
  specifierStart: number
  specifierEnd: number
}

export interface ImportExpressionNode {
  type: 'ImportExpression'
  start: number
  end: number
  specifier: string
  specifierStart: number
  specifierEnd: number
}

export interface HotAcceptCallNode {
  type: 'HotAcceptCall'
  start: number
  end: number
  deps: string[]
  selfAccepting: boolean
}

export interface ImportAnalysisAst {
  code: string
  nodes: ImportAstNode[]
  staticImports: string[]
  dynamicImports: string[]
  acceptedHmrDeps: string[]
  isSelfAccepting: boolean
}

export async function parseImportAnalysisAst(code: string): Promise<ImportAnalysisAst> {
  const nodes: ImportAstNode[] = []

  await init
  const [imports] = parse(code)
  for (const item of imports) {
    /**
     * es-module-lexer 返回的是官方 Vite 同类 lexer 能力：它知道字符串
     * specifier 在源码中的精确 start/end，比正则更能覆盖 export-from、
     * side-effect import、dynamic import、import attributes 等语法。
     */
    if (item.n == null || item.s < 0 || item.e < 0) continue
    nodes.push({
      type: item.d > -1 ? 'ImportExpression' : 'ImportDeclaration',
      start: item.ss,
      end: item.se,
      specifier: item.n,
      specifierStart: item.s,
      specifierEnd: item.e,
    })
  }

  scanHotAcceptCalls(code, nodes)

  return {
    code,
    nodes: nodes.sort((a, b) => a.start - b.start),
    staticImports: nodes
      .filter((node): node is ImportDeclarationNode | ExportNamedDeclarationNode =>
        node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration',
      )
      .map((node) => node.specifier),
    dynamicImports: nodes
      .filter((node): node is ImportExpressionNode => node.type === 'ImportExpression')
      .map((node) => node.specifier),
    acceptedHmrDeps: nodes
      .filter((node): node is HotAcceptCallNode => node.type === 'HotAcceptCall')
      .flatMap((node) => node.deps),
    isSelfAccepting: nodes.some((node) => node.type === 'HotAcceptCall' && node.selfAccepting),
  }
}

function rewriteImportSpecifiers(
  code: string,
  nodes: ImportAstNode[],
  rewrite: (specifier: string, node: ImportAstNode) => Promise<string>,
): Promise<string> {
  return Promise.all(nodes
    .filter(
      (
        node,
      ): node is ImportDeclarationNode | ExportNamedDeclarationNode | ImportExpressionNode =>
        node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ImportExpression',
    )
    .map(async (node) => ({
      start: node.specifierStart,
      end: node.specifierEnd,
      value: await rewrite(node.specifier, node),
    }))).then((replacements) => {
      let result = code
      for (const item of replacements.sort((a, b) => b.start - a.start)) {
        result = `${result.slice(0, item.start)}${item.value}${result.slice(item.end)}`
      }
      return result
    })
}

function scanHotAcceptCalls(code: string, nodes: ImportAstNode[]): void {
  const re = /import\.meta\.hot\.accept\s*\(([\s\S]*?)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(code))) {
    if (isInsideComment(code, match.index)) continue
    const args = match[1].trim()
    nodes.push({
      type: 'HotAcceptCall',
      start: match.index,
      end: match.index + match[0].length,
      deps: extractStringLiterals(args),
      selfAccepting: args === '' || args.startsWith('(') || args.startsWith('function'),
    })
  }
}

function extractStringLiterals(value: string): string[] {
  const deps: string[] = []
  const re = /['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(value))) deps.push(match[1])
  return deps
}

function isInsideComment(code: string, index: number): boolean {
  const before = code.slice(0, index)
  const lastBlockStart = before.lastIndexOf('/*')
  const lastBlockEnd = before.lastIndexOf('*/')
  if (lastBlockStart > lastBlockEnd) return true

  const lineStart = before.lastIndexOf('\n') + 1
  return before.slice(lineStart).includes('//')
}
