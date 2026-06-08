import { transform } from 'esbuild'
import type { Options } from './types.js'
import { addRefreshWrapper, isRefreshCandidate } from './refresh-utils.js'

export async function transformReact(
  code: string,
  id: string,
  options: Required<Pick<Options, 'jsxRuntime' | 'jsxImportSource' | 'reactRefreshHost'>>,
  skipFastRefresh: boolean,
): Promise<{ code: string; map: unknown }> {
  /**
   * Vite dev 不把全项目先打成 bundle，而是浏览器请求到某个源码模块时，
   * 再在这里把 TS/JSX 转成浏览器能执行的 JS。
   */
  const result = await transform(code, {
    // loader 由扩展名决定：.tsx 用 tsx，.jsx 用 jsx。
    loader: resolveLoader(id),
    // 开 sourcemap 方便浏览器报错能映射回原源码。
    sourcemap: true,
    // sourcefile 会写进 sourcemap，调试面板里能显示真实文件名。
    sourcefile: id,
    // 阅读版固定 es2020，真实项目会结合 build.target 等配置。
    target: 'es2020',
    // JSX runtime 和 config 钩子中的 esbuild 配置保持一致。
    jsx: options.jsxRuntime === 'classic' ? 'transform' : 'automatic',
    jsxImportSource: options.jsxImportSource,
  })

  // esbuild 输出的是第一阶段转换结果。
  let transformed = result.code
  if (!skipFastRefresh && isRefreshCandidate(id, transformed)) {
    // 只有可能包含 React 组件的模块才追加 Fast Refresh HMR 包装。
    transformed = addRefreshWrapper(transformed, id, options.reactRefreshHost)
  }

  return {
    code: transformed,
    // esbuild 返回字符串形式 sourcemap，插件容器统一使用对象/unknown。
    map: result.map ? JSON.parse(result.map) : null,
  }
}

function resolveLoader(id: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  // URL 可能带 ?t= 或 ?import，先清理 query/hash 再看扩展名。
  const clean = cleanUrl(id)
  if (clean.endsWith('.tsx')) return 'tsx'
  if (clean.endsWith('.ts') || clean.endsWith('.mts') || clean.endsWith('.cts')) return 'ts'
  if (clean.endsWith('.jsx')) return 'jsx'
  return 'js'
}

export function cleanUrl(url: string): string {
  // /src/App.tsx?t=123#hash -> /src/App.tsx
  return url.split('?')[0].split('#')[0]
}

export function matches(patterns: string | RegExp | Array<string | RegExp>, id: string): boolean {
  // include/exclude 支持单个条件或条件数组，统一成数组后逐个匹配。
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return list.some((pattern) => {
    if (typeof pattern === 'string') return id.includes(pattern)
    // 全局正则复用前要重置 lastIndex，避免第二次 test 结果受上次影响。
    pattern.lastIndex = 0
    return pattern.test(id)
  })
}
