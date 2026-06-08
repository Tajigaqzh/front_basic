import { transform } from 'esbuild'
import type { Options } from './types.js'
import { addRefreshWrapper, isRefreshCandidate } from './refresh-utils.js'

export async function transformReact(
  code: string,
  id: string,
  options: Required<Pick<Options, 'jsxRuntime' | 'jsxImportSource' | 'reactRefreshHost'>>,
  skipFastRefresh: boolean,
): Promise<{ code: string; map: unknown }> {
  const result = await transform(code, {
    loader: resolveLoader(id),
    sourcemap: true,
    sourcefile: id,
    target: 'es2020',
    jsx: options.jsxRuntime === 'classic' ? 'transform' : 'automatic',
    jsxImportSource: options.jsxImportSource,
  })

  let transformed = result.code
  if (!skipFastRefresh && isRefreshCandidate(id, transformed)) {
    transformed = addRefreshWrapper(transformed, id, options.reactRefreshHost)
  }

  return {
    code: transformed,
    map: result.map ? JSON.parse(result.map) : null,
  }
}

function resolveLoader(id: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const clean = cleanUrl(id)
  if (clean.endsWith('.tsx')) return 'tsx'
  if (clean.endsWith('.ts') || clean.endsWith('.mts') || clean.endsWith('.cts')) return 'ts'
  if (clean.endsWith('.jsx')) return 'jsx'
  return 'js'
}

export function cleanUrl(url: string): string {
  return url.split('?')[0].split('#')[0]
}

export function matches(patterns: string | RegExp | Array<string | RegExp>, id: string): boolean {
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return list.some((pattern) => {
    if (typeof pattern === 'string') return id.includes(pattern)
    pattern.lastIndex = 0
    return pattern.test(id)
  })
}
