import path from 'node:path'
import type { ResolvedConfig, TransformResult } from '../plugin.js'
import { asyncReplace, isBareImport, normalizePath } from '../utils.js'

const importFromRE = /import\s+([^'"]+?)\s+from\s+['"]([^'"]+)['"];?/g
const sideEffectImportRE = /import\s+['"]([^'"]+)['"];?/g
const exportNamedRE = /export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g
const exportListRE = /export\s*\{([^}]+)\};?/g
const exportDefaultRE = /export\s+default\s+/g

export interface SsrTransformResult extends TransformResult {
  deps: string[]
}

/**
 * ssrTransform 的目标是把浏览器 ESM 转成可在 Node 函数里执行的代码。
 * 官方实现会生成更完整的 module runner 协议；这里保留关键思想：
 * 静态 import -> await __vite_ssr_import__(id)
 * export -> 写入 __vite_ssr_exports__
 */
export async function ssrTransform(
  config: ResolvedConfig,
  code: string,
  id: string,
): Promise<SsrTransformResult> {
  const deps: string[] = []
  let transformed = code

  transformed = await asyncReplace(transformed, importFromRE, async (match) => {
    const bindings = match[1].trim()
    const specifier = resolveSsrSpecifier(config, match[2], id)
    deps.push(specifier)
    return rewriteImportBindings(bindings, specifier)
  })

  transformed = await asyncReplace(transformed, sideEffectImportRE, async (match) => {
    const specifier = resolveSsrSpecifier(config, match[1], id)
    deps.push(specifier)
    return `await __vite_ssr_import__(${JSON.stringify(specifier)});`
  })

  transformed = transformed.replace(exportDefaultRE, '__vite_ssr_exports__.default = ')

  const exportedNames: string[] = []
  transformed = transformed.replace(exportNamedRE, (_full, declaration: string, name: string) => {
    exportedNames.push(name)
    return `${declaration} ${name}`
  })

  transformed = transformed.replace(exportListRE, (_full, names: string) => {
    return names
      .split(',')
      .map((raw) => {
        const [local, exported = local] = raw.trim().split(/\s+as\s+/)
        return `__vite_ssr_exports__.${exported.trim()} = ${local.trim()};`
      })
      .join('\n')
  })

  if (exportedNames.length) {
    transformed += `\n${exportedNames
      .map((name) => `__vite_ssr_exports__.${name} = ${name};`)
      .join('\n')}`
  }

  return { code: transformed, deps }
}

function rewriteImportBindings(bindings: string, specifier: string): string {
  const varName = `__vite_ssr_import_${Math.abs(hash(specifier + bindings))}`

  if (bindings.startsWith('{')) {
    return `const ${bindings} = await __vite_ssr_import__(${JSON.stringify(specifier)});`
  }

  if (bindings.startsWith('* as ')) {
    return `const ${bindings.slice('* as '.length)} = await __vite_ssr_import__(${JSON.stringify(specifier)});`
  }

  if (bindings.includes(',')) {
    const [defaultName, named] = bindings.split(/,\s*/, 2)
    return [
      `const ${varName} = await __vite_ssr_import__(${JSON.stringify(specifier)});`,
      `const ${defaultName.trim()} = ${varName}.default;`,
      `const ${named.trim()} = ${varName};`,
    ].join('\n')
  }

  return [
    `const ${varName} = await __vite_ssr_import__(${JSON.stringify(specifier)});`,
    `const ${bindings} = ${varName}.default ?? ${varName};`,
  ].join('\n')
}

function resolveSsrSpecifier(config: ResolvedConfig, specifier: string, importer: string): string {
  if (isBareImport(specifier) || specifier.startsWith('/')) return specifier
  return normalizePath(path.resolve(path.dirname(importer), specifier))
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return h
}
