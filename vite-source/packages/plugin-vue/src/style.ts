import { compileStyleAsync } from 'vue/compiler-sfc'
import type { ResolvedOptions } from './index.js'
import { hash } from './utils/hash.js'
import type { SourceSFCDescriptor } from './utils/descriptorCache.js'

/**
 * 对齐官方 style.ts：SFC style 子请求先由 compiler-sfc 处理 scoped CSS，
 * 然后在 dev 环境中变成一个 JS 模块，运行时注入 <style> 标签。
 */
export async function transformStyle(
  code: string,
  descriptor: SourceSFCDescriptor,
  index: number,
  options: ResolvedOptions,
): Promise<{ code: string; map?: unknown }> {
  const block = descriptor.styles[index]
  if (!block) return { code: `export default "";` }

  const result = await compileStyleAsync({
    ...options.style,
    id: `data-v-${descriptor.id}`,
    filename: descriptor.filename,
    source: code,
    scoped: block.scoped,
    isProd: options.isProduction,
  })

  if (result.errors.length) {
    const first = result.errors[0]
    throw new Error(first instanceof Error ? first.message : String(first))
  }

  return {
    code: renderCssAsJs(result.code, `${descriptor.filename}?style=${index}`),
    map: result.map,
  }
}

function renderCssAsJs(css: string, id: string): string {
  const styleId = `vite-source-vue-${hash(id)}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `let style = document.querySelector('style[data-vite-source-id="${styleId}"]');`,
    `if (!style) {`,
    `  style = document.createElement('style');`,
    `  style.dataset.viteSourceId = ${JSON.stringify(styleId)};`,
    `  document.head.appendChild(style);`,
    `}`,
    `style.textContent = css;`,
    `if (import.meta.hot) import.meta.hot.accept();`,
    `export default css;`,
  ].join('\n')
}
